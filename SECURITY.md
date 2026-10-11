# Security

Perfect Strangers is a static website plus a local Python module. The site in `web/` is plain HTML, CSS and two ES modules served as files. There is no server we run, no backend, no database, no user accounts and no login. The page makes no network calls, so it holds no secrets and no personal data. The Python engine in `engine.py` runs on a local machine or on Qollab's free simulator and reads nothing a stranger sends. The attack surface is a hostile browser visitor against a static page and a hostile caller passing bad input to the Python engine. Both are small and both are closed off below.

## Threat model

| Attacker / Attack | Defence | Where it lives (file) | Tested? |
|---|---|---|---|
| Browser visitor injects script or style | Strict CSP: `default-src 'none'`, `script-src 'self'` plus the one hashed inline theme script, `style-src 'self'`, `connect-src 'none'`, no `unsafe-inline`, no `unsafe-eval`, no external origin. The same policy is also served as a header. | `web/index.html` meta CSP, `web/_headers` | Partial. `web/web-check.mjs` flags any CSP violation or console error during render in both themes. Run by hand. |
| Script smuggled in through data rendered into the DOM | Every node is built with `textContent` and `document.createElement`. The code never assigns `innerHTML`, so any value becomes text, not markup. | `web/app.js` (`showDeal`, `buildAttempt`, `scoreAttempt`) | No direct assertion. The headless check confirms the data-built UI renders with no page error. |
| Tampered localStorage | Only the `theme` key is read, inside a `try/catch`. A missing or bad value falls back to the system color scheme. The value is applied as a `data-theme` attribute, never as HTML or CSS. | `web/index.html` inline bootstrap, `web/app.js` theme toggle | No. |
| Clickjacking by framing the page | `frame-ancestors 'none'` plus `X-Frame-Options: DENY`. | `web/_headers` | No. Static header config. |
| Browser mis-sniffs a response, leaks a referrer or loads over plain HTTP | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security` and a locked-down `Permissions-Policy`. | `web/_headers` | No. Static header config. |
| Faked or drifted browser engine that lies about the physics | A fixture test pins `web/engine.js` to the Qiskit output. It checks every exact outcome probability to 1e-9 and 20,000 seeded rounds, 20,032 checks in all. A wrong port fails the test. | `tests/engine.test.mjs` against `web/qiskit-fixture.json` | Yes. Run with `node tests/engine.test.mjs`. `./verify.sh` and the CI workflow (`.github/workflows/ci.yml`) run it on every push. |
| Hostile input to the Python engine | Shot counts are clamped to `[1, 200000]` with `max(MIN_SHOTS, min(int(shots), MAX_SHOTS))`. The question is validated against the four-entry allow list and an unknown question or basis raises a clear `ValueError`. No crash and no unbounded run. | `engine.py` (`MAX_SHOTS`, `_validate_question`, `_rotate_to_basis`, `quantum_round`) | Yes. `tests/test_engine.py` (`test_bad_question_rejected`, `test_shots_are_bounded`). |
| Supply chain pulls in malicious code | The site has zero runtime JavaScript dependencies. `app.js` imports only `./engine.js` and there is no `package.json` and no `node_modules`. Qiskit is pinned to a tight range. | `web/` (no manifest), `pyproject.toml` (`qiskit[visualization]>=2.4,<3`) | No. No lockfile is committed and there is no automated audit step. |

## Known limits

Stated plainly so nothing here reads as more than it is.

- Ideal simulation only. The Python engine uses `StatevectorSampler` and `Statevector`. The browser engine is a pure statevector simulator. There is no hardware, no noise and no decoherence anywhere.
- The browser engine is an exact 3 qubit statevector simulator written in JavaScript. It is not Pyodide and it is not Qiskit running in the browser. It reproduces the Qiskit numbers. It does not run Qiskit.
- This is a cooperative coordination result, not telepathy and not communication. No information crosses between the players. The win comes from a shared correlation, not a signal.
- Shared randomness is modelled as the convex hull of the deterministic strategies. `classical_optimum` brute forces all 64 fixed plans and a mixture of fixed plans cannot beat the best fixed plan. This does not model every adaptive or interactive protocol.
- Defences with no automated test: the clickjacking and transport headers, the localStorage fallback and the no-`innerHTML` DOM discipline. The CSP has only the manual headless check in `web/web-check.mjs`, not an automated gate. The supply chain has no lockfile and no audit step yet.

## Release gate

One command runs the gate: `./verify.sh`. It runs `ruff check`, `ruff format --check`, `mypy` (configured in `pyproject.toml`), `pytest` over `tests/test_engine.py` and the browser-engine fixture test via `node tests/engine.test.mjs`, then prints `ALL GREEN` only at the end. CI runs the same script on every push (`.github/workflows/ci.yml`).
