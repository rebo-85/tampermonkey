// ==UserScript==
// @name         Sudoku AI
// @namespace    rebo.sudoku.ai
// @version      1.1
// @description  Solves sudoku
// @match        https://sudoku.com/*
// @grant        none
// ==/UserScript==

window.addEventListener("load", function () {
  let puzzle = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];

  function loadOCR(cb) {
    if (window.Tesseract) return cb();
    let s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.0.1/dist/tesseract.min.js";
    s.onload = cb;
    document.body.appendChild(s);
  }

  function runOCR(img, cb) {
    window.Tesseract.recognize(img, "eng", { logger: (m) => {} }).then(({ data }) => cb(data.text));
  }

  function getPuzzleFromCanvas(cb) {
    let cvs = document.querySelector("#game canvas");
    if (!cvs) return cb(null);
    let img = cvs.toDataURL();
    loadOCR(() => {
      runOCR(img, (txt) => {
        cb(txt);
      });
    });
  }

  function txtToGrid(txt) {
    let rows = txt
      .replace(/[^\d\n]/g, "")
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => l.padEnd(9, "0").slice(0, 9));
    let grd = [];
    for (let i = 0; i < 9; i++) {
      let r = rows[i] || "";
      let arr = [];
      for (let j = 0; j < 9; j++) {
        let v = parseInt(r[j]) || 0;
        arr.push(v);
      }
      grd.push(arr);
    }
    return grd;
  }

  // OCR inspect trigger
  function inspect() {
    getPuzzleFromCanvas((txt) => {
      if (!txt) return;
      puzzle = txtToGrid(txt);
      console.log("Grid:", puzzle);
    });
  }

  function solveSudoku(board) {
    function isValid(board, row, col, num) {
      for (let i = 0; i < 9; i++) {
        if (board[row][i] === num || board[i][col] === num) return false;
        const boxRow = 3 * Math.floor(row / 3) + Math.floor(i / 3);
        const boxCol = 3 * Math.floor(col / 3) + (i % 3);
        if (board[boxRow][boxCol] === num) return false;
      }
      return true;
    }

    function solve(board) {
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          if (board[row][col] === 0) {
            for (let num = 1; num <= 9; num++) {
              if (isValid(board, row, col, num)) {
                board[row][col] = num;
                if (solve(board)) return true;
                board[row][col] = 0;
              }
            }
            return false;
          }
        }
      }
      return true;
    }

    solve(board);
    return board;
  }

  let f2Lock = false;

  document.addEventListener("keydown", (e) => {
    if (e.key === "F2" && !f2Lock) {
      f2Lock = true;
      inspect();
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "F2") f2Lock = false;
  });
});
