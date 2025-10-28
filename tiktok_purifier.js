// ==UserScript==
// @name         TikTok Purifier
// @namespace    rebo.tiktok.purifier
// @version      2.0
// @description  Modular TikTok enhancer that filters unwanted content (LIVE, Ads, etc.) and gives full control over your FYP.
// @author       ReBo
// @match        https://www.tiktok.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // === Utility logger ===
  const log = (msg, type = "info") => {
    const prefix = "%c[TikTok Purifier]%c ";
    const styles = ["color:#8B5CF6;font-weight:bold;", "color:inherit;"];
    console[type === "warn" ? "warn" : type === "error" ? "error" : "log"](prefix + msg, ...styles);
  };

  // === Core state ===
  const filters = {
    live: {
      name: "filter LIVE posts",
      enabled: true,
      icon: `<path d="M24 4a20 20 0 1 0 0 40 20 20 0 0 0 0-40Zm0 36a16 16 0 1 1 0-32 16 16 0 0 1 0 32Z"></path>`,
      shapeOn: `<path d="M17 17h14v14H17z"></path>`,
      shapeOff: `<path d="M12 22h24v4H12z"></path>`,
      check: (el) => el.querySelector('[class*="DivLiveTag"]'),
      apply: (el) => {
        el.style.display = "none";
        el.style.pointerEvents = "none";
        el.style.height = "0";
        el.style.margin = "0";
      },
    },
  };

  // === Core filtering engine ===
  const runFilters = () => {
    const columnList = document.querySelector("#column-list-container");
    if (!columnList) return;

    const articles = Array.from(columnList.querySelectorAll("article[data-scroll-index]"));
    for (const article of articles) {
      if (article.dataset.purified) continue;

      for (const [key, f] of Object.entries(filters)) {
        if (f.enabled && f.check(article)) {
          f.apply(article);
          article.dataset.purified = key;
          log(`🧹 Removed ${f.name}`);
          break;
        }
      }
    }

    // Reindex
    columnList
      .querySelectorAll("article[data-scroll-index]")
      .forEach((el, i) => el.setAttribute("data-scroll-index", i));
  };

  // === Observe mutations ===
  const observer = new MutationObserver(runFilters);
  observer.observe(document.body, { childList: true, subtree: true });
  runFilters();
  log("Observer active");

  // === UI: toggle buttons container ===
  const insertToggles = (container) => {
    const wrapper = document.createElement("div");
    wrapper.id = "purifier-wrapper";
    wrapper.className = "css-1q7o284-5e6d46e3--DivActionBarContainer egvv9qt0";

    Object.entries(filters).forEach(([key, f]) => {
      const tooltipRef = document.createElement("div");
      tooltipRef.className = "TUXTooltip-reference";

      const btn = document.createElement("button");
      btn.className = "css-3vadej-5e6d46e3--StyledActionBarButton egvv9qt3";
      btn.type = "button";
      btn.setAttribute("data-purifier-toggle", key);
      btn.setAttribute("data-e2e", "top-right-action-bar-get-coin");

      const iconWrap = document.createElement("div");
      iconWrap.className = "css-2kvp9s-5e6d46e3--StyledIconWrapper egvv9qt2";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("fill", "currentColor");
      svg.setAttribute("color", "inherit");
      svg.setAttribute("font-size", "16");
      svg.setAttribute("viewBox", "0 0 48 48");
      svg.setAttribute("width", "1em");
      svg.setAttribute("height", "1em");
      svg.innerHTML = f.icon;
      iconWrap.appendChild(svg);

      const label = document.createElement("span");
      label.className = "css-q269t6-5e6d46e3--StyledSpan egvv9qt1";
      label.textContent = f.name;

      btn.appendChild(iconWrap);
      btn.appendChild(label);
      btn.onclick = () => {
        f.enabled = !f.enabled;
        btn.classList.toggle("purifier-off", !f.enabled);
        runFilters();
      };

      tooltipRef.appendChild(btn);
      wrapper.appendChild(tooltipRef);
    });
    container.prepend(wrapper);
    log("UI toggles injected");
  };
  // === Helper: extract path data from SVG string ===
  const getPathData = (svgString) => {
    const match = svgString.match(/d="([^"]+)"/);
    return match ? match[1] : "";
  };

  // === Wait for TikTok UI ===
  const uiCheck = setInterval(() => {
    const actionBar = document.querySelector("#top-right-action-bar");
    if (actionBar) {
      clearInterval(uiCheck);
      insertToggles(actionBar);
      log("TikTok Purifier initialized 🚀");
    }
  }, 500);
})();
