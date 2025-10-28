// ==UserScript==
// @name         TikTok Purifier
// @namespace    rebo.tiktok.purifier
// @version      2.1
// @description  Modular TikTok enhancer that filters unwanted content (LIVE, Ads, etc.) and gives full control over your FYP.
// @author       ReBo
// @match        https://www.tiktok.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // === Logger ===
  const log = (msg, type = "info") => {
    const prefix = "%c[TikTok Purifier]%c ";
    const styles = ["color:#8B5CF6;font-weight:bold;", "color:inherit;"];
    console[type === "warn" ? "warn" : type === "error" ? "error" : "log"](prefix + msg, ...styles);
  };

  // === Core state ===
  const filters = {
    live: {
      name: "LIVE Filter",
      enabled: true,
      iconOn: "M17 17h14v14H17z",
      iconOff: "M12 22h24v4H12z",
      check: (el) => el.querySelector('[class*="DivLiveTag"]'),
      apply: (el) => {
        el.style.display = "none";
        el.style.pointerEvents = "none";
        el.style.height = "0";
        el.style.margin = "0";
      },
    },
  };

  // === Filtering Engine ===
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

    columnList
      .querySelectorAll("article[data-scroll-index]")
      .forEach((el, i) => el.setAttribute("data-scroll-index", i));
  };

  // === Mutation observer ===
  const observer = new MutationObserver(runFilters);
  observer.observe(document.body, { childList: true, subtree: true });
  runFilters();

  // === Proper button cloning logic ===
  const insertToggles = (container) => {
    const baseContainer = container.querySelector(".css-1q7o284-5e6d46e3--DivActionBarContainer");
    if (!baseContainer) return log("❌ No reference button container found.");

    Object.entries(filters).forEach(([key, f]) => {
      if (container.querySelector(`[data-purifier="${key}"]`)) return;

      const newContainer = baseContainer.cloneNode(true);
      const btn = newContainer.querySelector("button");
      let label = newContainer.querySelector("span");

      btn.dataset.purifier = key;
      if (label) label.textContent = f.name;

      const svg = btn.querySelector("svg");
      if (svg) {
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        const freshPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        freshPath.setAttribute("d", f.enabled ? f.iconOn : f.iconOff);
        svg.appendChild(freshPath);
      }

      btn.onclick = () => {
        f.enabled = !f.enabled;
        const svg = btn.querySelector("svg");
        const path = svg && svg.querySelector("path");
        if (path) path.setAttribute("d", f.enabled ? f.iconOn : f.iconOff);
        runFilters();
        log(`${f.enabled ? "✅ Enabled" : "🚫 Disabled"} ${f.name}`);
      };

      const syncLabel = () => {
        const origSpan = baseContainer.querySelector("span");
        label = newContainer.querySelector("span");
        if (!origSpan) {
          if (label && label.parentNode) label.remove();
          let tooltip = btn.querySelector(".TUXTooltip-tooltip");
          if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.className = "TUXTooltip-tooltip TUXTooltip-tooltip--secondary TUXTooltip-tooltip--small";
            tooltip.setAttribute("tabindex", "-1");
            tooltip.setAttribute("role", "tooltip");
            tooltip.style.zIndex = "4500";
            tooltip.style.position = "absolute";
            tooltip.style.left = "50%";
            tooltip.style.top = "0px";
            tooltip.style.transform = "translate(-50%, 40px)";
            tooltip.style.display = "none";
            const tooltipContent = document.createElement("div");
            tooltipContent.className = "TUXTooltip-content P1-Medium";
            const tooltipText = document.createElement("p");
            tooltipText.className =
              "TUXText TUXText--tiktok-sans TUXText--weight-medium css-16xepmg-5e6d46e3--StyledTUXText e1gw1eda0";
            tooltipText.setAttribute("letter-spacing", "0.0938");
            tooltipText.style.color = "inherit";
            tooltipText.style.fontSize = "14px";
            tooltipText.style.whiteSpace = "nowrap";
            tooltipText.textContent = `${f.name}: ${f.enabled ? "ON" : "OFF"}`;
            tooltipContent.appendChild(tooltipText);
            tooltip.appendChild(tooltipContent);
            btn.appendChild(tooltip);
            btn.onmouseenter = () => {
              tooltip.style.display = "block";
            };
            btn.onmouseleave = () => {
              tooltip.style.display = "none";
            };
          }
        } else {
          const tip = btn.querySelector(".TUXTooltip-tooltip");
          if (tip) tip.remove();
          if (!label) {
            const newLabel = document.createElement("span");
            newLabel.textContent = f.name;
            btn.appendChild(newLabel);
            label = newLabel;
          }
        }
      };

      const spanObserver = new MutationObserver(syncLabel);
      spanObserver.observe(baseContainer, { childList: true, subtree: true });

      syncLabel();

      const divider = container.querySelector(".css-1bca0o4-5e6d46e3--DivVerticalDivider");
      if (divider) container.insertBefore(newContainer, divider);
      else container.appendChild(newContainer);
    });

    log("Purifier buttons cloned with full TikTok structure 🧬");
  };

  // === Wait for TikTok UI ===
  const uiCheck = setInterval(() => {
    const actionBar = document.querySelector("#top-right-action-bar");
    if (actionBar && actionBar.querySelector(".css-1q7o284-5e6d46e3--DivActionBarContainer")) {
      clearInterval(uiCheck);
      insertToggles(actionBar);
      log("TikTok Purifier initialized 🚀");
    }
  }, 500);
})();
