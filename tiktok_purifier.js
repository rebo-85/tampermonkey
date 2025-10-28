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
      name: "LIVE posts",
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
    ads: {
      name: "Sponsored ads",
      enabled: false,
      icon: `<path d="M24 4a20 20 0 1 0 0 40 20 20 0 0 0 0-40Zm0 36a16 16 0 1 1 0-32 16 16 0 0 1 0 32Z"></path>`,
      shapeOn: `<path d="M16 24h16v4H16z"></path>`,
      shapeOff: `<path d="M12 22h24v4H12z"></path>`,
      check: (el) => /Sponsored/i.test(el.innerText),
      apply: (el) => (el.style.display = "none"),
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

  // === UI: toggle buttons container ===
  const insertToggles = (container) => {
    const wrapper = document.createElement("div");
    wrapper.id = "purifier-wrapper";
    wrapper.className = "css-1q7o284-5e6d46e3--DivActionBarContainer egvv9qt0";
    wrapper.style.display = "flex";
    wrapper.style.gap = "8px";

    Object.entries(filters).forEach(([key, f]) => {
      const tooltipRef = document.createElement("div");
      tooltipRef.className = "TUXTooltip-reference";
      tooltipRef.style.position = "relative";

      const btn = document.createElement("button");
      btn.className = "css-3vadej-5e6d46e3--StyledActionBarButton egvv9qt3";
      btn.innerHTML = `
        <div class="css-2kvp9s-5e6d46e3--StyledIconWrapper egvv9qt2">
          <svg fill="currentColor" viewBox="0 0 48 48" width="1em" height="1em">
            ${f.icon}
            ${f.enabled ? f.shapeOn : f.shapeOff}
          </svg>
        </div>`;

      let portal = document.querySelector("[data-floating-ui-portal]");
      if (!portal) {
        portal = document.createElement("div");
        portal.setAttribute("data-floating-ui-portal", "");
        document.body.appendChild(portal);
      }

      const tooltip = document.createElement("div");
      tooltip.className = "TUXTooltip-tooltip TUXTooltip-tooltip--secondary TUXTooltip-tooltip--small";
      tooltip.setAttribute("tabindex", "-1");
      tooltip.setAttribute("role", "tooltip");
      tooltip.style.zIndex = "4500";
      tooltip.style.position = "absolute";
      tooltip.style.left = "0px";
      tooltip.style.top = "0px";
      tooltip.style.transform = "translate(0, 36px)";
      tooltip.style.display = "none";

      const tooltipContent = document.createElement("div");
      tooltipContent.className = "TUXTooltip-content P1-Medium";

      const tooltipText = document.createElement("p");
      tooltipText.className =
        "TUXText TUXText--tiktok-sans TUXText--weight-medium css-16xepmg-5e6d46e3--StyledTUXText e1gw1eda0";
      tooltipText.setAttribute("letter-spacing", "0.0938");
      tooltipText.style.color = "inherit";
      tooltipText.style.fontSize = "14px";
      tooltipText.textContent = `${f.name}: ${f.enabled ? "ON" : "OFF"}`;

      tooltipContent.appendChild(tooltipText);
      tooltip.appendChild(tooltipContent);

      btn.onclick = () => {
        f.enabled = !f.enabled;
        const path = btn.querySelector("path:last-of-type");
        path.setAttribute("d", f.enabled ? getPathData(f.shapeOn) : getPathData(f.shapeOff));
        tooltipText.textContent = `${f.name}: ${f.enabled ? "ON" : "OFF"}`;
        log(`${f.enabled ? "✅ Enabled" : "🚫 Disabled"} ${f.name}`);
      };

      btn.addEventListener("mouseenter", (e) => {
        const rect = btn.getBoundingClientRect();
        tooltip.style.left = rect.left + window.scrollX + "px";
        tooltip.style.top = rect.bottom + window.scrollY + "px";
        tooltip.style.transform = `translate(0, 0)`;
        tooltip.style.display = "block";
        portal.appendChild(tooltip);
      });
      btn.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
        if (portal.contains(tooltip)) portal.removeChild(tooltip);
      });

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
