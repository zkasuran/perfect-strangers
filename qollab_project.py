"""Perfect Strangers: the GHZ pseudo-telepathy game.

Three players sit in sealed rooms with no way to talk. A referee sends each one a
single question bit. Each sends back one answer bit. On four possible question
rounds there is a team rule the three answers must satisfy together.

Any classical team that agreed a plan in advance wins at most 75 percent of rounds.
A team that shares a 3 qubit GHZ state and measures as told wins 100 percent, every
round, with no message ever sent between them. The gap is not luck and it is not an
inequality you squint at. It is all or nothing.

Press Run. Pick a free local simulator. Watch the scoreboard.

Built on Qiskit, runs on Qollab's free local simulator.
SPDX-License-Identifier: MIT
This effort is supported by Qollab & IonQ.
"""

from itertools import product

from qiskit import QuantumCircuit
from qiskit.primitives import StatevectorSampler

SHOTS = 20_000

# Each round: the basis each of the three players measures in (X or Y), and the
# product their three answers must equal to win. These come straight from the GHZ
# state: it is a +1 eigenstate of XXX and a -1 eigenstate of XYY, YXY and YYX.
QUESTIONS = {"XXX": +1, "XYY": -1, "YXY": -1, "YYX": -1}


def ghz():
    """The shared resource: (|000> + |111>) / sqrt(2)."""
    qc = QuantumCircuit(3)
    qc.h(0)
    qc.cx(0, 1)
    qc.cx(0, 2)
    return qc


def round_circuit(question):
    qc = ghz()
    for i, basis in enumerate(question):
        if basis == "X":
            qc.h(i)
        else:  # Y: rotate so a Z measurement reads the Y basis
            qc.sdg(i)
            qc.h(i)
    qc.measure_all()
    return qc


def parity(bits):
    out = 1
    for ch in bits:
        out *= 1 - 2 * int(ch)
    return out


def quantum_win_rate(question):
    counts = StatevectorSampler().run([round_circuit(question)], shots=SHOTS).result()[0]
    counts = counts.data.meas.get_counts()
    won = sum(int(n) for bits, n in counts.items() if parity(bits) == QUESTIONS[question])
    return won / SHOTS


def classical_ceiling():
    """Brute force all 64 predetermined strategies. The best wins 3 of 4 rounds.

    No strategy wins all four: multiply the four winning rules and you get
    +1 = -1, a flat contradiction. Shared randomness is only a mix of these, so
    it cannot do better.
    """
    best = 0.0
    for bits in product((1, -1), repeat=6):
        ans = {"X": (bits[0], bits[2], bits[4]), "Y": (bits[1], bits[3], bits[5])}
        won = 0
        for q, target in QUESTIONS.items():
            prod = 1
            for player, basis in enumerate(q):
                prod *= ans[basis][player]
            won += prod == target
        best = max(best, won / 4)
    return best


def main():
    print(__doc__.splitlines()[0])
    print("=" * 52)
    rates = {}
    for q in QUESTIONS:
        rates[q] = quantum_win_rate(q)
        print(
            f"  round {q}  (answers multiply to {QUESTIONS[q]:+d}):  quantum wins {rates[q]:6.1%}"
        )
    quantum = sum(rates.values()) / len(rates)
    classical = classical_ceiling()
    print("-" * 52)
    print(f"  QUANTUM team       : {quantum:.0%}  (shares a GHZ state, no talking)")
    print(f"  best CLASSICAL team: {classical:.0%}  (proven ceiling, any agreed plan)")
    print(f"  edge: {quantum - classical:.0%} more rounds won, with zero communication")
    print("=" * 52)
    print("Everything here is an ideal simulator. No hardware, no noise.")

    try:
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(6, 3.4))
        ax.bar(
            ["Quantum team", "Best classical"], [quantum, classical], color=["#4a9fe0", "#9aa4b2"]
        )
        ax.axhline(1.0, ls="--", lw=1, color="#8b98a9")
        ax.set_ylim(0, 1.08)
        ax.set_ylabel("rounds won")
        ax.set_title("Perfect Strangers: no communication, perfect coordination")
        for i, v in enumerate([quantum, classical]):
            ax.text(i, v + 0.02, f"{v:.0%}", ha="center", fontweight="bold")
        fig.tight_layout()
        plt.show()
    except Exception as exc:  # a missing display path must not fail the run
        print(f"(plot skipped: {exc})")


main()
