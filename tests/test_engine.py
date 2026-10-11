"""Tests for the Perfect Strangers engine: the physics must hold and the classical
ceiling must be real. These are the assertions the whole submission rests on."""

from __future__ import annotations

import math

import pytest

from engine import (
    QUESTIONS,
    classical_optimum,
    exact_distributions,
    quantum_round,
    quantum_win_rate,
    round_circuit,
)


def test_quantum_wins_every_round():
    # The whole claim: the quantum team wins each round with certainty.
    for question in QUESTIONS:
        assert quantum_round(question, shots=40_000) == 1.0


def test_quantum_win_rate_is_one():
    assert quantum_win_rate(shots=40_000) == 1.0


def test_classical_ceiling_is_three_quarters():
    best_frac, strategy = classical_optimum()
    assert best_frac == 0.75
    assert len(strategy) == 6


def test_no_classical_strategy_wins_all_four():
    # The pseudo-telepathy gap: multiplying the four rules forces +1 = -1.
    product_of_rules = 1
    for target in QUESTIONS.values():
        product_of_rules *= target
    assert product_of_rules == -1  # impossible for any predetermined answers


def test_exact_distributions_are_valid():
    dists = exact_distributions()
    assert set(dists) == set(QUESTIONS)
    for question, dist in dists.items():
        total = sum(dist.values())
        assert math.isclose(total, 1.0, abs_tol=1e-9), f"{question} sums to {total}"
        for prob in dist.values():
            assert prob >= -1e-12


def test_exact_distributions_only_touch_winning_outcomes():
    # Every outcome with nonzero probability must satisfy that round's rule.
    dists = exact_distributions()
    for question, dist in dists.items():
        target = QUESTIONS[question]
        for bits, prob in dist.items():
            if prob > 1e-9:
                parity = 1
                for ch in bits:
                    parity *= 1 - 2 * int(ch)
                assert parity == target, f"{question}: {bits} violates rule"


def test_bad_question_rejected():
    with pytest.raises(ValueError):
        round_circuit("ZZZ")


def test_shots_are_bounded():
    # A hostile shot count must not blow up; it is clamped, not trusted.
    assert quantum_round("XXX", shots=-5) in (0.0, 1.0)
    assert quantum_round("XXX", shots=10**12) == 1.0
