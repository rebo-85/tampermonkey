// ==UserScript==
// @name         Pencil Hold Toggle
// @namespace    rebo.hotkey
// @version      1.1
// @description  Hold Ctrl to enable pencil mode; release to disable
// @match        https://sudoku.com/*
// @grant        none
// ==/UserScript==

window.addEventListener("load", function () {
  let isHolding = false;
  let act = getAct();
  const sel = '.game-controls-item.game-controls-pencil[data-action="pencil"]';
  const btn = document.querySelector(sel);
  function getAct() {
    const btn = document.querySelector(".game-controls .game-controls-pencil");
    if (!btn) return null;
    const sty = window.getComputedStyle(btn, "::after");
    const con = sty.getPropertyValue("content");
    return con === '"ON"';
  }
  function clk() {
    ["mousedown", "mouseup", "click"].forEach((t) =>
      btn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }))
    );
  }

  if (!btn) {
    alert("Pencil Hold Toggle: Pencil button element not found.");
    return;
  }

  btn.title = "Hold Shift to toggle pencil mode";

  if (!act) clk();

  document.addEventListener("keydown", (e) => {
    if (e.shiftKey && !isHolding) {
      isHolding = true;

      const act = getAct();
      if (!act) return;

      clk();
    }
  });

  document.addEventListener("keyup", (e) => {
    if (!e.shiftKey && isHolding) {
      isHolding = false;

      const act = getAct();
      if (act) return;

      clk();
    }
  });
});
