// ==UserScript==
// @name         Sudoku AI
// @namespace    rebo.sudoku.ai
// @version      1.2
// @description  Solves sudoku using HF digit classifier
// @author       ReBo
// @match        https://sudoku.com/*
// @grant        none
// ==/UserScript==

window.addEventListener("load", function () {
  let puzzle = Array.from({ length: 9 }, () => Array(9).fill(0));
  let modelLoaded = false;
  let classifier = null;

  function loadClassifier(cb) {
    if (modelLoaded) return cb();
    if (!window.tf) {
      let s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.18.0/dist/tf.min.js";
      s.onload = () => loadClassifier(cb);
      document.body.appendChild(s);
      return;
    }
    window.tf.loadLayersModel("https://rebo-85.github.io/Model-Server/sudoku/model.json").then((m) => {
      classifier = m;
      modelLoaded = true;
      cb();
    });
  }

  function extractVGGCells(canvas) {
    let ctx = canvas.getContext("2d");
    let w = canvas.width,
      h = canvas.height;
    let cellW = w / 9,
      cellH = h / 9;
    let cells = [];
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
        let arr = tctx.getImageData(0, 0, 32, 32).data;
        let px = [];
        for (let i = 0; i < arr.length; i += 4) {
          let v = (arr[i] + arr[i + 1] + arr[i + 2]) / 3;
          // boost contrast
          let norm = Math.max(0, Math.min(1, (v / 255 - 0.5) * 2 + 0.5));
          px.push(norm);
          px.push(norm);
          px.push(norm);
        }
        cells.push(px);
      }
    }
    let out = [];
    for (let i = 0; i < 81; i++) {
      let cell = [];
      for (let y = 0; y < 32; y++) {
        let row = [];
        for (let x = 0; x < 32; x++) {
          let idx = (y * 32 + x) * 3;
          row.push([cells[i][idx], cells[i][idx + 1], cells[i][idx + 2]]);
        }
        cell.push(row);
      }
      out.push(cell);
    }
    return out;
  }

  function preprocessCanvas(srcCanvas) {
    let tmp = document.createElement("canvas");
    tmp.width = srcCanvas.width;
    tmp.height = srcCanvas.height;
    let ctx = tmp.getContext("2d");
    ctx.drawImage(srcCanvas, 0, 0);
    let img = ctx.getImageData(0, 0, tmp.width, tmp.height);
    let d = img.data;
    let contrast = 64; // more contrast
    let f = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i],
        g = d[i + 1],
        b = d[i + 2];
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;
      let v = f * (gray - 128) + 128;
      v = Math.max(0, Math.min(255, v));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return tmp;
  }

  function classifyGridFromCanvas(cb) {
    let cvs = document.querySelector("#game canvas");
    if (!cvs) return cb(null);
    loadClassifier(() => {
      let proc = preprocessCanvas(cvs);
      let cellImgs = extractVGGCells(proc);
      let input = tf.tensor4d(cellImgs, [81, 32, 32, 3]);
      classifier
        .predict(input)
        .array()
        .then((preds) => {
          let grid = [];
          for (let i = 0; i < 9; i++) {
            let row = [];
            for (let j = 0; j < 9; j++) {
              let idx = i * 9 + j;
              let p = preds[idx];
              let maxIdx = p.indexOf(Math.max(...p));
              row.push(maxIdx === 0 ? 0 : maxIdx);
            }
            grid.push(row);
          }
          input.dispose();
          cb(grid);
        });
    });
  }

  function inspect() {
    classifyGridFromCanvas((grid) => {
      if (!grid) return;
      puzzle = grid;
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

  let sudokuBtn = document.createElement("button");
  sudokuBtn.textContent = "Sudoku AI";
  sudokuBtn.style.position = "fixed";
  sudokuBtn.style.top = "12px";
  sudokuBtn.style.right = "12px";
  sudokuBtn.style.zIndex = 9999;
  sudokuBtn.style.padding = "6px 14px";
  sudokuBtn.style.background = "#222";
  sudokuBtn.style.color = "#fff";
  sudokuBtn.style.border = "none";
  sudokuBtn.style.borderRadius = "4px";
  sudokuBtn.style.cursor = "pointer";
  document.body.appendChild(sudokuBtn);

  sudokuBtn.onclick = () => {
    inspect();
  };
});
