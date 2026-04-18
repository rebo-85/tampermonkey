// ==UserScript==
// @name         Block user (contacts final stable)
// @namespace    http://tampermonkey.net/
// @version      0.7
// @match        *://*.facebook.com/*
// @match        *://messenger.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const TARGET_NAMES = ["Alyson Mancio Agdon"];

  function shouldRemove(anchor) {
    const label = anchor.getAttribute("aria-label");
    if (!label) return false;

    return TARGET_NAMES.some(name => label.startsWith(name));
  }

  function removeEntry(anchor) {
    anchor.remove();
  }

  function scan(root) {
    root.querySelectorAll('a[href^="/messages/t/"]').forEach((a) => {
      if (shouldRemove(a)) removeEntry(a);
    });
  }

  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          if (n.matches?.('a[href^="/messages/t/"]')) {
            if (shouldRemove(n)) removeEntry(n);
          }
          scan(n);
        }
      }
    }
  });

  function start() {
    observer.observe(document.body, { childList: true, subtree: true });
    scan(document.body);
  }

  start();
})();