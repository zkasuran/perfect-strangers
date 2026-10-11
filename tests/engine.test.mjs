// Holds the in-browser engine to the authoritative Qiskit output. If the web port
// drifts from the physics, this fails. Run: node tests/engine.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { QUESTIONS, distribution, playRound } from "../web/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(here, "../web/qiskit-fixture.json"), "utf8"));

const TOL = 1e-9;
let checks = 0;

// 1) Every exact distribution matches Qiskit, key by key, to 1e-9.
for (const q of Object.keys(QUESTIONS)) {
  const js = distribution(q);
  const ref = fx.distributions[q];
  assert.deepEqual(
    Object.keys(js).sort(),
    Object.keys(ref).sort(),
    `${q}: outcome keys differ`,
  );
  for (const key of Object.keys(ref)) {
    assert.ok(
      Math.abs(js[key] - ref[key]) < TOL,
      `${q} ${key}: js ${js[key]} vs qiskit ${ref[key]}`,
    );
    checks++;
  }
}

// 2) The win rules in the fixture match the engine's.
assert.deepEqual(fx.questions, QUESTIONS, "win rules differ from Qiskit");

// 3) The quantum team wins every sampled round (seeded, deterministic rng).
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const rng = lcg(42);
for (const q of Object.keys(QUESTIONS)) {
  for (let i = 0; i < 5000; i++) {
    assert.ok(playRound(q, rng).won, `${q}: quantum team lost a round, impossible`);
    checks++;
  }
}

// 4) The classical ceiling the site quotes matches Qiskit's brute force.
assert.equal(fx.classical_best, 0.75, "classical ceiling drifted");

console.log(`OK: web engine matches Qiskit across ${checks} checks (tol ${TOL})`);
