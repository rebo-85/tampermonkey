// ==UserScript==
// @name         Boo Automatcher Working
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  Automatching base from results of pre-trained AI models
// @author       ReBo
// @match        https://boo.world/match
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js
// @require      https://unpkg.com/lodash@4.17.21/lodash.min.js
// @connect      cdn.jsdelivr.net
// @connect      unpkg.com
// @connect      rebo-85.github.io
// @connect      boo.world
// @connect      images.prod.boo.dating
// ==/UserScript==

const MODEL_BASE_URL = "https://rebo-85.github.io/BeautyPredict-Server/face-api.js/weights";
let automatcherStarted = false;

function logBoo(msg, ...args) {
  console.log("[Boo Automatcher]", msg, ...args);
}

function getStatusBanner() {
  let el = document.querySelector(".rb-faceapi-status");
  if (!el) {
    el = document.createElement("div");
    el.className = "rb-faceapi-status";
    el.style.cssText =
      "position:fixed;bottom:32px;right:16px;z-index:99999;background:#222;color:#fff;font:600 13px system-ui;padding:10px 18px 18px 18px;border-radius:12px;box-shadow:0 4px 12px #0003;border:2px solid #444;";
    el.textContent = "🤖 AI loading...";
    document.body.appendChild(el);
  }
  return el;
}

function setStatus(msg) {
  getStatusBanner().textContent = msg;
}

function checkScriptsLoaded() {
  const scripts = [
    { name: "FaceAPI", check: () => window.faceapi || (window.faceapijs && window.faceapijs.default) },
    { name: "TensorFlow", check: () => window.tf },
    { name: "Lodash", check: () => window._ },
  ];
  return scripts.every((script) => script.check());
}

class FaceRater {
  constructor() {
    this.loaded = false;
  }
  async loadModels() {
    if (this.loaded) return;
    setStatus("🤖 Loading face detection models...");
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_BASE_URL);
    await faceapi.nets.ageGenderNet.loadFromUri(MODEL_BASE_URL);
    this.loaded = true;
  }
  async rate(imgEl) {
    if (!this.loaded) await this.loadModels();
    let testImg = imgEl;
    try {
      const testCanvas = document.createElement("canvas");
      testCanvas.width = imgEl.naturalWidth;
      testCanvas.height = imgEl.naturalHeight;
      testCanvas.getContext("2d").drawImage(imgEl, 0, 0);
      testCanvas.getContext("2d").getImageData(0, 0, 1, 1);
    } catch (e) {
      try {
        const proxiedUrl = "https://corsproxy.io/?" + encodeURIComponent(imgEl.src);
        const resp = await fetch(proxiedUrl);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = blobUrl;
        });
        testImg = img;
      } catch {}
    }
    try {
      const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });
      const detection = await faceapi
        .detectSingleFace(testImg, opts)
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();
      if (!detection) return null;
      let domAge = null;
      const ageBadge = document.querySelector(
        'div[style*="bg-female"],div[style*="bg-male"],div.bg-female,.bg-female,.bg-male'
      );
      if (ageBadge) {
        const ageText = ageBadge.textContent.trim().match(/\d{2,3}/);
        if (ageText) domAge = parseInt(ageText[0], 10);
      }
      const expressions = detection.expressions || {};
      const mood = (expressions.happy || 0) + (expressions.neutral || 0);
      const confidence = detection.detection?.score || 0;
      const age = domAge || (detection.age ? Math.round(detection.age) : null);
      const gender = detection.gender || null;
      const score = Math.round(Math.min(10, mood * 7 + confidence * 3) * 10) / 10;
      return { score, mood, age, gender, confidence, box: detection.detection.box };
    } catch {}
  }
}

function pickMainImage() {
  const selectors = [
    'img[src*="images.prod.boo.dating"]',
    'img[src*="/lg.webp"]',
    'img[alt*="profile"]',
    'img[src*="blob:"]',
    "div > img:only-child",
    'img[class*="profile"]',
    'img[class*="avatar"]',
    'img[class*="card"]',
  ];
  let candidateImgs = [];
  for (const selector of selectors) {
    const imgs = [...document.querySelectorAll(selector)].filter((img) => {
      const rect = img.getBoundingClientRect();
      return rect.width >= 100 && rect.height >= 100 && img.offsetParent !== null && rect.top >= 0 && rect.left >= 0;
    });
    if (imgs.length > 0) {
      candidateImgs = imgs;
      break;
    }
  }
  if (candidateImgs.length === 0) {
    candidateImgs = [...document.querySelectorAll("img")].filter((img) => {
      const rect = img.getBoundingClientRect();
      return rect.width >= 150 && rect.height >= 150 && img.offsetParent !== null && rect.top >= 0;
    });
  }
  candidateImgs.sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    const viewportCenter = window.innerWidth / 2;
    const aSize = aRect.width * aRect.height;
    const bSize = bRect.width * bRect.height;
    const aCenterDist = Math.abs(aRect.left + aRect.width / 2 - viewportCenter);
    const bCenterDist = Math.abs(bRect.left + bRect.width / 2 - viewportCenter);
    return bSize - bCenterDist - (aSize - aCenterDist);
  });
  if (candidateImgs.length > 0) return candidateImgs[0];
  return null;
}

