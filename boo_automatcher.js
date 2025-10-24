// ==UserScript==
// @name         Boo World Beauty Rating (Face Detection + CORS-safe)
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Rate beauty scores for main profile pictures on Boo World (with face detection + cropping)
// @author       ReBo
// @match        https://boo.world/match*
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js
// @require      https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      images.prod.boo.dating
// @connect      rebo-85.github.io
// @connect      boo.world
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  let model = null;
  let isInitialized = false;
  let isInitializing = false;
  let faceModelLoaded = false;

  async function initializeModels() {
    isInitializing = true;
    try {
      if (isInitialized) return;
      console.log("[Boo Automatcher] Loading models...");

      showNotification(`Loading AI model...`);
      model = await tf.loadLayersModel("https://rebo-85.github.io/Model-Server/beauty_predict/model.json");

      // Load face detection model
      await faceapi.nets.ssdMobilenetv1.loadFromUri("https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/");
      faceModelLoaded = true;

      console.log("[Boo Automatcher] Models loaded successfully.");
      showNotification(`AI models ready`, "success");

      isInitialized = true;
    } catch (error) {
      console.error("[Boo Automatcher] Error loading model:", error);
      showNotification(`Failed to load model: ${error.message}`, "error");
      isInitializing = false;
    }
  }

  async function processSingleProfileImage(img) {
    if (
      img.classList.contains("rounded-full") &&
      img.classList.contains("object-cover") &&
      img.src.endsWith("/lg.webp")
    )
      return false;

    try {
      if (img.hasAttribute("data-beauty-processed")) return false;
      if (!img.complete || img.naturalWidth === 0) {
        img.addEventListener("load", async function onImgLoad() {
          img.removeEventListener("load", onImgLoad);
          if (!img.hasAttribute("data-beauty-processed")) await processSingleProfileImage(img);
        });
        return false;
      }

      const beautyScore = await predictImageBeauty(img);
      addBeautyScoreToImage(img, beautyScore);
      img.setAttribute("data-beauty-processed", "true");
      return true;
    } catch (error) {
      console.error("[Boo Automatcher] Error processing profile image:", error, img.src);
      return false;
    }
  }

  async function gmFetchBlob(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        responseType: "blob",
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.response);
          else reject(new Error(`Failed to fetch image: ${res.status}`));
        },
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
    if (!detections.length) {
      console.log("[Boo Automatcher] No faces detected in image:", img.src);
      return;
    }

    const mainFace = detections.sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)[0].box;

    const padX = mainFace.width * 0.7;
    const padY = mainFace.height * 0.7;
    const cropX = Math.max(mainFace.x - padX / 2, 0);
    const cropY = Math.max(mainFace.y - padY / 2, 0);
    const cropW = Math.min(mainFace.width + padX, decoded.width - cropX);
    const cropH = Math.min(mainFace.height + padY, decoded.height - cropY);

    drawFaceBoxOverlay(img, {
      x: cropX,
      y: cropY,
      width: cropW,
      height: cropH,
    });

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(decoded, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    return canvas;
  }

  function drawFaceBoxOverlay(img, box) {
    // Remove previous overlay if any
    const existingBox = img.parentElement.querySelector(".face-box-overlay");
    if (existingBox) existingBox.remove();

    const parent = img.parentElement;
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
      z-index: 10;
      pointer-events: none;
      box-shadow: 0 0 10px rgba(0,255,100,0.5);
    `;
    parent.appendChild(overlay);
  }

  async function predictImageBeauty(img) {
    const canvas = await getFaceCroppedCanvas(img);
    if (!canvas) return 0;

    const tensor = tf.browser.fromPixels(canvas).toFloat();
    const resized = tf.image.resizeBilinear(tensor, [224, 224]);
    const normalized = resized.div(255.0).expandDims(0);

    const prediction = model.predict(normalized);
    const result = await prediction.data();

    tf.dispose([tensor, resized, normalized, prediction]);

    return result[0];
  }

  function addBeautyScoreToImage(img, beautyScore) {
    const parent = img.parentElement;
    if (window.getComputedStyle(parent).position === "static") parent.style.position = "relative";

    const badge = document.createElement("div");
    badge.className = "beauty-score-badge";
    const formattedScore = (beautyScore * 100).toFixed(1);
    let badgeText;
    const badgeColor = getScoreColor(formattedScore, 0.9);

    if (beautyScore === 0) badgeText = "🚫 No face Detected";
    else badgeText = `🌟 ${formattedScore}/10`;

    badge.style.cssText = `
      position: absolute;
      left: ${img.offsetLeft + 8}px;
      top: ${img.offsetTop + 8}px;
      background: ${badgeColor};
      color: white;
      padding: 8px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
      font-family: Arial, sans-serif;
      z-index: 9;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      pointer-events: none;
      border: 2px solid white;
    `;
    badge.textContent = badgeText;
    parent.appendChild(badge);

    img.style.border = `3px solid ${badgeColor}`;
    img.style.borderRadius = "16px";
    img.setAttribute("data-beauty-processed", "true");
  }

  function getScoreColor(score, alpha = 1) {
    if (typeof score === "string") score = parseFloat(score);
    if (score >= 8.5) return `rgba(76,175,80,${alpha})`;
    if (score >= 7.5) return `rgba(139,195,74,${alpha})`;
    if (score >= 6.5) return `rgba(255,193,7,${alpha})`;
    if (score >= 5.5) return `rgba(255,152,0,${alpha})`;
    if (score == 0) return `rgba(180,180,180,${alpha})`;
    return `rgba(244,67,54,${alpha})`;
  }

  function setupAutoObserver() {
    let lastProfile = null;
    const observer = new MutationObserver(() => {
      const profileColumns = document.querySelectorAll('div[id^="profileColumn-"]');
      const currentProfile = profileColumns[profileColumns.length - 1];
      if (!currentProfile || currentProfile === lastProfile) return;
      lastProfile = currentProfile;
      const imgs = currentProfile.querySelectorAll('img[src*="images.prod.boo.dating"]');
      imgs.forEach((img) => processSingleProfileImage(img));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function showNotification(message, type = "info") {
    const existing = document.getElementById("beauty-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.id = "beauty-notification";
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
      word-wrap: break-word;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
  }

  window.addEventListener("load", () => {
    setupAutoObserver();

    const modelInitInterval = setInterval(() => {
      if (!isInitialized) {
        if (!isInitializing) initializeModels();
      } else clearInterval(modelInitInterval);
    }, 1000);
  });
})();
