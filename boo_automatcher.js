// ==UserScript==
// @name         Boo World Beauty Rating (Face Detection + CORS-safe)
// @namespace    http://tampermonkey.net/
// @version      1.8.1
// @description  Rate beauty scores for main profile pictures on Boo World (with face detection + cropping)
// @author       ReBo
// @match        https://boo.world/*
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js
// @require      https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      images.prod.boo.dating
// @connect      rebo-85.github.io
// @connect      boo.world
// ==/UserScript==

(function () {
  "use strict";

  let model = null;
  let isInitialized = false;
  let isInitializing = false;
  let faceModelLoaded = false;
  let observer = null;
  let active = false;

  function activateAutomatcher() {
    if (active) return;
    active = true;
    setupAutoObserver();
  }

  function deactivateAutomatcher() {
    if (!active) return;
    active = false;
    if (observer) observer.disconnect();
    document.querySelectorAll(".beauty-score-badge,.face-box-overlay").forEach((el) => el.remove());
    document.querySelectorAll("img[data-beauty-processed]").forEach((img) => {
      img.style.border = "";
      img.style.borderRadius = "";
      img.removeAttribute("data-beauty-processed");
    });
  }

  function onLoad() {
    const interval = setInterval(() => {
      if (!isInitialized) initializeModels();
      else clearInterval(interval);
    }, 1000);

    let lastMatch = false;
    setInterval(() => {
      const isMatchPage = /^https:\/\/boo\.world\/match/.test(location.href);
      if (isMatchPage && !lastMatch) activateAutomatcher();
      if (!isMatchPage && lastMatch) deactivateAutomatcher();
      lastMatch = isMatchPage;
    }, 500);
  }

  async function initializeModels() {
    if (isInitialized || isInitializing) return;
    isInitializing = true;

    try {
      console.log("[Boo Automatcher] Loading models...");
      showNotification("Loading AI model...");

      model = await tf.loadGraphModel("https://rebo-85.github.io/Model-Server/aesthetic_rater/model.json");

      await faceapi.nets.ssdMobilenetv1.loadFromUri("https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/");

      faceModelLoaded = true;
      isInitialized = true;
      showNotification("AI models ready", "success");
      console.log("[Boo Automatcher] Models loaded successfully.");
    } catch (error) {
      console.error("[Boo Automatcher] Model load error:", error);
      showNotification(`Failed to load model: ${error.message}`, "error");
      isInitializing = false;
    }
  }

  async function processSingleProfileImage(img) {
    if (shouldSkipImage(img)) return false;

    try {
      if (!img.complete || img.naturalWidth === 0) return await waitForImageLoad(img);

      const beautyScore = await predictImageBeauty(img);
      addBeautyScoreToImage(img, beautyScore);
      img.setAttribute("data-beauty-processed", "true");
      return true;
    } catch (error) {
      console.error("[Boo Automatcher] Error processing image:", img.src, error);
      return false;
    }
  }

  function shouldSkipImage(img) {
    const isMainProfile =
      img.classList.contains("rounded-full") && img.classList.contains("object-cover") && img.src.endsWith("/lg.webp");

    const alreadyProcessed = img.hasAttribute("data-beauty-processed");
    return isMainProfile || alreadyProcessed;
  }

  async function waitForImageLoad(img) {
    return new Promise((resolve) => {
      img.addEventListener("load", async function onImgLoad() {
        img.removeEventListener("load", onImgLoad);
        await processSingleProfileImage(img);
        resolve();
      });
    });
  }

  async function gmFetchBlob(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        responseType: "blob",
        onload: (res) =>
          res.status >= 200 && res.status < 300
            ? resolve(res.response)
            : reject(new Error(`Failed to fetch image: ${res.status}`)),
        onerror: reject,
        ontimeout: reject,
      });
    });
  }

  async function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function getFaceCroppedCanvas(img) {
    if (!faceModelLoaded) throw new Error("Face detection model not loaded");

    const blob = await gmFetchBlob(img.src);
    const blobUrl = URL.createObjectURL(blob);
    const decoded = await loadImage(blobUrl);
    URL.revokeObjectURL(blobUrl);

    const detections = await faceapi.detectAllFaces(decoded);
    const minConfidence = 0.4;
    const filtered = detections.filter((d) => d.score >= minConfidence);
    if (!filtered.length) return null;
    if (!detections.length) {
      console.log("[Boo Automatcher] No faces detected:", img.src);
      return null;
    }

    const mainFace = detections.sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)[0].box;

    const paddedBox = getPaddedBox(mainFace, decoded.width, decoded.height);
    drawFaceBoxOverlay(img, paddedBox);

    const canvas = document.createElement("canvas");
    canvas.width = paddedBox.width;
    canvas.height = paddedBox.height;
    canvas
      .getContext("2d")
      .drawImage(
        decoded,
        paddedBox.x,
        paddedBox.y,
        paddedBox.width,
        paddedBox.height,
        0,
        0,
        paddedBox.width,
        paddedBox.height
      );

    return canvas;
  }

  function getPaddedBox(box, imgWidth, imgHeight) {
    const padX = box.width * 0.7;
    const padY = box.height * 0.7;
    const cropX = Math.max(box.x - padX / 2, 0);
    const cropY = Math.max(box.y - padY / 2, 0);
    const cropW = Math.min(box.width + padX, imgWidth - cropX);
    const cropH = Math.min(box.height + padY, imgHeight - cropY);
    return { x: cropX, y: cropY, width: cropW, height: cropH };
  }

  function drawFaceBoxOverlay(img, box) {
    const parent = img.parentElement;
    const existingBox = parent.querySelector(".face-box-overlay");
    if (existingBox) existingBox.remove();
    if (window.getComputedStyle(parent).position === "static") parent.style.position = "relative";

    const overlay = document.createElement("div");
    overlay.className = "face-box-overlay";
    overlay.style.cssText = `
      position: absolute;
      left: ${img.offsetLeft + box.x * (img.width / img.naturalWidth)}px;
      top: ${img.offsetTop + box.y * (img.height / img.naturalHeight)}px;
      width: ${box.width * (img.width / img.naturalWidth)}px;
      height: ${box.height * (img.height / img.naturalHeight)}px;
      border: 2px solid #00ff88;
      border-radius: 6px;
      box-shadow: 0 0 10px rgba(0,255,100,0.5);
      pointer-events: none;
      z-index: 10;
    `;
    parent.appendChild(overlay);
  }

  async function predictImageBeauty(img) {
    const canvas = await getFaceCroppedCanvas(img);
    if (!canvas) return 0;

    let tensor = tf.browser.fromPixels(canvas).toFloat();
    tensor = tensor.div(127.5).sub(1);
    tensor = tf.image.resizeBilinear(tensor, [224, 224]);
    tensor = tensor.transpose([2, 0, 1]).expandDims(0);

    const prediction = model.predict(tensor);
    const logits = await prediction.data();
    const maxLogit = Math.max(...logits);
    const exps = logits.map((v) => Math.exp(v - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((v) => v / sumExps);

    let score = 0;
    for (let i = 0; i < probs.length; ++i) score += (i + 1) * probs[i];

    tf.dispose([tensor, prediction]);
    return score;
  }

  function addBeautyScoreToImage(img, beautyScore) {
    const parent = img.parentElement;
    if (window.getComputedStyle(parent).position === "static") parent.style.position = "relative";

    const badge = document.createElement("div");
    badge.className = "beauty-score-badge";

    const scoreValue = beautyScore.toFixed(1);
    const scoreColor = getScoreColor(scoreValue, 0.9);
    const badgeText = beautyScore === 0 ? "🚫 No Face Detected" : `🌟 ${scoreValue}/5`;

    badge.style.cssText = `
      position: absolute;
      left: ${img.offsetLeft + 8}px;
      top: ${img.offsetTop + 8}px;
      background: ${scoreColor};
      color: white;
      padding: 8px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
      font-family: Arial, sans-serif;
      border: 2px solid white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      pointer-events: none;
      z-index: 9;
    `;
    badge.textContent = badgeText;
    parent.appendChild(badge);

    img.style.border = `3px solid ${scoreColor}`;
    img.style.borderRadius = "16px";
  }

  function getScoreColor(score, alpha) {
    score = parseFloat(score);
    if (score >= 4.5) return `rgba(76,175,80,${alpha})`;
    if (score >= 3.5) return `rgba(139,195,74,${alpha})`;
    if (score >= 2.5) return `rgba(255,193,7,${alpha})`;
    if (score >= 1.5) return `rgba(255,152,0,${alpha})`;
    if (score > 0) return `rgba(244,67,54,${alpha})`;
    return `rgba(180,180,180,${alpha})`;
  }

  function showNotification(message, type = "info") {
    const existing = document.getElementById("beauty-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.id = "beauty-notification";
    notification.textContent = message;

    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: ${type === "success" ? "#4CAF50" : type === "error" ? "#f44336" : "#2196F3"};
      color: white;
      padding: 12px 20px;
      border-radius: 5px;
      z-index: 10001;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
  }

  function setupAutoObserver() {
    if (observer) observer.disconnect();
    let lastProfile = null;
    observer = new MutationObserver(() => {
      const profiles = document.querySelectorAll('div[id^="profileColumn-"]');
      const currentProfile = profiles[profiles.length - 1];
      if (!currentProfile || currentProfile === lastProfile) return;
      lastProfile = currentProfile;
      const imgs = currentProfile.querySelectorAll('img[src*="images.prod.boo.dating"]');
      imgs.forEach((img) => processSingleProfileImage(img));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener("load", onLoad);
})();
