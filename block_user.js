// ==UserScript==
// @name         Block user by name
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Remove elements containing a span with specific exact text(s)
// @match        *://*.facebook.com/*
// @match        *://messenger.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const TARGET_NAMES = new Set(["Alyson Mancio Agdon", "Moreen Benavente"]);

  function removeAncestor(span) {
    if (!span) return;
    const trySelectors = ["li", "a", "div.html-div", "div"];
    for (const sel of trySelectors) {
      const el = span.closest(sel);
      if (el && el.parentElement) {
        try {
          el.remove();
          return;
        } catch (e) {
          /* ignore */
        }
      }
    }
    // Fallback: remove the span itself
    try {
      span.remove();
    } catch (e) {
      span.style.display = "none";
    }
  }

  function processNode(node) {
    if (!node) return;
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    // Check the node itself and its common child containers for matching names
    const selectors = ["span", "div", "a", "li"];
    for (const sel of selectors) {
      try {
        const list = node.matches && node.matches(sel) ? [node] : Array.from(node.querySelectorAll(sel));
        for (const el of list) {
          const txt = el.textContent && el.textContent.trim();
          if (!txt) continue;
          for (const name of TARGET_NAMES) {
            if (txt.includes(name)) {
              removeAncestor(el);
              break;
            }
          }
        }
      } catch (e) {
        /* ignore errors on some nodes */
      }
    }
  }

  // Periodic scan to catch content injected after navigation or re-render
  let scanCount = 0;
  function scanAndRemove() {
    const sel = "span,div,a,li";
    try {
      document.querySelectorAll(sel).forEach((el) => {
        const txt = el.textContent && el.textContent.trim();
        if (!txt) return;
        for (const name of TARGET_NAMES)
          if (txt.includes(name)) {
            removeAncestor(el);
            break;
          }
      });
    } catch (e) {}
    scanCount++;
    if (scanCount > 10) clearInterval(scanInterval);
  }
  const scanInterval = setInterval(scanAndRemove, 3000);

  const observer = new MutationObserver((muts) => {
    muts.forEach((m) => {
      m.addedNodes && m.addedNodes.forEach((n) => processNode(n));
    });
  });

  function start() {
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    processNode(document.body);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
