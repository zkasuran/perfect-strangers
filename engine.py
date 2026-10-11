"""Perfect Strangers: the GHZ pseudo-telepathy game, authoritative Qiskit engine.

Three players sit in sealed rooms and cannot communicate. A referee sends each a
single question bit. Each answers with one bit. On a fixed set of question rounds
there is a winning rule the whole team must satisfy together.

A classical team that fixed its answers in advance (any shared strategy) wins at
most 75 percent of rounds. A team that shares a 3 qubit GHZ state and measures as
instructed wins every round, 100 percent, with no message ever sent. The gap is
not luck and it is not an inequality you squint at. It is all or nothing.

This module is the single source of truth for the physics. The in browser engine
in web/ is verified byte for byte against the distributions exported here.

Runs on Qollab's free local simulator. It uses only qiskit.quantum_info and
qiskit.primitives, so it needs no Aer backend and no transpiler.

SPDX-License-Identifier: MIT
This effort is supported by Qollab & IonQ.
"""

from __future__ import annotations

from itertools import product

from qiskit import QuantumCircuit
from qiskit.primitives import StatevectorSampler
from qiskit.quantum_info import Statevector

# Ceilings on anything a caller can dial, so no input exhausts memory or time.
MAX_SHOTS = 200_000
MIN_SHOTS = 1

# The four question rounds. Each is the basis each of the three players measures
# in (X or Y), and the product their three answers must equal to win that round.
# Derived from the GHZ state being a +1 eigenstate of XXX and a -1 eigenstate of
# XYY, YXY and YYX. See classical_optimum() for the proof the classical cap is 3/4.
QUESTIONS: dict[str, int] = {
    "XXX": +1,
    "XYY": -1,
    "YXY": -1,
    "YYX": -1,
}


def ghz_circuit() -> QuantumCircuit:
    """The shared resource: a 3 qubit GHZ state (|000> + |111>) / sqrt(2)."""
    qc = QuantumCircuit(3)
    qc.h(0)
    qc.cx(0, 1)
    qc.cx(0, 2)
    return qc


def _validate_question(question: str) -> None:
    if question not in QUESTIONS:
        raise ValueError(f"unknown question {question!r}, expected one of {list(QUESTIONS)}")


def _rotate_to_basis(qc: QuantumCircuit, qubit: int, basis: str) -> None:
    """Rotate a qubit so a Z measurement reads it in the X or Y basis."""
    if basis == "X":
        qc.h(qubit)
    elif basis == "Y":
        qc.sdg(qubit)
        qc.h(qubit)
    else:
        raise ValueError(f"basis must be X or Y, got {basis!r}")


def round_circuit(question: str) -> QuantumCircuit:
    """GHZ state then each player's basis rotation then a measurement of all three."""
    _validate_question(question)
    qc = ghz_circuit()
    for i, basis in enumerate(question):
        _rotate_to_basis(qc, i, basis)
    qc.measure_all()
    return qc


def _parity(bitstring: str) -> int:
    """Map a 3 bit outcome to the product of its answers, 0 -> +1 and 1 -> -1."""
    out = 1
    for ch in bitstring:
        out *= 1 - 2 * int(ch)
    return out


def quantum_round(question: str, shots: int = 20_000) -> float:
    """Fraction of shots the quantum team wins on one question round."""
    _validate_question(question)
    shots = max(MIN_SHOTS, min(int(shots), MAX_SHOTS))
    target = QUESTIONS[question]
    result = StatevectorSampler().run([round_circuit(question)], shots=shots).result()
    counts = result[0].data.meas.get_counts()
    won = sum(int(n) for bits, n in counts.items() if _parity(bits) == target)
    return won / shots


def quantum_win_rate(shots: int = 20_000) -> float:
    """Average quantum win rate across all four questions. Ideal value is 1.0."""
    return sum(quantum_round(q, shots) for q in QUESTIONS) / len(QUESTIONS)


def classical_optimum() -> tuple[float, tuple[int, ...]]:
    """Brute force every deterministic classical strategy and return the best.

    A strategy fixes each player's two answers in advance, one for an X question
    and one for a Y question, so six bits in total. We score each strategy by how
    many of the four rounds it wins. The best possible is three of four. No
    strategy wins all four, because multiplying the four winning rules gives
    +1 = -1, a flat contradiction. Shared randomness is a mixture of these
    deterministic strategies, so it cannot beat the best one.
    """
    best_frac = 0.0
    best_strategy: tuple[int, ...] = (0, 0, 0, 0, 0, 0)
    # strategy = (aX, aY, bX, bY, cX, cY), each +1 or -1
    for bits in product((1, -1), repeat=6):
        answers = {"X": (bits[0], bits[2], bits[4]), "Y": (bits[1], bits[3], bits[5])}
        won = 0
        for question, target in QUESTIONS.items():
            prod = 1
            for player, basis in enumerate(question):
                prod *= answers[basis][player]
            if prod == target:
                won += 1
        frac = won / len(QUESTIONS)
        if frac > best_frac:
            best_frac = frac
            best_strategy = bits
    return best_frac, best_strategy


def exact_distributions() -> dict[str, dict[str, float]]:
    """Exact outcome probabilities per question, straight from the statevector.

    This is the fixture the in browser engine must reproduce. No sampling, so the
    numbers are exact and the web port is held to them.
    """
    dists: dict[str, dict[str, float]] = {}
    for question in QUESTIONS:
        qc = ghz_circuit()
        for i, basis in enumerate(question):
            _rotate_to_basis(qc, i, basis)
        probs = Statevector(qc).probabilities_dict()
        dists[question] = {k: round(v, 12) for k, v in sorted(probs.items())}
    return dists


def main(shots: int = 20_000) -> None:
    """Print the scoreboard: quantum wins every round, best classical caps at 75 percent."""
    print("Perfect Strangers: the GHZ pseudo-telepathy game\n")
    print(f"{'round':6}  {'rule':>8}  {'quantum win rate':>18}")
    for question, target in QUESTIONS.items():
        rate = quantum_round(question, shots)
        rule = f"prod={target:+d}"
        print(f"{question:6}  {rule:>8}  {rate:>17.1%}")
    q = quantum_win_rate(shots)
    best_frac, _ = classical_optimum()
    print(f"\nquantum team:        {q:.1%} over all rounds")
    print(f"best classical team: {best_frac:.1%} (proven ceiling, no strategy wins all four)")
    print(f"gap: quantum wins {q - best_frac:.0%} more of the time, with no message ever sent")


if __name__ == "__main__":
    main()
