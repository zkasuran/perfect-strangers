// Perfect Strangers: the quantum engine, in the browser.
//
// A real 3 qubit statevector simulator. It builds the GHZ state, rotates each
// player's qubit into the X or Y basis, then reads the probabilities. This is the
// same circuit as the authoritative Qiskit project. tests/engine.test.mjs holds
// this port to the Qiskit output byte for byte, so the game you play is the real
// quantum computation, not a lookup table.
//
// Everything is an ideal simulator. No hardware, no noise.
// SPDX-License-Identifier: MIT
// This effort is supported by Qollab & IonQ.

// A complex amplitude is [re, im]. The state is 8 of them, index = q2 q1 q0 with
// qubit 0 the least significant bit, matching Qiskit's ordering.
const N = 3;
const DIM = 8;

export const QUESTIONS = { XXX: +1, XYY: -1, YXY: -1, YYX: -1 };

function zeroState() {
  const amp = Array.from({ length: DIM }, () => [0, 0]);
  amp[0] = [1, 0];
  return amp;
}

// Apply a single qubit 2x2 gate (entries are [re,im]) to qubit q.
function apply1(amp, q, g) {
  const bit = 1 << q;
  const out = amp.map((c) => c.slice());
  for (let i = 0; i < DIM; i++) {
    if (i & bit) continue;
    const j = i | bit;
    const a = amp[i];
    const b = amp[j];
    // out[i] = g00*a + g01*b ; out[j] = g10*a + g11*b
    out[i] = cadd(cmul(g[0], a), cmul(g[1], b));
    out[j] = cadd(cmul(g[2], a), cmul(g[3], b));
  }
  return out;
}

function cx(amp, control, target) {
  const cbit = 1 << control;
  const tbit = 1 << target;
  const out = amp.map((c) => c.slice());
  for (let i = 0; i < DIM; i++) {
    if (i & cbit) out[i] = amp[i ^ tbit].slice();
  }
  return out;
}

const cadd = (x, y) => [x[0] + y[0], x[1] + y[1]];
const cmul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];

const INV_SQRT2 = 1 / Math.SQRT2;
const H = [[INV_SQRT2, 0], [INV_SQRT2, 0], [INV_SQRT2, 0], [-INV_SQRT2, 0]];
const SDG = [[1, 0], [0, 0], [0, 0], [0, -1]]; // diag(1, -i)

function ghz() {
  let amp = zeroState();
  amp = apply1(amp, 0, H);
  amp = cx(amp, 0, 1);
  amp = cx(amp, 0, 2);
  return amp;
}

// The circuit for one question: GHZ, then each player's basis rotation.
export function roundState(question) {
  if (!(question in QUESTIONS)) throw new Error(`unknown question ${question}`);
  let amp = ghz();
  for (let i = 0; i < N; i++) {
    const basis = question[i];
    if (basis === "X") amp = apply1(amp, i, H);
    else if (basis === "Y") { amp = apply1(amp, i, SDG); amp = apply1(amp, i, H); }
    else throw new Error(`basis must be X or Y, got ${basis}`);
  }
  return amp;
}

// Exact outcome probabilities, keyed by bitstring "q2q1q0" to match Qiskit.
export function distribution(question) {
  const amp = roundState(question);
  const dist = {};
  for (let i = 0; i < DIM; i++) {
    const p = amp[i][0] * amp[i][0] + amp[i][1] * amp[i][1];
    const key = i.toString(2).padStart(N, "0"); // high qubit first
    dist[key] = p;
  }
  return dist;
}

// Sample one round. Returns the three answer bits (as read by each player) and
// the parity (product of their +1/-1 answers). rng defaults to Math.random.
export function playRound(question, rng = Math.random) {
  const dist = distribution(question);
  let r = rng();
  let chosen = "000";
  for (const [key, p] of Object.entries(dist)) {
    r -= p;
    if (r <= 0) { chosen = key; break; }
  }
  const bits = chosen.split("").map(Number); // [q2,q1,q0]
  let parity = 1;
  for (const b of bits) parity *= 1 - 2 * b;
  return { outcome: chosen, bits, parity, won: parity === QUESTIONS[question] };
}
