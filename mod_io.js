// ==UserScript==
// @name         Mod.io - Add "Not Yet Subscribed" Button
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a "Not yet subscribed" button next to the "My subscriptions" checkbox
// @author       ReBo
// @match        https://mod.io/g/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // Track the current filter state
  let isFilterActive = false;

  // Function to filter mods based on subscription status
  function filterMods(showOnlyUnsubscribed) {
    isFilterActive = showOnlyUnsubscribed;

    // Find all mod cards - target the parent div with specific classes
    const modCards = document.querySelectorAll(
      "div.tw-relative.tw-border-theme-3.tw-border-2.hover\\:tw-border-theme-1.tw-shadow-item-card"
    );

    console.log(`Found ${modCards.length} mod cards`);

    modCards.forEach((card) => {
      // Look for subscription indicators
      // Check for button text to determine subscription status
      const buttons = card.querySelectorAll("button span");
      let isSubscribed = false;

      // Check all button spans for "Subscribed" text
      buttons.forEach((span) => {
        const text = span.textContent.trim().toLowerCase();
        if (text === "subscribed" || text === "unsubscribe") {
          isSubscribed = true;
        }
      });

      if (showOnlyUnsubscribed) {
        // Remove/hide subscribed mods, show only unsubscribed ones
        if (isSubscribed) {
          card.style.display = "none";
        } else {
          card.style.display = "";
        }
      } else {
        // Show all mods
        card.style.display = "";
      }
    });
  }

  // Function to add the "Not yet subscribed" button
  function addNotSubscribedButton() {
    // Check if button already exists
    if (document.getElementById("not-subscribed-btn")) {
      return true;
    }

    // Find the "My subscriptions" checkbox container by text content
    const labels = document.querySelectorAll("label");
    let mySubscriptionsLabel = null;

    for (let label of labels) {
      if (label.textContent.trim() === "My subscriptions") {
        mySubscriptionsLabel = label;
        break;
      }
    }

    if (!mySubscriptionsLabel) {
      console.log("My subscriptions label not found, retrying...");
      return false;
    }

    // Get the parent container (the div.tw-flex.tw-flex-col wrapper)
    const mySubscriptionsWrapper = mySubscriptionsLabel.closest(".tw-flex.tw-flex-col");

    if (!mySubscriptionsWrapper) {
      console.log("My subscriptions wrapper not found, retrying...");
      return false;
    }

    // Create the new button (without wrapper div)
    const notSubscribedLabel = document.createElement("label");
    notSubscribedLabel.id = "not-subscribed-btn";
    notSubscribedLabel.className =
      "tw-flex tw-items-center tw-group tw-button-transition tw-relative tw-font-medium tw-cursor-auto focus-within:tw-text-theme tw-opacity-90 hover:tw-opacity-100 focus-within:tw-opacity-100 focus-within:tw-text-primary tw-cursor-pointer tw-global--border-radius tw-mt-2";

    notSubscribedLabel.innerHTML = `
                <input class="tw-absolute tw-opacity-0 tw-size-0" type="checkbox" tabindex="0">
                <span data-testid="" class="tw-flex tw-items-center tw-justify-center tw-shrink-0 tw-button-transition tw-bg-theme-text tw-opacity-20 group-hover:tw-opacity-50 group-focus:tw-opacity-50 tw-size-5 tw-rounded tw-mr-3 last:tw-mr-0">
                    <svg class="svg-inline--fa fa-check tw-size-4" aria-hidden="true" focusable="false" role="img" viewBox="0 0 512 512" style="display: none;">
                        <path fill="currentColor" d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"></path>
                    </svg>
                </span>
                <span class="">Not yet subscribed</span>
        `;

    // Insert the button after the "My subscriptions" label (inside the same wrapper)
    mySubscriptionsLabel.insertAdjacentElement("afterend", notSubscribedLabel);

    // Get references to both checkboxes and their elements
    const notSubscribedCheckbox = notSubscribedLabel.querySelector('input[type="checkbox"]');
    const notSubscribedIcon = notSubscribedLabel.querySelector("svg");
    const notSubscribedSpan = notSubscribedLabel.querySelector("span[data-testid]");

    const mySubscriptionsCheckbox = mySubscriptionsLabel.querySelector('input[type="checkbox"]');
    const mySubscriptionsIcon = mySubscriptionsLabel.querySelector("svg");
    const mySubscriptionsSpan = mySubscriptionsLabel.querySelector("span[data-testid]");

    // Function to update checkbox visual state
    function updateCheckboxState(checkbox, span, icon, isChecked) {
      checkbox.checked = isChecked;
      if (isChecked) {
        span.className =
          "tw-flex tw-items-center tw-justify-center tw-shrink-0 tw-button-transition tw-bg-primary tw-text-primary-text tw-size-5 tw-rounded tw-mr-3 last:tw-mr-0";
        if (icon) icon.style.display = "block";
      } else {
        span.className =
          "tw-flex tw-items-center tw-justify-center tw-shrink-0 tw-button-transition tw-bg-theme-text tw-opacity-20 group-hover:tw-opacity-50 group-focus:tw-opacity-50 tw-size-5 tw-rounded tw-mr-3 last:tw-mr-0";
        if (icon) icon.style.display = "none";
      }
    }

    // Add click handler for "Not yet subscribed" button (radio button behavior)
    notSubscribedCheckbox.addEventListener("change", function () {
      if (this.checked) {
        // Uncheck "My subscriptions"
        updateCheckboxState(mySubscriptionsCheckbox, mySubscriptionsSpan, mySubscriptionsIcon, false);
        updateCheckboxState(notSubscribedCheckbox, notSubscribedSpan, notSubscribedIcon, true);
        console.log("Not yet subscribed filter enabled");
        filterMods(true); // Hide subscribed mods
      } else {
        updateCheckboxState(notSubscribedCheckbox, notSubscribedSpan, notSubscribedIcon, false);
        console.log("Not yet subscribed filter disabled");
        filterMods(false); // Show all mods
      }
    });

    // Add click handler for "My subscriptions" button (radio button behavior)
    mySubscriptionsCheckbox.addEventListener("change", function () {
      if (this.checked) {
        // Uncheck "Not yet subscribed"
        updateCheckboxState(notSubscribedCheckbox, notSubscribedSpan, notSubscribedIcon, false);
        updateCheckboxState(mySubscriptionsCheckbox, mySubscriptionsSpan, mySubscriptionsIcon, true);
        console.log("My subscriptions filter enabled");
        filterMods(false); // Show all mods (let native filter handle subscriptions)
      } else {
        updateCheckboxState(mySubscriptionsCheckbox, mySubscriptionsSpan, mySubscriptionsIcon, false);
        console.log("My subscriptions filter disabled");
        filterMods(false); // Show all mods
      }
    });

    console.log("Not yet subscribed button added successfully");
    return true;
  }

  // Wait for the page to load and retry if necessary
  function init() {
    if (addNotSubscribedButton()) {
      console.log("Initialization complete");
    } else {
      // Retry after a short delay
      setTimeout(init, 500);
    }
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Also watch for dynamic content changes
  const observer = new MutationObserver(function (mutations) {
    // Re-add the button if it disappears
    if (!document.getElementById("not-subscribed-btn")) {
      addNotSubscribedButton();
    }

    // Re-apply filter to newly loaded cards
    if (isFilterActive) {
      filterMods(true);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
