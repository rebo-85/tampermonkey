// ==UserScript==
// @name         Boo World Beauty Rating
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Rate beauty scores for main profile pictures on Boo World
// @author       ReBo
// @match        https://boo.world/match
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js
// @connect      rebo-85.github.io
// @connect      boo.world
// @connect      images.prod.boo.dating
// ==/UserScript==

(function () {
  "use strict";

  let model = null;
  let isProcessing = false;
  let isInitialized = false;
  let isInitializing = false;

  // Initialize models
  async function initializeModels() {
    isInitializing = true;
    try {
      if (isInitialized) return;

      console.log("[Boo Automatcher] Loading beauty model...");

      showNotification(`Loading AI model`);
      // Load beauty prediction model
      model = await tf.loadLayersModel("https://rebo-85.github.io/Model-Server/beauty_predict/model.json");
      console.log("[Boo Automatcher] Beauty prediction model loaded successfully");
      showNotification(`AI model Ready`, "success");

      isInitialized = true;
      scanProfileImages();
    } catch (error) {
      console.error("[Boo Automatcher] Error loading model:", error);
      showNotification(`Failed to load model: ${error.message}`, "error");
      isInitializing = false;
    }
  }

  // Show notification
  function showNotification(message, type = "info") {
    const existingNotification = document.getElementById("beauty-notification");
    if (existingNotification) {
      existingNotification.remove();
    }

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

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);
  }

  // Find main profile images specifically
  function findProfileImages() {
    // Strategy 1: Look for images with specific classes and attributes
    const selectors = [
      'img[class*="rounded-3xl"][class*="object-cover"]', // Your example image
      'img[data-nimg="fill"]', // Next.js optimized images
      '[class*="profile"] img',
      '[class*="avatar"] img',
      '[class*="user"] img',
      ".main-photo img",
      ".profile-picture img",
      ".avatar img",
    ];

    let profileImages = [];

    // Try each selector
    for (const selector of selectors) {
      const images = document.querySelectorAll(selector);
      if (images.length > 0) {
        console.log(`[Boo Automatcher] Found ${images.length} images with selector: ${selector}`);
        profileImages = Array.from(images).filter(
          (img) => img.width > 150 && img.height > 150 && img.src && img.src.includes("images.prod.boo.dating")
        );
        if (profileImages.length > 0) break;
      }
    }

    // Strategy 2: Look for large images from boo.dating domain
    if (profileImages.length === 0) {
      const allImages = document.querySelectorAll('img[src*="images.prod.boo.dating"]');
      profileImages = Array.from(allImages).filter((img) => img.width > 150 && img.height > 150);
    }

    // Strategy 3: Look for images in card-like containers
    if (profileImages.length === 0) {
      const containers = document.querySelectorAll('[class*="card"], [class*="profile"], [class*="user"]');
      for (const container of containers) {
        const imgs = container.querySelectorAll("img");
        const largeImgs = Array.from(imgs).filter((img) => img.width > 150 && img.height > 150);
        profileImages.push(...largeImgs);
      }
    }

    // Remove duplicates and already processed images
    const uniqueImages = [];
    const seenSrc = new Set();

    for (const img of profileImages) {
      if (!img.hasAttribute("data-beauty-processed") && !seenSrc.has(img.src) && img.src) {
        uniqueImages.push(img);
        seenSrc.add(img.src);
      }
    }

    console.log(`[Boo Automatcher] Found ${uniqueImages.length} unique profile images to process`);
    return uniqueImages;
  }

  // Scan only profile images
  async function scanProfileImages() {
    isProcessing = true;

    try {
      const profileImages = findProfileImages();

      if (profileImages.length === 0) {
        showNotification("No profile images found on this page.", "warning");
        return;
      }

      let processedCount = 0;

      for (let img of profileImages) {
        if (await processSingleProfileImage(img)) {
          processedCount++;
        }
        await new Promise((resolve) => setTimeout(resolve, 200)); // Slow down to avoid rate limiting
      }

      showNotification(`Rated ${processedCount} profile images`, "success");
    } catch (error) {
      console.error("[Boo Automatcher] Error during scanning:", error);
      showNotification(`Rating error: ${error.message}`, "error");
    } finally {
      isProcessing = false;
    }
  }

  // Process a single profile image
  async function processSingleProfileImage(img) {
    try {
      if (img.hasAttribute("data-beauty-processed")) return false;

      if (!img.complete || img.naturalWidth === 0) {
        img.addEventListener("load", async function onImgLoad() {
          img.removeEventListener("load", onImgLoad);
          if (!img.hasAttribute("data-beauty-processed")) await processSingleProfileImage(img);
        });
        return false;
      }

      console.log("[Boo Automatcher] Processing profile image:", img.src);

      // Use the entire image for beauty prediction (assuming it's a face)
      const beautyScore = await predictImageBeauty(img);

      // Add beauty score overlay
      addBeautyScoreToImage(img, beautyScore);

      img.setAttribute("data-beauty-processed", "true");
      return true;
    } catch (error) {
      console.error("[Boo Automatcher] Error processing profile image:", error, img.src);
      return false;
    }
  }

  // Predict beauty score for entire image
  async function predictImageBeauty(img) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    let drawWorked = false;

    if (!drawWorked) {
      try {
        const proxyEndpoint = "http://localhost:3000/request";
        const proxyResp = await fetch(proxyEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: img.src,
            method: "GET",
          }),
        });
        const proxiedBlob = await proxyResp.blob();
        const proxiedBlobUrl = URL.createObjectURL(proxiedBlob);
        const tempImg = document.createElement("img");
        tempImg.src = proxiedBlobUrl;
        await new Promise((r) => (tempImg.onload = r));
        ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(proxiedBlobUrl);
      } catch (proxyErr) {
        console.error("[Boo Automatcher] Proxy image fetch failed:", proxyErr, img.src);
        return 0;
      }
    }

    let inputTensor = tf.browser.fromPixels(canvas).toFloat();
    inputTensor = tf.image.resizeBilinear(inputTensor, [224, 224]);
    inputTensor = inputTensor.div(255.0).expandDims(0);
    const prediction = model.predict(inputTensor);
    const predArr = await prediction.data();
    const beautyScore = predArr[0];
    tf.dispose([inputTensor, prediction]);
    return beautyScore;
  }
  // Add beauty score to image
  function addBeautyScoreToImage(img, beautyScore) {
    const parent = img.parentElement;
    if (window.getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }
    const badge = document.createElement("div");
    badge.className = "beauty-score-badge";
    const formattedScore = (beautyScore * 100).toFixed(1);
    badge.style.cssText = `
      position: absolute;
      left: ${img.offsetLeft + 8}px;
      top: ${img.offsetTop + 8}px;
      background: ${getScoreColor(formattedScore, 0.9)};
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
    badge.textContent = `🌟 ${formattedScore}/10`;
    badge.title = `Beauty Score: ${formattedScore}/10`;
    parent.appendChild(badge);
    if (!img.beautyBadges) img.beautyBadges = [];
    img.beautyBadges.push(badge);
    const originalBorder = img.style.border;
    img.style.border = `3px solid ${getScoreColor(formattedScore)}`;
    img.style.borderRadius = "16px";
    img.setAttribute("data-original-border", originalBorder);
  }

  // Get color based on beauty score
  function getScoreColor(score, alpha = 1) {
    if (score >= 8.5) return `rgba(76, 175, 80, ${alpha})`; // Green - Excellent
    if (score >= 7.5) return `rgba(139, 195, 74, ${alpha})`; // Light Green - Very Good
    if (score >= 6.5) return `rgba(255, 193, 7, ${alpha})`; // Yellow - Good
    if (score >= 5.5) return `rgba(255, 152, 0, ${alpha})`; // Orange - Average
    return `rgba(244, 67, 54, ${alpha})`; // Red - Below Average
  }

  // Auto-rate new profiles when they appear (for infinite scroll)
  function setupAutoObserver() {
    const observer = new MutationObserver((mutations) => {
      if (!model || isProcessing) return;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Element node
            // Check if this looks like a new profile card
            if (
              node.querySelector &&
              (node.querySelector('img[class*="rounded-3xl"][class*="object-cover"]') ||
                node.querySelector('img[src*="images.prod.boo.dating"]'))
            ) {
              setTimeout(() => {
                const newImages = findProfileImages().filter((img) => !img.hasAttribute("data-beauty-processed"));
                if (newImages.length > 0) {
                  console.log("[Boo Automatcher] Auto-rating new profile images");
                  newImages.forEach((img) => processSingleProfileImage(img));
                }
              }, 1000);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Initialize when page loads
  window.addEventListener("load", function () {
    setupAutoObserver();

    const modelInitInterval = setInterval(() => {
      if (!isInitialized) {
        if (!isInitializing) initializeModels();
      } else clearInterval(modelInitInterval);
    }, 1000);
  });
})();
