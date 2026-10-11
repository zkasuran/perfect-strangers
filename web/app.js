// Perfect Strangers: UI wiring. The quantum truth lives in engine.js.
// SPDX-License-Identifier: MIT
import { QUESTIONS, playRound } from "./engine.js";

const $ = (id) => document.getElementById(id);
const ORDER = ["XXX", "XYY", "YXY", "YYX"];

// ---- theme toggle ---------------------------------------------------------
const themeBtn = $("themeBtn");
function syncTheme() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  themeBtn.textContent = dark ? "☾" : "☀";
  themeBtn.setAttribute("aria-pressed", String(dark));
}
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch { /* storage may be blocked */ }
  syncTheme();
});
syncTheme();

// ---- category menu: hover is CSS, add focus, tap, escape ------------------
document.querySelectorAll(".menu > li").forEach((li) => {
  const btn = li.querySelector("button");
  const open = (v) => { li.classList.toggle("open", v); btn.setAttribute("aria-expanded", String(v)); };
  btn.addEventListener("click", (e) => { e.preventDefault(); open(!li.classList.contains("open")); });
  li.addEventListener("focusin", () => open(true));
  li.addEventListener("focusout", (e) => { if (!li.contains(e.relatedTarget)) open(false); });
  li.querySelectorAll(".submenu a").forEach((a) => a.addEventListener("click", () => open(false)));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".menu > li.open").forEach((li) => {
    li.classList.remove("open"); li.querySelector("button").setAttribute("aria-expanded", "false");
  });
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu")) document.querySelectorAll(".menu > li.open").forEach((li) => {
    li.classList.remove("open"); li.querySelector("button").setAttribute("aria-expanded", "false");
  });
});

// ---- the game -------------------------------------------------------------
// One optimal classical strategy: every player answers +1 to an X question;
// to a Y question A answers +1, B and C answer -1. It wins three rounds of four.
// bit 0 means answer +1, bit 1 means answer -1.
const CLASSICAL = { X: [0, 0, 0], Y: [0, 1, 1] };
const sign = (bit) => (bit === 0 ? "+1" : "−1");
const score = { Q: { w: 0, t: 0 }, C: { w: 0, t: 0 } };
let team = "Q";

function classicalRound(question) {
  const bits = [0, 1, 2].map((i) => CLASSICAL[question[i]][i]);
  let parity = 1;
  for (const b of bits) parity *= 1 - 2 * b;
  return { bits, parity, won: parity === QUESTIONS[question] };
}

function dealOnce() {
  const question = ORDER[Math.floor(Math.random() * ORDER.length)];
  let bitFor;
  let won;
  if (team === "Q") {
    const r = playRound(question);
    bitFor = (i) => r.bits[2 - i]; // bits are [q2,q1,q0]; player i is qubit i
    won = r.won;
  } else {
    const r = classicalRound(question);
    bitFor = (i) => r.bits[i];
    won = r.won;
  }
  score[team].t += 1;
  if (won) score[team].w += 1;
  return { question, bitFor, won };
}

function showDeal({ question, bitFor, won }) {
  const ids = ["A", "B", "C"];
  ids.forEach((p, i) => {
    $("ask" + p).textContent = question[i] === "X" ? "measure X" : "measure Y";
    const el = $("ans" + p);
    const bit = bitFor(i);
    el.textContent = sign(bit);
    el.className = "ans " + (bit === 0 ? "p" : "m");
  });
  const v = $("verdict");
  v.textContent = won ? "Rule satisfied. Team wins this round." : "Rule broken. Team loses this round.";
  v.className = "verdict " + (won ? "win" : "lose");
}

function renderScore() {
  for (const [k, bar, val] of [["Q", "barQ", "valQ"], ["C", "barC", "valC"]]) {
    const s = score[k];
    const pct = s.t ? Math.round((s.w / s.t) * 100) : 0;
    $(bar).style.width = pct + "%";
    $(val).textContent = pct + "%";
  }
  $("roundline").textContent =
    `${score.Q.t + score.C.t} rounds played · quantum ${score.Q.t}, classical ${score.C.t}`;
}

function setTeam(t) {
  team = t;
  $("teamQ").setAttribute("aria-pressed", String(t === "Q"));
  $("teamC").setAttribute("aria-pressed", String(t === "C"));
}
$("teamQ").addEventListener("click", () => setTeam("Q"));
$("teamC").addEventListener("click", () => setTeam("C"));
$("deal").addEventListener("click", () => { showDeal(dealOnce()); renderScore(); });
$("auto").addEventListener("click", () => {
  let last;
  for (let i = 0; i < 100; i++) last = dealOnce();
  showDeal(last); renderScore();
});

// ---- beat it classically: six predetermined answers ----------------------
const PLAYERS = ["A", "B", "C"];
// opens at an optimal plan so the point lands: even the best leaves one red.
const attempt = { A: { X: 0, Y: 0 }, B: { X: 0, Y: 1 }, C: { X: 0, Y: 1 } };

function buildAttempt() {
  const host = $("attempt");
  host.textContent = "";
  PLAYERS.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "p";
    const who = document.createElement("div");
    who.className = "who";
    who.textContent = "Player " + p;
    card.appendChild(who);
    for (const basis of ["X", "Y"]) {
      const row = document.createElement("div");
      row.className = "set";
      const lab = document.createElement("span");
      lab.className = "who";
      lab.textContent = basis + ":";
      row.appendChild(lab);
      [0, 1].forEach((bit) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = sign(bit);
        b.setAttribute("aria-pressed", String(attempt[p][basis] === bit));
        b.addEventListener("click", () => { attempt[p][basis] = bit; buildAttempt(); scoreAttempt(); });
        row.appendChild(b);
      });
      card.appendChild(row);
    }
    host.appendChild(card);
  });
}

function scoreAttempt() {
  const host = $("attemptResult");
  host.textContent = "";
  let won = 0;
  for (const q of ORDER) {
    let parity = 1;
    for (let i = 0; i < 3; i++) parity *= 1 - 2 * attempt[PLAYERS[i]][q[i]];
    const ok = parity === QUESTIONS[q];
    if (ok) won += 1;
    const chip = document.createElement("div");
    chip.className = "chip " + (ok ? "win" : "lose");
    chip.textContent = `${q} ${ok ? "✓" : "✗"}`;
    host.appendChild(chip);
  }
  $("attemptScore").textContent =
    won === 4 ? "That should be impossible, recheck" : `You won ${won} of 4. There is always at least one red.`;
}

buildAttempt();
scoreAttempt();
renderScore();


