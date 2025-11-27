// ==UserScript==
// @name         TikTok Purifier
// @namespace    rebo.tiktok.purifier
// @version      2.2
// @description  Modular TikTok enhancer that filters unwanted content (LIVE, Ads, etc.) and gives full control over your FYP.
// @author       ReBo
// @match        https://www.tiktok.com/*
// @grant        GM_xmlhttpRequest
// @connect      rebo-85.github.io
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
      iconOn: "https://rebo-85.github.io/CDN/svg/paths/tiktok_purifier/livestream/on.txt",
      iconOff: "https://rebo-85.github.io/CDN/svg/paths/tiktok_purifier/livestream/off.txt",
      check: (el) => el.querySelector('[class*="DivLiveTag"]'),
      apply: (el) => {
        el.style.display = "none";
        el.style.pointerEvents = "none";
        el.style.height = "0";
        el.style.margin = "0";
      },
    },
    sponsor: {
      name: "Sponsor Filter",
      enabled: true,
      iconOn: "https://rebo-85.github.io/CDN/svg/paths/tiktok_purifier/sponsor/on.txt",
      iconOff: "https://rebo-85.github.io/CDN/svg/paths/tiktok_purifier/sponsor/off.txt",
      check: (el) => !!el.querySelector('div[data-e2e="sponsored-tag"]'),
      apply: (el) => {
        el.style.display = "none";
        el.style.pointerEvents = "none";
        el.style.height = "0";
        el.style.margin = "0";
      },
    },
  };

  // === Filtering Engine ===
  function runFilters() {
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
  }

  // === Mutation observer ===
  const observer = new MutationObserver(runFilters);
  observer.observe(document.body, { childList: true, subtree: true });
  runFilters();

  // === Fetch-safe SVG loader ===
  const getSvgPathData = (filter) => {
    return new Promise((resolve) => {
      const val = filter.enabled ? filter.iconOn : filter.iconOff;
      if (val.startsWith("M")) return resolve(val);
      GM_xmlhttpRequest({
        method: "GET",
        url: val,
        onload: (res) => resolve(res.responseText.trim()),
        onerror: () => resolve(""),
      });
    });
  };

  // === Proper button cloning logic ===
  const insertToggles = (container) => {
    // Try to find a direct child div of #top-right-action-bar as the base container
    let baseContainer = container.querySelector("div");
    // Fallback: try to find any div with class containing 'DivActionBarContainer'
    if (!baseContainer) baseContainer = container.querySelector("div[class*='DivActionBarContainer']");
    if (!baseContainer) return log("❌ No reference button container found (check selector).");

    const purifierGroup = document.createElement("div");
    purifierGroup.className = "tiktok-purifier-group";
    purifierGroup.style.display = "flex";
    purifierGroup.style.alignItems = "center";
    purifierGroup.style.gap = "4px";

    const buttonPromises = Object.entries(filters).map(([key, f]) => {
      if (purifierGroup.querySelector(`[data-purifier="${key}"]`)) return Promise.resolve();

      return (async () => {
        const newContainer = baseContainer.cloneNode(true);
        const btn = newContainer.querySelector("button");
        let label = newContainer.querySelector("span");

        btn.dataset.purifier = key;
        if (label) label.textContent = f.name;

        const svg = btn.querySelector("svg");
        if (svg) {
          while (svg.firstChild) svg.removeChild(svg.firstChild);
          const freshPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
          const svgPathData = await getSvgPathData(f);
          freshPath.setAttribute("d", svgPathData);
          svg.appendChild(freshPath);
        }

        btn.onclick = async () => {
          f.enabled = !f.enabled;
          const svgPathData = await getSvgPathData(f);
          const svg = btn.querySelector("svg");
          const path = svg && svg.querySelector("path");
          path.setAttribute("d", svgPathData);
          svg.setAttribute("width", "20");
          svg.setAttribute("height", "20");
          svg.setAttribute("viewBox", "0 0 50 50");

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
              tooltipText.style.color = "inherit";
              tooltipText.style.fontSize = "14px";
              tooltipText.style.whiteSpace = "nowrap";
              tooltipText.textContent = f.name;

              tooltipContent.appendChild(tooltipText);
              tooltip.appendChild(tooltipContent);
              btn.appendChild(tooltip);

              btn.onmouseenter = () => (tooltip.style.display = "block");
              btn.onmouseleave = () => (tooltip.style.display = "none");
            }
          } else {
            const tip = btn.querySelector(".TUXTooltip-tooltip");
            if (tip) tip.remove();
            if (!label) {
              const newLabel = document.createElement("span");
              newLabel.style.whiteSpace = "nowrap";
              newLabel.textContent = f.name;
              btn.appendChild(newLabel);
              label = newLabel;
            }
          }
        };

        const resizeObserver = new ResizeObserver(syncLabel);
        resizeObserver.observe(container);
        syncLabel();

        purifierGroup.appendChild(newContainer);
      })();
    });

    Promise.all(buttonPromises).then(() => {
      const customDivider = document.createElement("div");
      customDivider.className = "css-1bca0o4-5e6d46e3--DivVerticalDivider e1uvg3ki6";
      purifierGroup.appendChild(customDivider);
      container.insertBefore(purifierGroup, container.firstChild);
      log("Purifier buttons injected between profile and TikTok buttons 🧬");
    });
  };

  // === Wait for TikTok UI ===
  const uiCheck = setInterval(() => {
    const actionBar = document.querySelector("#top-right-action-bar");
    if (actionBar && actionBar.querySelector("div[class*='DivActionBarContainer']")) {
      clearInterval(uiCheck);
      insertToggles(actionBar);
      log("TikTok Purifier initialized 🚀");
    }
  }, 500);
})();
