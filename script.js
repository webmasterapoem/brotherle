/* ---------------------------------------------------------
   GAME LOGIC (converted from React to vanilla JS)
--------------------------------------------------------- */

const MAX_GUESSES = 5;

function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getFeedback(guess, answer) {
  const g = stripDiacritics(guess.toUpperCase()).split("");
  const a = stripDiacritics(answer.toUpperCase()).split("");
  const result = new Array(g.length).fill("gray");
  const usedA = new Array(a.length).fill(false);
  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) {
      result[i] = "green";
      usedA[i] = true;
    }
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === "green") continue;
    const idx = a.findIndex((ch, j) => !usedA[j] && ch === g[i]);
    if (idx !== -1) {
      result[i] = "yellow";
      usedA[idx] = true;
    }
  }
  return result;
}

function shuffledOrder(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const KEY_RANK = { green: 3, yellow: 2, gray: 1, undefined: 0 };

const KB_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

/* ---------------------------------------------------------
   STATE
--------------------------------------------------------- */

let order = shuffledOrder(PEOPLE.length);
let pos = 0;
let guesses = [];
let current = "";
let status = "playing"; // playing | won | lost
let message = "";
let keyStates = {};
let stats = { played: 0, correct: 0, streak: 0, best: 0 };
let showHint = false;

/* ---------------------------------------------------------
   DOM REFS
--------------------------------------------------------- */

const els = {
  statSolved: document.getElementById("statSolved"),
  statStreak: document.getElementById("statStreak"),
  roundLabel: document.getElementById("roundLabel"),
  frameInner: document.getElementById("frameInner"),
  avatarImg: document.getElementById("avatarImg"),
  hintText: document.getElementById("hintText"),
  board: document.getElementById("board"),
  messageRow: document.getElementById("messageRow"),
  hintBtn: document.getElementById("hintBtn"),
  giveUpBtn: document.getElementById("giveUpBtn"),
  keyboard: document.getElementById("keyboard"),
  resultOverlay: document.getElementById("resultOverlay"),
  resultStatus: document.getElementById("resultStatus"),
  resultImg: document.getElementById("resultImg"),
  resultName: document.getElementById("resultName"),
  resultStats: document.getElementById("resultStats"),
  nextBtn: document.getElementById("nextBtn"),
};

/* ---------------------------------------------------------
   BOARD (built once per round; only the active row is touched
   while typing, so completed rows never replay their animation)
--------------------------------------------------------- */

let tileRows = []; // tileRows[r] = { rowEl, tiles: [tileEl, ...] }

function buildBoard(nameLen) {
  els.board.innerHTML = "";
  tileRows = [];
  for (let r = 0; r < MAX_GUESSES; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "tile-row";
    const tiles = [];
    for (let c = 0; c < nameLen; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      rowEl.appendChild(tile);
      tiles.push(tile);
    }
    els.board.appendChild(rowEl);
    tileRows.push({ rowEl, tiles });
  }
}

function renderTypingRow() {
  if (status !== "playing") return;
  const row = tileRows[guesses.length];
  if (!row) return;
  const letters = current.toUpperCase().split("");
  row.tiles.forEach((tile, c) => {
    const letter = letters[c] || "";
    tile.textContent = letter;
    tile.classList.toggle("filled", !!letter);
  });
}

function fillSubmittedRow(rowIndex, word, feedback) {
  const row = tileRows[rowIndex];
  if (!row) return;
  const letters = word.toUpperCase().split("");
  row.tiles.forEach((tile, c) => {
    tile.textContent = letters[c] || "";
    tile.classList.remove("filled");
    tile.classList.add(feedback[c]);
    tile.classList.add("tile-flip");
  });
}

/* ---------------------------------------------------------
   RENDER
--------------------------------------------------------- */

function currentPerson() {
  const answerIdx = order[pos];
  return PEOPLE[answerIdx];
}

function render() {
  const person = currentPerson();
  const name = person.name;
  const nameLen = name.length;

  els.statSolved.textContent = `${stats.correct}/${stats.played} solved`;
  els.statStreak.textContent = `${stats.streak} streak`;
  els.roundLabel.textContent = `Face ${pos + 1} of ${order.length}`;

  els.avatarImg.src = person.img;
  els.avatarImg.alt = "Guess this person";

  els.hintText.hidden = !(showHint && status === "playing");
  if (showHint && status === "playing") {
    els.hintText.textContent = `Starts with "${name[0].toUpperCase()}" · ${nameLen} letters`;
  }

  els.hintBtn.textContent = showHint ? "Hide hint" : "Hint";
  els.hintBtn.style.visibility = status === "playing" ? "visible" : "hidden";
  els.giveUpBtn.style.visibility = status === "playing" ? "visible" : "hidden";

  renderTypingRow();

  // Message
  els.messageRow.innerHTML = "";
  if (message) {
    const span = document.createElement("span");
    span.className = "message-warn";
    span.textContent = message;
    els.messageRow.appendChild(span);
  }

  // Keyboard
  els.keyboard.innerHTML = "";
  KB_ROWS.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "kb-row";
    row.forEach((k) => {
      const wide = k === "ENTER" || k === "BACK";
      const state = keyStates[k];
      const btn = document.createElement("button");
      btn.className = "key" + (wide ? " wide" : "") + (state ? ` ${state}` : "");
      btn.textContent = k === "BACK" ? "⌫" : k === "ENTER" ? "⏎" : k;
      btn.addEventListener("click", () => handleKey(k));
      rowEl.appendChild(btn);
    });
    els.keyboard.appendChild(rowEl);
  });

  // Result overlay
  if (status === "won" || status === "lost") {
    showResultScreen(person, status);
  } else {
    els.resultOverlay.hidden = true;
  }
}

