// ==UserScript==
// @name         TikTok Purifier
// @namespace    rebo.tiktok.purifier
// @version      1.3
// @description  A powerful TikTok enhancer that filters unwanted content and provides advanced FYP control tools.
// @author       ReBo
// @match        https://www.tiktok.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const log = (...msg) => console.log("[TikTok Purifier]:", ...msg);

  let enabled = true;

  // === Core live remover ===
  const removeLives = () => {
    if (!enabled) return;
    document.querySelectorAll("article").forEach((article) => {
      if (!article.dataset.noliveChecked && article.querySelector('[class*="DivLiveTag"]')) {
        article.dataset.noliveChecked = "true";
        article.remove();
        log("🧹 Removed LIVE article");
      }
    });
  };

  const observer = new MutationObserver(removeLives);
  observer.observe(document.body, { childList: true, subtree: true });
  removeLives();

  // === Action Button Manager ===
  const actionButtons = [];

  const createActionButton = ({ id, enabled, iconPathOn, iconPathOff, labelOn, labelOff, onToggle }) => {
    const wrapper = document.createElement("div");
    wrapper.className = "css-1q7o284-5e6d46e3--DivActionBarContainer egvv9qt0";

    const tooltipRef = document.createElement("div");
    tooltipRef.className = "TUXTooltip-reference";

    const btn = document.createElement("button");
    btn.id = id;
    btn.className = "css-3vadej-5e6d46e3--StyledActionBarButton egvv9qt3";
    btn.innerHTML = `
      <div class="css-2kvp9s-5e6d46e3--StyledIconWrapper egvv9qt2">
        <svg fill="currentColor" color="inherit" font-size="16" viewBox="0 0 48 48" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 4a20 20 0 1 0 0 40 20 20 0 0 0 0-40Zm0 36a16 16 0 1 1 0-32 16 16 0 0 1 0 32Z"></path>
          <path d="${enabled ? iconPathOn : iconPathOff}"></path>
        </svg>
      </div>`;

    const tooltip = document.createElement("div");
    tooltip.className = "TUXTooltip TUXTooltip--top";
    tooltip.setAttribute("role", "tooltip");
    tooltip.style.position = "absolute";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.textContent = enabled ? labelOn : labelOff;
    tooltip.hidden = true;

    btn.onclick = () => {
      enabled = !enabled;
      const svg = btn.querySelector("svg path:last-of-type");
      if (svg) svg.setAttribute("d", enabled ? iconPathOn : iconPathOff);
      tooltip.textContent = enabled ? labelOn : labelOff;
      log(enabled ? `${labelOn}` : `${labelOff}`);
      onToggle(enabled);
    };

    btn.addEventListener("mouseenter", () => (tooltip.hidden = false));
    btn.addEventListener("mouseleave", () => (tooltip.hidden = true));

    tooltipRef.appendChild(btn);
    tooltipRef.appendChild(tooltip);
    wrapper.appendChild(tooltipRef);
    return wrapper;
  };

  const insertButtons = () => {
    const container = document.querySelector("#top-right-action-bar");
    if (!container) return;

    container.querySelectorAll(".rebo-action").forEach((e) => e.remove());

    actionButtons.forEach((btn) => {
      const element = createActionButton(btn);
      element.classList.add("rebo-action");
      container.prepend(element);
    });
  };

  // === Define Buttons ===
  actionButtons.push({
    id: "nolive-toggle",
    enabled: true,
    iconPathOn: "M17 17h14v14H17z",
    iconPathOff: "M12 22h24v4H12z",
    labelOn: "LIVE filter: ON",
    labelOff: "LIVE filter: OFF",
    onToggle: (state) => (enabled = state),
  });

  // === Wait for container ===
  const waitForContainer = setInterval(() => {
    const container = document.querySelector("#top-right-action-bar");
    if (container) {
      clearInterval(waitForContainer);
      insertButtons();
      log("🎛️ Buttons injected successfully");
    }
  }, 500);
})();
