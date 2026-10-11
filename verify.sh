#!/usr/bin/env bash
# One release gate. CI runs this same script. Prints ALL GREEN only at the end.
set -euo pipefail
cd "$(dirname "$0")"

echo "== ruff lint (warnings are errors) =="
ruff check .

echo "== ruff format check =="
ruff format --check .

echo "== mypy strict =="
mypy

echo "== pytest (physics and ceilings) =="
python3 -m pytest -q

echo "== node: browser engine matches Qiskit byte for byte =="
node tests/engine.test.mjs

echo "ALL GREEN"
