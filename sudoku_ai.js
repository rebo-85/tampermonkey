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
    aiBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="icon-game-control" viewBox="0 0 32 32" width="32" height="32">
        <path fill="#325aaf" d="M 15.9878 18.6815 z M 15.5461 17.3408 h -2.8087 l -0.4024 1.3208 h -2.5278 l 3.0174 -8.0162 h 2.71 l 3.0061 8.0162 h -2.5923 L 15.5461 17.3408 L 15.5461 17.3408 z M 15.0224 15.6024 l -0.8768 -2.8808 l -0.8806 2.8808 H 15.0224 L 15.0224 15.6024 z M 19.2392 10.6418 h 2.4861 v 8.0162 h -2.4861 V 10.6418 L 19.2392 10.6418 z M 17.3453 2.4245 c -0.4099 0.296 -0.7894 0.6945 -1.1197 1.2107 c -0.0152 0.0266 -0.038 0.0493 -0.0646 0.0646 c -0.1025 0.0646 -0.2391 0.0341 -0.3036 -0.0646 c -0.3303 -0.5162 -0.7098 -0.9147 -1.1197 -1.2107 c -0.4403 -0.3188 -0.9147 -0.52 -1.4043 -0.6186 l -0.0076 0 c -0.4783 -0.0987 -0.9679 -0.0987 -1.4385 -0.0152 c -0.4972 0.0872 -0.9792 0.2695 -1.412 0.52 c -0.4288 0.2505 -0.816 0.5731 -1.1387 0.9451 c -0.3113 0.3606 -0.5617 0.7743 -0.725 1.2184 l 0 0 c -0.0266 0.0683 -0.0493 0.1405 -0.0721 0.2164 c -0.019 0.0683 -0.0418 0.1442 -0.0569 0.2201 c -0.019 0.0987 -0.1025 0.1708 -0.2088 0.1746 c -0.5086 0.0759 -1.0135 0.2619 -1.4841 0.539 c -0.4783 0.2847 -0.9223 0.6719 -1.3056 1.1348 c -0.3796 0.4631 -0.6983 1.0096 -0.9261 1.6169 c -0.2126 0.5693 -0.3416 1.1956 -0.3682 1.8598 c -0.0038 0.0872 -0.0038 0.1708 -0.0038 0.258 c 0 0.0797 0.0038 0.1632 0.0038 0.2505 c 0.0038 0.0721 -0.0266 0.148 -0.0911 0.1936 c -0.3113 0.2239 -0.5921 0.4555 -0.8427 0.6945 c -0.2544 0.2467 -0.4783 0.5011 -0.6719 0.7629 c -0.315 0.4288 -0.5465 0.8768 -0.7022 1.3284 c -0.1632 0.4706 -0.2429 0.9527 -0.2505 1.4271 c -0.0038 0.4555 0.0569 0.9071 0.186 1.3436 c 0.129 0.4441 0.3264 0.8768 0.5807 1.2791 l 0 0 c 0.1442 0.2316 0.3075 0.4593 0.4858 0.6719 c 0.1821 0.2164 0.3796 0.4213 0.5921 0.6149 c 0.0531 0.0493 0.0836 0.129 0.0683 0.2049 c -0.0608 0.2885 -0.0911 0.5731 -0.1025 0.854 c -0.0076 0.2885 0.0076 0.5731 0.0456 0.8502 c 0.0721 0.5086 0.2201 0.9945 0.4288 1.4423 c 0.2201 0.4783 0.5086 0.9147 0.8427 1.2981 c 0.3226 0.3757 0.6908 0.7022 1.0855 0.9717 c 0.3985 0.2733 0.8199 0.4858 1.2525 0.6339 c 0.1936 0.0646 0.3909 0.1177 0.5921 0.1556 c 0.1898 0.038 0.3796 0.0608 0.5655 0.0683 c 0.1025 -0.0038 0.1974 0.0683 0.2201 0.1746 c 0.0987 0.4516 0.2808 0.8768 0.5314 1.2602 c 0.2619 0.4024 0.5921 0.7591 0.9717 1.0551 c 0.4783 0.3719 1.0399 0.6529 1.6321 0.8009 c 0.558 0.1405 1.1463 0.167 1.7231 0.0456 c 0.5162 -0.1062 1.0171 -0.3264 1.4803 -0.6755 c 0.4252 -0.3226 0.8199 -0.7553 1.15 -1.3171 c 0.019 -0.0341 0.0493 -0.0608 0.0872 -0.0797 c 0.1062 -0.0569 0.2391 -0.0152 0.296 0.0911 c 0.2733 0.5086 0.6073 0.9147 0.9792 1.2222 c 0.4024 0.3303 0.8463 0.5542 1.3133 0.6832 c 0.5959 0.1632 1.2184 0.1632 1.8218 0.038 c 0.6452 -0.1328 1.2677 -0.4137 1.8029 -0.8009 c 0.4213 -0.2998 0.7932 -0.668 1.0894 -1.0855 c 0.2808 -0.3909 0.4896 -0.8274 0.6111 -1.2867 c 0.0152 -0.0872 0.0836 -0.1632 0.1784 -0.1784 c 0.558 -0.0987 1.1083 -0.3303 1.6131 -0.6755 c 0.5048 -0.3454 0.964 -0.8009 1.3398 -1.3436 c 0.3454 -0.5011 0.6224 -1.0779 0.8009 -1.708 c 0.167 -0.5883 0.2467 -1.2259 0.2201 -1.8978 c -0.0076 -0.0759 0.0266 -0.1518 0.0949 -0.1974 c 0.3264 -0.2239 0.6149 -0.4593 0.873 -0.6983 c 0.2619 -0.2505 0.4934 -0.5086 0.6908 -0.7781 l 0 0 c 0.3036 -0.4099 0.5276 -0.835 0.6832 -1.2715 c 0.1595 -0.4516 0.2429 -0.9109 0.258 -1.3702 c 0.0113 -0.4441 -0.0418 -0.8843 -0.1556 -1.3171 c -0.1139 -0.4365 -0.2923 -0.8578 -0.5237 -1.2563 l -0.0076 -0.0076 c -0.1518 -0.2619 -0.3303 -0.5124 -0.5276 -0.7553 c -0.1974 -0.2429 -0.4213 -0.4706 -0.6604 -0.687 c -0.0569 -0.0493 -0.0872 -0.129 -0.0721 -0.2088 c 0.0531 -0.2619 0.0872 -0.5237 0.0987 -0.7819 c 0.0113 -0.2619 0.0038 -0.52 -0.0228 -0.7743 c -0.0569 -0.5276 -0.1974 -1.0286 -0.4024 -1.4954 c -0.2164 -0.4934 -0.5048 -0.9489 -0.8427 -1.3474 c -0.3264 -0.3872 -0.7022 -0.725 -1.1045 -1.0058 c -0.4024 -0.2808 -0.8312 -0.5011 -1.2677 -0.6491 l -0.0113 -0.0038 c -0.2316 -0.0797 -0.4668 -0.1367 -0.6983 -0.1746 l -0.0076 0 c -0.2277 -0.038 -0.4555 -0.0531 -0.6794 -0.0493 c -0.1025 0.0076 -0.2011 -0.0608 -0.2277 -0.167 c -0.038 -0.1556 -0.0872 -0.3075 -0.1442 -0.4555 c -0.0608 -0.1518 -0.129 -0.2998 -0.2088 -0.4478 c -0.2049 -0.3796 -0.4744 -0.7288 -0.7894 -1.0286 c -0.3226 -0.3075 -0.6908 -0.5693 -1.0855 -0.7704 c -0.4062 -0.2049 -0.8502 -0.3492 -1.3056 -0.4137 c -0.4327 -0.0608 -0.8768 -0.0531 -1.3133 0.038 C 18.2675 1.9044 17.7854 2.1057 17.3453 2.4245 L 17.3453 2.4245 z M 23.5509 6.6982 c 0.0266 -0.0836 0.1025 -0.148 0.1974 -0.1556 c 0.1595 -0.0113 0.3226 -0.0038 0.4858 0.0228 c 0.167 0.0266 0.334 0.0683 0.5011 0.1252 c 0.315 0.1062 0.6301 0.2695 0.9223 0.4744 c 0.2885 0.2011 0.5617 0.4478 0.7971 0.7288 l 0.0038 0.0076 c 0.2467 0.2923 0.4555 0.6186 0.6111 0.9755 c 0.148 0.334 0.2467 0.6908 0.2885 1.0666 c 0.0266 0.2505 0.0266 0.5124 -0.0038 0.7781 c -0.0266 0.2467 -0.0836 0.5011 -0.1708 0.7553 l -0.0038 0.0152 c -0.0531 0.1595 -0.0493 0.3264 0 0.4744 c 0.0531 0.1518 0.1518 0.2885 0.2923 0.3796 l 0.0113 0.0076 c 0.2657 0.1974 0.5011 0.4137 0.706 0.6414 c 0.2126 0.2316 0.3947 0.4821 0.5465 0.7401 c 0.167 0.2847 0.296 0.5807 0.3757 0.8843 c 0.0836 0.2998 0.1215 0.6035 0.11 0.9033 c -0.0076 0.3113 -0.0683 0.6224 -0.1784 0.9299 c -0.1062 0.2923 -0.2619 0.5807 -0.4668 0.8616 l -0.0038 0.0038 c -0.186 0.2544 -0.4213 0.5048 -0.6983 0.7439 c -0.2657 0.2277 -0.5731 0.4441 -0.9261 0.6529 l -0.0113 0.0076 c -0.1405 0.0797 -0.2429 0.2011 -0.3036 0.3416 c -0.0608 0.1405 -0.0797 0.296 -0.0493 0.4478 l 0.0038 0.0303 c 0.0721 0.5807 0.038 1.1348 -0.0797 1.6397 c -0.129 0.5504 -0.3529 1.0438 -0.6452 1.4651 c -0.2239 0.3226 -0.4821 0.5996 -0.7591 0.8199 c -0.2847 0.2277 -0.5921 0.3947 -0.9071 0.4972 l -0.0038 0 c -0.1139 0.0341 -0.2391 -0.0303 -0.2733 -0.1442 c -0.4288 -1.4005 -1.169 -1.8522 -2.4215 -2.4974 l -0.0266 -0.0152 c -0.1746 -0.0836 -0.3644 -0.0911 -0.5352 -0.038 c -0.1708 0.0531 -0.3188 0.1708 -0.4062 0.3416 l -0.0113 0.0228 c -0.0836 0.1746 -0.0911 0.3644 -0.038 0.5352 c 0.0569 0.1708 0.1784 0.3226 0.3529 0.4137 c 1.0476 0.5352 1.8218 0.9412 1.8105 2.2545 c -0.0038 0.3909 -0.1252 0.7704 -0.3303 1.112 c -0.2164 0.3606 -0.5276 0.6832 -0.8881 0.9451 c -0.3682 0.2657 -0.7819 0.4593 -1.2069 0.5542 c -0.4062 0.0949 -0.8237 0.0987 -1.2146 -0.0076 c -0.6604 -0.1821 -1.0894 -0.6224 -1.3777 -1.1576 c -0.2733 -0.5086 -0.4252 -1.1007 -0.5352 -1.6397 c -0.0076 -0.019 -0.0076 -0.0418 -0.0076 -0.0608 c 0 -0.2733 -0.2126 -0.4516 -0.4896 -0.5314 c -0.1215 -0.038 -0.2544 -0.0531 -0.3834 -0.0531 c -0.1328 0 -0.2619 0.019 -0.3834 0.0531 c -0.2733 0.0836 -0.4858 0.2619 -0.4858 0.5314 c 0 0.019 -0.0038 0.0341 -0.0076 0.0531 c -0.2126 0.8427 -0.52 1.4764 -0.8806 1.9319 c -0.4213 0.5352 -0.9147 0.8274 -1.4233 0.9337 c -0.3719 0.0759 -0.7553 0.0569 -1.1197 -0.038 c -0.3834 -0.1025 -0.7478 -0.2885 -1.0666 -0.5314 c -0.315 -0.2467 -0.577 -0.5465 -0.7591 -0.8843 c -0.1746 -0.3226 -0.277 -0.6794 -0.277 -1.0438 c 0 -1.3815 0.835 -1.8446 1.9395 -2.4102 c 0.1746 -0.0911 0.296 -0.2429 0.3529 -0.4137 c 0.0569 -0.1746 0.0456 -0.3682 -0.0418 -0.5465 c -0.0911 -0.1746 -0.2429 -0.296 -0.4137 -0.3529 c -0.1708 -0.0531 -0.3606 -0.0456 -0.5352 0.038 l -0.0113 0.0038 c -1.3018 0.6642 -2.0799 1.15 -2.5468 2.5961 c -0.0266 0.0949 -0.1177 0.167 -0.2201 0.1632 c -0.129 -0.0038 -0.258 -0.019 -0.3909 -0.0456 c -0.129 -0.0266 -0.258 -0.0608 -0.3796 -0.1062 c -0.3075 -0.1062 -0.6149 -0.2619 -0.9033 -0.4593 c -0.2847 -0.1974 -0.5504 -0.4327 -0.7857 -0.706 c -0.2429 -0.2808 -0.4516 -0.5959 -0.6111 -0.9412 c -0.1518 -0.3226 -0.258 -0.668 -0.3113 -1.0286 l 0 -0.0076 c -0.038 -0.2657 -0.0456 -0.5427 -0.0152 -0.8274 c 0.0266 -0.2657 0.0836 -0.5427 0.1784 -0.816 l 0.0038 -0.0113 c 0.0531 -0.1556 0.0493 -0.3188 0.0038 -0.4631 l -0.0038 -0.0076 c -0.0493 -0.1518 -0.148 -0.2847 -0.2847 -0.3796 l -0.0076 -0.0076 c -0.2429 -0.1821 -0.4631 -0.3757 -0.6566 -0.5883 c -0.1974 -0.2126 -0.3719 -0.4403 -0.5162 -0.6755 c -0.1746 -0.2847 -0.3113 -0.5883 -0.4024 -0.8996 c -0.0872 -0.3036 -0.1328 -0.6149 -0.129 -0.9337 c 0.0038 -0.3226 0.0608 -0.6529 0.1746 -0.9755 c 0.11 -0.3075 0.2695 -0.6149 0.4896 -0.9147 c 0.186 -0.2544 0.4137 -0.5048 0.687 -0.7439 c 0.2619 -0.2316 0.558 -0.4516 0.8996 -0.6604 c 0.1252 -0.0759 0.2164 -0.1821 0.277 -0.3036 l 0.0038 -0.0113 c 0.0608 -0.1252 0.0836 -0.2657 0.0646 -0.4062 c -0.0038 -0.0152 -0.0038 -0.0303 -0.0038 -0.0456 l 0 -0.0076 c -0.019 -0.1328 -0.0303 -0.2657 -0.038 -0.3947 c -0.0076 -0.1405 -0.0076 -0.2808 -0.0038 -0.4175 c 0.019 -0.4972 0.1139 -0.964 0.2695 -1.3854 c 0.167 -0.4516 0.4024 -0.8578 0.6832 -1.2032 c 0.2316 -0.2847 0.4972 -0.5237 0.7743 -0.7098 c 0.277 -0.186 0.5693 -0.3188 0.8691 -0.3947 l 0 0 c 0.1139 -0.0341 0.2391 0.0303 0.2733 0.1442 c 0.2354 0.7439 0.5314 1.2107 1.0969 1.7383 l 0.0228 0.019 c 0.1405 0.129 0.3226 0.1898 0.5011 0.1821 c 0.1784 -0.0076 0.3529 -0.0797 0.4821 -0.2201 l 0.0113 -0.0152 c 0.129 -0.1405 0.1898 -0.3226 0.1821 -0.5011 c -0.0076 -0.1784 -0.0836 -0.3568 -0.2277 -0.4934 c -0.4555 -0.4213 -0.558 -0.6832 -0.6945 -1.1083 c -0.1595 -0.4896 -0.1328 -0.9679 0.0228 -1.393 c 0.1062 -0.2923 0.2733 -0.5655 0.4858 -0.8047 c 0.2088 -0.2391 0.4631 -0.4516 0.7439 -0.6149 l 0.0113 -0.0076 c 0.2885 -0.167 0.5996 -0.2885 0.9223 -0.3492 c 0.3075 -0.0569 0.6224 -0.0608 0.9299 0.0038 c 0.4327 0.0911 0.8578 0.3188 1.2335 0.7135 c 0.3303 0.3454 0.6224 0.8237 0.854 1.4536 l 0.0038 0.0076 c 0.0797 0.2467 0.3378 0.3909 0.6414 0.4478 c 0.1367 0.0266 0.2808 0.0341 0.4213 0.0266 l 0.0038 0 c 0.1442 -0.0076 0.2808 -0.0341 0.4099 -0.0759 c 0.2277 -0.0759 0.4062 -0.1974 0.4478 -0.3529 v -0.0872 c 0 -0.4403 0.2619 -0.9071 0.6224 -1.2905 c 0.3947 -0.4175 0.9223 -0.7478 1.3664 -0.8388 c 0.2808 -0.0569 0.5655 -0.0608 0.8427 -0.019 c 0.2885 0.0456 0.5693 0.1367 0.835 0.2695 L 20.7346 3.4454 c 0.2695 0.1367 0.5162 0.3113 0.7325 0.5162 c 0.2126 0.2049 0.3947 0.4365 0.5314 0.6908 c 0.2164 0.3985 0.315 0.854 0.2467 1.3361 c -0.0608 0.4213 -0.0759 0.687 -0.4288 1.1083 l -0.0038 0.0038 c -0.1252 0.148 -0.1784 0.334 -0.1632 0.5162 c 0.0152 0.1746 0.0949 0.3454 0.2354 0.4668 l 0.0228 0.019 c 0.148 0.1215 0.3303 0.1708 0.5086 0.1556 c 0.1746 -0.0152 0.3454 -0.0949 0.4668 -0.2354 l 0.019 -0.0266 C 23.2663 7.5636 23.3838 7.2448 23.5509 6.6982 z z c 0.0266 -0.0493 0.0531 -0.0987 0.0836 -0.148 z z z z z z z z z z z z z z" />
      </svg>
    `;
    wrap.appendChild(aiBtn);
    controls.appendChild(wrap);
    aiBtn.onclick = async () => {
      let boardCanvas = document.querySelector("#game canvas");
      if (!boardCanvas) return alert("No Sudoku board found.");
      let statusPanel = document.querySelector("#ai-status-panel");
      if (!statusPanel) {
        statusPanel = document.createElement("div");
        statusPanel.id = "ai-status-panel";
        statusPanel.style.position = "fixed";
        statusPanel.style.top = "70px";
        statusPanel.style.right = "20px";
        statusPanel.style.zIndex = 10001;
        statusPanel.style.background = "rgba(34,34,34,0.95)";
        statusPanel.style.color = "white";
        statusPanel.style.padding = "16px";
        statusPanel.style.borderRadius = "12px";
        statusPanel.style.display = "none";
        statusPanel.textContent = "Processing...";
        document.body.appendChild(statusPanel);
      }
      statusPanel.style.display = "block";
      try {
        let cellCanvases = extractCellCanvases(boardCanvas);
        let sudokuBoard = await recognizeSudokuBoard(cellCanvases);
        let solved = solveSudokuBoard(sudokuBoard);
        await writeAnswers(solved, boardCanvas, sudokuBoard);
        statusPanel.style.display = "none";
      } catch (e) {
        statusPanel.style.display = "none";
        alert("❌ Failed to solve.");
      }
    };
  }
});
