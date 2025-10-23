// ==UserScript==
// @name         Beauty Prediction on Images
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Predict beauty score for faces in images using TensorFlow.js
// @author       ReBo
// @match        https://boo.world/match
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js
// @require      https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js
// @connect      rebo-85.github.io
// @connect      boo.world
// @connect      images.prod.boo.dating
// ==/UserScript==

(function () {
  "use strict";

  let model = null;
  let blazefaceModel = null;
  let isProcessing = false;
  let isInitialized = false;

  // Create and inject the button
  function createBeautyPredictionButton() {
    const button = document.createElement("button");
    button.id = "beautyPredictBtn";
    button.innerHTML = "🔍 Beauty Scan";
    button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 25px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      transition: all 0.3s ease;
      font-family: Arial, sans-serif;
    `;

    // Add hover effects
    button.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-2px)";
      this.style.boxShadow = "0 6px 20px rgba(0,0,0,0.3)";
    });

    button.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0)";
      this.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
    });

    // Add click handler
    button.addEventListener("click", async function () {
      if (!isInitialized) {
        await initializeModels();
      }
      if (model && blazefaceModel) {
        await scanAllImages();
      }
    });

    document.body.appendChild(button);
    return button;
  }

  // Initialize models with better error handling
  async function initializeModels() {
    try {
      if (isInitialized) return;

      console.log("Loading models...");

      // Show loading state on button
      const button = document.getElementById("beautyPredictBtn");
      if (button) {
        button.innerHTML = "⏳ Loading...";
        button.style.background = "#ffa500";
        button.disabled = true;
      }

      // Load Blazeface for face detection with proper error handling
      console.log("Loading Blazeface model...");
      try {
        // Check if blazeface is available
        if (typeof blazeface === "undefined") {
          throw new Error("Blazeface library not loaded properly");
        }
        blazefaceModel = await blazeface.load();
        console.log("Blazeface model loaded successfully");
      } catch (faceError) {
        console.error("Failed to load Blazeface:", faceError);
        throw new Error(`Blazeface loading failed: ${faceError.message}`);
      }

      // Load your beauty prediction model
      console.log("Loading beauty prediction model...");
      try {
        model = await tf.loadLayersModel("https://rebo-85.github.io/Model-Server/beauty_predict/model.json");
        console.log("Beauty prediction model loaded successfully");
      } catch (modelError) {
        console.error("Failed to load beauty model:", modelError);
        throw new Error(`Beauty model loading failed: ${modelError.message}`);
      }

      console.log("All models loaded successfully");
      isInitialized = true;

      // Update button state
      if (button) {
        button.innerHTML = "🔍 Scan Images";
        button.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
        button.disabled = false;
      }

      // Show success notification
      showNotification("Models loaded successfully! Click the button to scan images.", "success");
    } catch (error) {
      console.error("Error loading models:", error);

      // Update button state on error
      const button = document.getElementById("beautyPredictBtn");
      if (button) {
        button.innerHTML = "❌ Error - Retry";
        button.style.background = "#ff4444";
        button.disabled = false;

        // Add retry functionality
        button.onclick = async function () {
          await initializeModels();
        };
      }

      showNotification(`Failed to load models: ${error.message}`, "error");
    }
  }

  // Show notification
  function showNotification(message, type = "info") {
    // Remove existing notification
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

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  // Scan all images on the page
  async function scanAllImages() {
    if (isProcessing) {
      showNotification("Already processing images...", "info");
      return;
    }

    if (!model || !blazefaceModel) {
      showNotification("Models not loaded yet. Please wait...", "error");
      return;
    }

    isProcessing = true;

    // Update button state
    const button = document.getElementById("beautyPredictBtn");
    if (button) {
      button.innerHTML = "⏳ Scanning...";
      button.style.background = "#ffa500";
      button.disabled = true;
    }

    try {
      const images = Array.from(document.getElementsByTagName("img")).filter(
        (img) => img.width > 50 && img.height > 50 && img.naturalWidth > 0
      );

      console.log(`Found ${images.length} valid images on page`);

      let processedCount = 0;
      let facesFound = 0;

      for (let img of images) {
        const faces = await processImage(img);
        if (faces > 0) {
          facesFound += faces;
        }
        processedCount++;

        // Small delay to prevent blocking
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log("Image scanning completed");
      showNotification(`Scanned ${processedCount} images, found ${facesFound} faces`, "success");
    } catch (error) {
      console.error("Error during scanning:", error);
      showNotification(`Scanning error: ${error.message}`, "error");
    } finally {
      isProcessing = false;

      // Update button state
      if (button) {
        button.innerHTML = "🔍 Scan Again";
        button.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
        button.disabled = false;
      }
    }
  }

  // Process a single image
  async function processImage(img) {
    try {
      // Check if image has already been processed
      if (img.hasAttribute("data-beauty-processed")) {
        return 0;
      }

      // Ensure image is loaded
      if (!img.complete || img.naturalWidth === 0) {
        console.log("Image not loaded yet:", img.src);
        return 0;
      }

      // Detect faces in the image
      const predictions = await blazefaceModel.estimateFaces(img, {
        maxFaces: 10, // Increase max faces
        flipHorizontal: false,
      });

      if (predictions.length > 0) {
        console.log(`Found ${predictions.length} face(s) in image`);

        for (let i = 0; i < predictions.length; i++) {
          const detection = predictions[i];
          const beautyScore = await predictBeauty(img, detection);

          // Add overlay with beauty score
          addBeautyOverlay(img, detection, beautyScore, i);
        }

        img.setAttribute("data-beauty-processed", "true");
        return predictions.length;
      }
    } catch (error) {
      console.error("Error processing image:", error);
    }
    return 0;
  }

  // Predict beauty score for a face
  async function predictBeauty(img, detection) {
    const faceBox = detection.box;

    // Create canvas for face extraction
    const faceCanvas = document.createElement("canvas");
    faceCanvas.width = faceBox.width;
    faceCanvas.height = faceBox.height;

    const ctx = faceCanvas.getContext("2d");
    ctx.drawImage(img, faceBox.x, faceBox.y, faceBox.width, faceBox.height, 0, 0, faceBox.width, faceBox.height);

    try {
      // Preprocess image for model
      let inputTensor = tf.browser.fromPixels(faceCanvas).toFloat();
      inputTensor = tf.image.resizeBilinear(inputTensor, [224, 224]);
      inputTensor = inputTensor.div(255.0).expandDims(0);

      // Make prediction
      const prediction = model.predict(inputTensor);
      const predArr = await prediction.data();

      // Assuming the model outputs a single beauty score
      const beautyScore = predArr[0];

      // Clean up tensors to prevent memory leaks
      tf.dispose([inputTensor, prediction]);

      return beautyScore;
    } catch (error) {
      console.error("Error in prediction:", error);
      return 0;
    }
  }

  // Add overlay with beauty score on image
  function addBeautyOverlay(img, detection, beautyScore, index) {
    const faceBox = detection.box;

    // Get image position
    const imgRect = img.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Create overlay element
    const overlay = document.createElement("div");
    overlay.className = "beauty-overlay";
    overlay.style.cssText = `
      position: absolute;
      left: ${imgRect.left + faceBox.x + scrollLeft}px;
      top: ${imgRect.top + faceBox.y + scrollTop}px;
      width: ${faceBox.width}px;
      height: ${faceBox.height}px;
      border: 3px solid ${getScoreColor(beautyScore)};
      background: ${getScoreColor(beautyScore, 0.2)};
      pointer-events: none;
      z-index: 9999;
      border-radius: 5px;
    `;

    // Create score label
    const scoreLabel = document.createElement("div");
    scoreLabel.style.cssText = `
      position: absolute;
      top: -30px;
      left: 0;
      background: ${getScoreColor(beautyScore, 0.9)};
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      font-family: Arial, sans-serif;
      white-space: nowrap;
      z-index: 10000;
    `;

    // Format the beauty score
    const formattedScore = (beautyScore * 10).toFixed(1);
    scoreLabel.textContent = `Beauty: ${formattedScore}/10`;

    overlay.appendChild(scoreLabel);
    document.body.appendChild(overlay);

    // Store reference for cleanup
    if (!img.beautyOverlays) {
      img.beautyOverlays = [];
    }
    img.beautyOverlays.push(overlay);
  }

  // Get color based on beauty score
  function getScoreColor(score, alpha = 1) {
    const normalizedScore = score * 10; // Convert to 0-10 scale
    if (normalizedScore >= 8) return `rgba(76, 175, 80, ${alpha})`; // Green
    if (normalizedScore >= 6) return `rgba(255, 193, 7, ${alpha})`; // Yellow
    if (normalizedScore >= 4) return `rgba(255, 152, 0, ${alpha})`; // Orange
    return `rgba(244, 67, 54, ${alpha})`; // Red
  }

  // Clear all results
  function clearResults() {
    const overlays = document.querySelectorAll(".beauty-overlay");
    overlays.forEach((overlay) => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });

    const images = document.getElementsByTagName("img");
    for (let img of images) {
      if (img.beautyOverlays) {
        img.beautyOverlays = [];
      }
      img.removeAttribute("data-beauty-processed");
    }

    console.log("Cleared all beauty prediction results");
    showNotification("Cleared all beauty overlays", "info");
  }

  // Add clear results button next to main button
  function addClearButton() {
    const clearBtn = document.createElement("button");
    clearBtn.innerHTML = "🗑️ Clear";
    clearBtn.id = "beautyClearBtn";
    clearBtn.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 15px;
      padding: 8px 15px;
      font-size: 12px;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      transition: all 0.3s ease;
      font-family: Arial, sans-serif;
    `;

    clearBtn.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-2px)";
      this.style.background = "#5a6268";
    });

    clearBtn.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0)";
      this.style.background = "#6c757d";
    });

    clearBtn.addEventListener("click", clearResults);

    document.body.appendChild(clearBtn);
  }

  // Initialize when page loads
  window.addEventListener("load", function () {
    createBeautyPredictionButton();
    addClearButton();

    // Auto-initialize models after a short delay
    setTimeout(() => {
      initializeModels();
    }, 2000);
  });

  // Handle page changes (for SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Re-initialize if needed for SPA navigation
      setTimeout(() => {
        if (!document.getElementById("beautyPredictBtn")) {
          createBeautyPredictionButton();
          addClearButton();
          initializeModels();
        }
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
})();