function renderBadge(img, rating) {
  if (!rating) return;
  document.querySelectorAll(".rb-face-score, .rb-face-box").forEach((el) => el.remove());
  const badge = document.createElement("div");
  badge.className = "rb-face-score";
  badge.style.cssText = `
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 10000;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font: 600 14px/1.4 system-ui, -apple-system, sans-serif;
    padding: 8px 12px;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 2px solid rgba(255,255,255,0.2);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.3s ease;
    max-width: 200px;
  `;
  const getScoreEmoji = (score) => {
    if (score >= 9) return "🔥";
    if (score >= 8) return "⭐";
    if (score >= 7) return "👍";
    if (score >= 6) return "😐";
    return "👎";
  };
  const emoji = getScoreEmoji(rating.score);
  const ageText = rating.age ? `Age: ~${rating.age}` : "Age: Unknown";
  const genderText = rating.gender ? `${rating.gender}` : "Gender: Unknown";
  badge.innerHTML = `
    <span style="font-size: 16px">${emoji}</span>
    <div style="display: flex; flex-direction: column; line-height: 1.2;">
      <span>Score: <strong>${rating.score}/10</strong></span>
      <span style="font-size: 11px; opacity: 0.9;">${ageText}</span>
      <span style="font-size: 11px; opacity: 0.9;">${genderText}</span>
    </div>
  `;
  let parent = img.parentElement;
  let levels = 0;
  while (parent && levels < 5) {
    const style = getComputedStyle(parent);
    if (style.position !== "static" || parent.tagName === "BODY") break;
    parent = parent.parentElement;
    levels++;
  }
  if (!parent || parent === document.body) {
    parent = img.parentElement;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  }
  parent.appendChild(badge);
  if (rating.box && rating.box.width > 10 && rating.box.height > 10) {
    const existingBox = parent.querySelector(".rb-face-box");
    if (existingBox) existingBox.remove();
    const faceBox = document.createElement("div");
    faceBox.className = "rb-face-box";
    faceBox.style.cssText = `
      position: absolute;
      border: 2px solid #00ff00;
      background: rgba(0, 255, 0, 0.1);
      pointer-events: none;
      z-index: 9999;
      border-radius: 8px;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.3) inset;
      left: ${rating.box.x}px;
      top: ${rating.box.y}px;
      width: ${rating.box.width}px;
      height: ${rating.box.height}px;
    `;
    parent.appendChild(faceBox);
  }
}

async function scanAndScore() {
  try {
    document.querySelectorAll(".rb-face-score, .rb-face-box").forEach((el) => el.remove());
    const img = pickMainImage();
    if (!img) {
      setStatus("👀 No profile image");
      setTimeout(() => setStatus("✅ AI Ready"), 2000);
      return;
    }
    setStatus("🔍 Analyzing...");
    const rating = await window.faceRater.rate(img);
    if (rating) {
      renderBadge(img, rating);
      setStatus(`✅ Rated: ${rating.score}/10`);
    } else {
      setStatus("❌ Analysis failed");
      setTimeout(() => setStatus("✅ AI Ready"), 2000);
    }
  } catch {
    setStatus("❌ Scan error");
    setTimeout(() => setStatus("✅ AI Ready"), 2000);
  }
}

async function startAutomatcher() {
  if (automatcherStarted) return;
  automatcherStarted = true;
  setStatus("🤖 Checking scripts...");
  if (!checkScriptsLoaded()) {
    setStatus("❌ Scripts missing - please refresh");
    return;
  }
  setStatus("✅ Scripts loaded - Loading AI models...");
  try {
    window.faceRater = new FaceRater();
    await window.faceRater.loadModels();
    setStatus("✅ AI Ready - Scanning profiles...");
    const debouncedScan = _.debounce(scanAndScore, 1000);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && (node.tagName === "IMG" || (node.querySelector && node.querySelector("img")))) {
              debouncedScan();
              return;
            }
          }
        } else if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "src" || mutation.attributeName === "style")
        ) {
          debouncedScan();
          return;
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "style", "class"],
    });
    setTimeout(scanAndScore, 1000);
    setTimeout(scanAndScore, 3000);
    setTimeout(scanAndScore, 5000);
    setInterval(scanAndScore, 8000);
    const style = document.createElement("style");
    style.textContent = `
      .rb-face-score:hover {
        transform: scale(1.05) !important;
        box-shadow: 0 6px 20px rgba(0,0,0,0.4) !important;
      }
      .rb-face-box {
        animation: faceBoxPulse 2s ease-in-out;
      }
      @keyframes faceBoxPulse {
        0% { opacity: 0.8; }
        50% { opacity: 1; }
        100% { opacity: 0.8; }
      }
    `;
    document.head.appendChild(style);
    const successBadge = document.createElement("div");
    successBadge.id = "rb-automatcher-active";
    successBadge.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #00b09b, #96c93d);
      color: white;
      padding: 10px 15px;
      z-index: 99999;
      border-radius: 8px;
      font-family: system-ui;
      font-weight: bold;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    successBadge.textContent = "✅ Boo Automatcher Active";
    document.body.appendChild(successBadge);
  } catch {
    setStatus("❌ AI initialization failed");
    automatcherStarted = false;
  }
}

(function () {
  "use strict";
  getStatusBanner();
  const init = () => setTimeout(startAutomatcher, 1500);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
