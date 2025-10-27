// ==UserScript==
// @name         Sudoku AI Solver
// @namespace    rebo.sudoku.ai
// @version      1.4
// @description  Automatically solves Sudoku puzzles using OCR and AI
// @author       ReBo
// @match        https://sudoku.com/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js
// ==/UserScript==

(function () {
  function extractCellCanvases(boardCanvas) {
    let w = boardCanvas.width,
      h = boardCanvas.height;
    let cellW = w / 9,
      cellH = h / 9;
    let canvases = [];
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        let tmp = document.createElement("canvas");
        tmp.width = 64;
        tmp.height = 64;
        let tctx = tmp.getContext("2d");
        tctx.drawImage(
          boardCanvas,
          x * cellW + cellW * 0.08,
          y * cellH + cellH * 0.08,
          cellW * 0.84,
          cellH * 0.84,
          0,
          0,
          64,
          64
        );
        canvases.push(tmp);
      }
    }
    return canvases;
  }

  async function fetchAiIconPath() {
    let res = await fetch("https://rebo-85.github.io/CDN//svg/paths/sudoku_ai_button.txt");
    if (!res.ok) return "";
    return await res.text();
  }

  async function recognizeSudokuBoard(cellCanvases) {
    let ocrTasks = cellCanvases.map((c) =>
      Tesseract.recognize(c, "eng", {
        tessedit_char_whitelist: "0123456789",
        classify_bln_numeric_mode: 1,
        tessedit_pageseg_mode: 10,
      }).then(({ data: { text } }) => {
        let digit = text.replace(/\D/g, "") || "0";
        return Number(digit[0] || 0);
      })
    );
    let flat = await Promise.all(ocrTasks);
    let board = [];
    for (let i = 0; i < 9; i++) board.push(flat.slice(i * 9, i * 9 + 9));
    return board;
  }

  function solveSudokuBoard(grid) {
    let board = grid.flat();
    function isValid(idx, val) {
      let row = Math.floor(idx / 9),
        col = idx % 9;
      for (let i = 0; i < 9; i++) {
        if (board[row * 9 + i] === val) return false;
        if (board[i * 9 + col] === val) return false;
        let boxRow = 3 * Math.floor(row / 3) + Math.floor(i / 3);
        let boxCol = 3 * Math.floor(col / 3) + (i % 3);
        if (board[boxRow * 9 + boxCol] === val) return false;
      }
      return true;
    }
    function backtrack(idx) {
      if (idx === 81) return true;
      if (board[idx] !== 0) return backtrack(idx + 1);
      for (let n = 1; n <= 9; n++) {
        if (isValid(idx, n)) {
          board[idx] = n;
          if (backtrack(idx + 1)) return true;
          board[idx] = 0;
        }
      }
      return false;
    }
    backtrack(0);
    let solved = [];
    for (let i = 0; i < 9; i++) solved.push(board.slice(i * 9, i * 9 + 9));
    return solved;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function makeKeyboardEvent(type, key, code, keyCode) {
    let ev = new KeyboardEvent(type, {
      key: key,
      code: code,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    try {
      Object.defineProperty(ev, "keyCode", { value: keyCode });
    } catch (e) {}
    try {
      Object.defineProperty(ev, "which", { value: keyCode });
    } catch (e) {}
    return ev;
  }

  async function simulateKey(key) {
    let keyMap = {
      1: ["Digit1", 49],
      2: ["Digit2", 50],
      3: ["Digit3", 51],
      4: ["Digit4", 52],
      5: ["Digit5", 53],
      6: ["Digit6", 54],
      7: ["Digit7", 55],
      8: ["Digit8", 56],
      9: ["Digit9", 57],
      ArrowLeft: ["ArrowLeft", 37],
      ArrowUp: ["ArrowUp", 38],
      ArrowRight: ["ArrowRight", 39],
      ArrowDown: ["ArrowDown", 40],
      Backspace: ["Backspace", 8],
      Delete: ["Delete", 46],
      Enter: ["Enter", 13],
      Escape: ["Escape", 27],
    };
    let [code, keyCode] = keyMap[key] || [key, key.charCodeAt(0)];
    let kd = makeKeyboardEvent("keydown", key, code, keyCode);
    let ku = makeKeyboardEvent("keyup", key, code, keyCode);
    window.dispatchEvent(kd);
    document.dispatchEvent(kd);
    if (document.activeElement) document.activeElement.dispatchEvent(kd);
    await sleep(20);
    window.dispatchEvent(ku);
    document.dispatchEvent(ku);
    if (document.activeElement) document.activeElement.dispatchEvent(ku);
    await sleep(20);
  }

  async function clickCell(boardCanvas, x, y) {
    let rect = boardCanvas.getBoundingClientRect();
    let cellWidthPx = rect.width / 9;
    let cellHeightPx = rect.height / 9;
    let centerX = rect.left + cellWidthPx * (x + 0.5);
    let centerY = rect.top + cellHeightPx * (y + 0.5);
    let el = document.elementFromPoint(centerX, centerY) || boardCanvas;
    el.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: centerX, clientY: centerY }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: centerX, clientY: centerY }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: centerX, clientY: centerY }));
    try {
      boardCanvas.tabIndex = boardCanvas.tabIndex || -1;
      boardCanvas.focus();
    } catch (e) {}
    await sleep(20);
  }

  async function writeAnswers(solved, boardCanvas, original) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        if (!original[y][x] && solved[y][x]) {
          await clickCell(boardCanvas, x, y);
          await simulateKey(solved[y][x]);
        }
      }
    }
  }

  function showStatus(message, type = "log") {
    let wrapper = document.querySelector(".game-wrapper");
    if (!wrapper) return;
    let prev = document.querySelector("#game-tip-custom");
    if (prev) prev.remove();
    let status = document.createElement("div");
    status.id = "game-tip-custom";
    status.textContent = message;
    status.className = "game-tip message";
    status.style.opacity = "0";
    status.style.transition = "opacity 0.4s";

    switch (type) {
      case "warn":
        status.style.backgroundColor = "#f28e04";
        break;
      case "error":
        status.style.backgroundColor = "#ee3131";
        break;
      default:
        break;
    }

    wrapper.appendChild(status);
    requestAnimationFrame(() => {
      status.style.opacity = "1";
      setTimeout(() => {
        status.style.opacity = "0";
        status.addEventListener(
          "transitionend",
          () => {
            status.remove();
          },
          { once: true }
        );
      }, 2400);
    });
  }

  function onLoad() {
    let controls = document.querySelector(".game-controls");
    if (controls) {
      let wrap = document.createElement("div");
      wrap.className = "game-controls-item-wrap";
      let aiBtn = document.createElement("div");
      aiBtn.className = "game-controls-item game-controls-ai";
      aiBtn.style.display = "flex";
      aiBtn.style.flexDirection = "column";
      aiBtn.style.justifyContent = "center";
      aiBtn.style.alignItems = "center";
      aiBtn.style.textAlign = "center";
      fetchAiIconPath().then((path) => {
        aiBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon-game-control" viewBox="0 0 32 32" width="32" height="32"><path fill="#325aaf" d="${path.trim()}" /></svg>`;
      });
      wrap.appendChild(aiBtn);
      controls.appendChild(wrap);
      aiBtn.onclick = async () => {
        const isPaused = document.querySelector("#pause-overlay")?.style.display === "block";
        if (isPaused) return;

        let boardCanvas = document.querySelector("#game canvas");
        if (!boardCanvas) return showStatus("👀 No Sudoku board found.", "error");

        showStatus("🔍 Processing...");
        try {
          let cellCanvases = extractCellCanvases(boardCanvas);
          let sudokuBoard = await recognizeSudokuBoard(cellCanvases);
          let solved = solveSudokuBoard(sudokuBoard);
          await writeAnswers(solved, boardCanvas, sudokuBoard);
        } catch (e) {
          console.log(e);
          showStatus("❌ Failed to solve.", "error");
        }
      };
    }
  }

  window.addEventListener("load", onLoad);
})();