function showResultScreen(person, outcome) {
  els.resultOverlay.hidden = false;
  els.resultStatus.textContent = outcome === "won" ? "You got it!" : "So close!";
  els.resultStatus.className = "result-status " + (outcome === "won" ? "won" : "lost");
  els.resultImg.src = person.img;
  els.resultImg.alt = person.name;
  els.resultName.textContent = person.name;
  els.resultStats.textContent = `${stats.correct}/${stats.played} solved · ${stats.streak} streak`;
}

/* ---------------------------------------------------------
   GAME ACTIONS
--------------------------------------------------------- */

function triggerShake() {
  const row = tileRows[guesses.length];
  if (!row) return;
  row.rowEl.classList.add("tile-shake");
  setTimeout(() => row.rowEl.classList.remove("tile-shake"), 420);
}

function submitGuess() {
  const person = currentPerson();
  const name = person.name;
  const nameLen = name.length;

  if (status !== "playing") return;
  if (current.length !== nameLen) {
    message = `Needs ${nameLen} letters`;
    render();
    triggerShake();
    return;
  }
  message = "";
  const fb = getFeedback(current, name);
  const isWin = stripDiacritics(current.toUpperCase()) === stripDiacritics(name.toUpperCase());

  fillSubmittedRow(guesses.length, current, fb);
  guesses.push({ word: current, feedback: fb });

  if (isWin) {
    status = "won";
    stats.streak += 1;
    stats.played += 1;
    stats.correct += 1;
    stats.best = Math.max(stats.best, stats.streak);
  } else if (guesses.length >= MAX_GUESSES) {
    status = "lost";
    stats.played += 1;
    stats.streak = 0;
  }

  for (let i = 0; i < current.length; i++) {
    const ch = current[i].toUpperCase();
    const state = fb[i];
    if (KEY_RANK[state] > KEY_RANK[keyStates[ch]]) keyStates[ch] = state;
  }

  current = "";
  render();
}

function handleKey(key) {
  const person = currentPerson();
  const nameLen = person.name.length;

  if (status !== "playing") return;
  if (key === "ENTER") {
    submitGuess();
    return;
  }
  if (key === "BACK") {
    current = current.slice(0, -1);
    render();
    return;
  }
  if (/^[A-Z]$/.test(key)) {
    if (current.length < nameLen) current += key;
    render();
  }
}

function nextFace() {
  let nextPos = pos + 1;
  if (nextPos >= order.length) {
    order = shuffledOrder(PEOPLE.length);
    nextPos = 0;
  }
  pos = nextPos;
  guesses = [];
  current = "";
  status = "playing";
  message = "";
  keyStates = {};
  showHint = false;
  buildBoard(currentPerson().name.length);
  render();
}

function giveUp() {
  if (status !== "playing") return;
  status = "lost";
  stats.played += 1;
  stats.streak = 0;
  render();
}

/* ---------------------------------------------------------
   EVENT WIRING
--------------------------------------------------------- */

els.hintBtn.addEventListener("click", () => {
  showHint = !showHint;
  render();
});

els.giveUpBtn.addEventListener("click", giveUp);
els.nextBtn.addEventListener("click", nextFace);

window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (k === "Enter") return handleKey("ENTER");
  if (k === "Backspace") return handleKey("BACK");
  if (/^[a-zA-Z]$/.test(k)) return handleKey(k.toUpperCase());
});

buildBoard(currentPerson().name.length);
render();
