"""The transition rules. Rejected edges matter as much as allowed ones — an unvalidated status
field lets a stray call produce a timeline that contradicts itself."""

from __future__ import annotations

import pytest

from app.lifecycle import allowed_next, can_transition, describe, is_known_status


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("ordered", "dispatched"),
        ("dispatched", "in_transit"),
        ("in_transit", "delivered"),
        ("pickup_triggered", "picked_up"),
    ],
)
def test_forward_edges_are_allowed(current: str, target: str) -> None:
    assert can_transition(current, target)


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("ordered", "delivered"),  # skipping stages
        ("ordered", "in_transit"),
        ("delivered", "in_transit"),  # going backwards
        ("dispatched", "ordered"),
        ("delivered", "delivered"),  # terminal
        ("picked_up", "pickup_triggered"),
        ("ordered", "picked_up"),  # crossing tracks
        ("in_transit", "pickup_triggered"),
    ],
)
def test_invalid_edges_are_rejected(current: str, target: str) -> None:
    assert not can_transition(current, target)


def test_terminal_statuses_have_no_successors() -> None:
    assert allowed_next("delivered") == frozenset()
    assert allowed_next("picked_up") == frozenset()


def test_unknown_status_is_not_transitionable() -> None:
    assert not is_known_status("exploded")
    assert allowed_next("exploded") == frozenset()
    assert not can_transition("ordered", "exploded")


def test_describe_names_the_order() -> None:
    assert "DME-10231" in describe("in_transit", "DME-10231")
