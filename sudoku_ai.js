// ==UserScript==
// @name         Sudoku AI Solver
// @namespace    rebo.sudoku.ai
// @version      1.2
// @description  Automatically solves Sudoku puzzles using OCR and AI
// @author       ReBo
// @match        https://sudoku.com/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@5.0.1/dist/tesseract.min.js
// ==/UserScript==

window.addEventListener("load", function () {
  function extractCellCanvases(canvas) {
    let w = canvas.width,
      h = canvas.height;
    let cellW = w / 9,
      cellH = h / 9;
    let canvases = [];
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        let tmp = document.createElement("canvas");
        tmp.width = 32;
        tmp.height = 32;
        let tctx = tmp.getContext("2d");
        tctx.drawImage(
          canvas,
          x * cellW + cellW * 0.18,
          y * cellH + cellH * 0.18,
          cellW * 0.64,
          cellH * 0.64,
          0,
          0,
          32,
          32
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

  // Sudoku solver (minimal, adapted)
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

  // Create main button
  let btn = document.createElement("button");
  btn.textContent = "📷 OCR Sudoku";
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

  btn.onmouseenter = () => {
    btn.style.transform = "translateY(-2px)";
    btn.style.boxShadow = "0 6px 16px rgba(0,0,0,0.4)";
  };
  btn.onmouseleave = () => {
    btn.style.transform = "translateY(0)";
    btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  };

  // Create status panel
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
  statusPanel.style.minWidth = "200px";
  statusPanel.style.backdropFilter = "blur(10px)";
  statusPanel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)";
  statusPanel.style.border = "1px solid rgba(255,255,255,0.1)";

  // Status content
  let statusContent = document.createElement("div");
  statusContent.style.display = "flex";
  statusContent.style.alignItems = "center";
  statusContent.style.gap = "12px";

  let spinner = document.createElement("div");
  spinner.style.width = "20px";
  spinner.style.height = "20px";
  spinner.style.border = "2px solid rgba(255,255,255,0.3)";
  spinner.style.borderTop = "2px solid white";
  spinner.style.borderRadius = "50%";
  spinner.style.animation = "spin 1s linear infinite";

  let statusText = document.createElement("span");
  statusText.textContent = "Processing board...";
  statusText.style.fontSize = "14px";
  statusText.style.fontWeight = "500";

  statusContent.appendChild(spinner);
  statusContent.appendChild(statusText);
  statusPanel.appendChild(statusContent);

  // Add CSS for spinner animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  btn.onclick = async () => {
    let boardCanvas = document.querySelector("#game canvas");
    if (!boardCanvas) {
      showNotification("❌ No game board found!", "error");
      return;
    }

    // Show processing status
    statusPanel.style.display = "block";

    try {
      let cellCanvases = extractCellCanvases(boardCanvas);
      let sudokuBoard = await recognizeSudokuBoard(cellCanvases);
      let solved = solveSudokuBoard(sudokuBoard);

      // Hide status
      statusPanel.style.display = "none";

      console.log("Sudoku solved board:", solved);
      showNotification("✅ Sudoku solved!", "success");
    } catch (error) {
      statusPanel.style.display = "none";
      showNotification("❌ OCR failed! Try again.", "error");
      console.error("OCR Error:", error);
    }
  };

  function showNotification(message, type) {
    // Remove existing notification if any
    const existingNotif = document.querySelector(".sudoku-notification");
    if (existingNotif) {
      existingNotif.remove();
    }

    const notif = document.createElement("div");
    notif.className = "sudoku-notification";
    notif.textContent = message;
    notif.style.position = "fixed";
    notif.style.top = "20px";
    notif.style.left = "50%";
    notif.style.transform = "translateX(-50%)";
    notif.style.background = type === "error" ? "#e74c3c" : "#2ecc71";
    notif.style.color = "white";
    notif.style.padding = "12px 24px";
    notif.style.borderRadius = "8px";
    notif.style.zIndex = 10003;
    notif.style.fontWeight = "500";
    notif.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
    notif.style.transition = "all 0.3s ease";

    document.body.appendChild(notif);

    setTimeout(() => {
      notif.style.opacity = "0";
      notif.style.transform = "translateX(-50%) translateY(-20px)";
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  }

  // Add elements to page
  document.body.appendChild(btn);
  document.body.appendChild(statusPanel);
});
