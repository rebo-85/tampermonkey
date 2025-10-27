// ==UserScript==
// @name         Sudoku AI Solver
// @namespace    rebo.sudoku.ai
// @version      1.4
// @description  Automatically solves Sudoku puzzles using OCR and AI (writes solution using keyboard simulation)
// @author       ReBo
// @match        https://sudoku.com/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js
// ==/UserScript==

window.addEventListener("load", function () {
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

  let btn = document.createElement("button");
  btn.textContent = "🧠 AI Solve";
  btn.style.position = "fixed";
  btn.style.top = "20px";
  btn.style.right = "20px";
  btn.style.zIndex = 10000;
  btn.style.padding = "12px 20px";
  btn.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
  btn.style.color = "white";
  btn.style.border = "none";
  btn.style.borderRadius = "8px";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "14px";
  btn.style.fontWeight = "600";
  btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  btn.style.transition = "all 0.3s ease";

  let statusPanel = document.createElement("div");
  statusPanel.style.position = "fixed";
  statusPanel.style.top = "70px";
  statusPanel.style.right = "20px";
  statusPanel.style.zIndex = 10001;
  statusPanel.style.background = "rgba(34, 34, 34, 0.95)";
  statusPanel.style.color = "white";
  statusPanel.style.padding = "16px";
  statusPanel.style.borderRadius = "12px";
  statusPanel.style.display = "none";
  statusPanel.textContent = "Processing...";

  document.body.appendChild(btn);
  document.body.appendChild(statusPanel);

  btn.onclick = async () => {
    let boardCanvas = document.querySelector("#game canvas");
    if (!boardCanvas) return alert("No Sudoku board found.");
    statusPanel.style.display = "block";
    try {
      let cellCanvases = extractCellCanvases(boardCanvas);
      let sudokuBoard = await recognizeSudokuBoard(cellCanvases);
      let solved = solveSudokuBoard(sudokuBoard);
      await writeAnswers(solved, boardCanvas, sudokuBoard);
      statusPanel.style.display = "none";
    } catch (e) {
      console.error(e);
      statusPanel.style.display = "none";
      alert("❌ Failed to solve.");
    }
  };
});
