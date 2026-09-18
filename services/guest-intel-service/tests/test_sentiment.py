"""Sentiment scoring.

The headline case is the prototype bug this replaces: a keyword counter scored "the room
was not clean" as positive because it saw the word "clean". Negation, contrast and
intensity are the whole reason this module exists.

These exercise the lexicon path, which is what runs by default.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(SERVICE_ROOT.parents[1] / "packages" / "py-common"))

from app.engines import sentiment  # noqa: E402


def score(text: str) -> float:
    return sentiment.analyse(text).score


# --- the bug this module was written to fix ---------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "The room was not clean",
        "the bathroom was not clean at all",
        "service was not helpful",
        "the staff were not friendly",
        "this is not good",
    ],
)
def test_negated_praise_is_a_complaint(text):
    """The prototype scored every one of these positive."""
    assert score(text) < 0, f"{text!r} must not read as positive"


@pytest.mark.parametrize(
    "text",
    [
        "The room was spotless",
        "excellent service, very friendly staff",
        "the food was delicious and the staff were attentive",
    ],
)
def test_praise_still_reads_as_praise(text):
    assert score(text) > 0


@pytest.mark.parametrize(
    "text",
    ["terrible service", "the room was filthy", "absolutely awful, worst stay ever"],
)
def test_complaints_read_as_complaints(text):
    assert score(text) < 0


# --- the harder linguistic cases ---------------------------------------------------


def test_contrast_lets_the_complaint_win():
    """"Nice but filthy" is a complaint, not a mixed review."""
    assert score("The room was nice but filthy") < 0


def test_contrast_works_in_the_other_direction_too():
    assert score("The wait was slow but the food was absolutely delicious") > 0


def test_intensifiers_deepen_the_score():
    # "slow" sits mid-scale, so there is room for an intensifier to show up.
    assert score("very slow") < score("slow") < 0


def test_the_scale_saturates_rather_than_overflowing():
    """"Terrible" is already the floor, so intensifying it changes nothing.

    That is the bounded scale working, not the intensifier failing — a review cannot be
    worse than the worst.
    """
    assert score("terrible") == score("absolutely terrible") == -1.0


def test_diminishers_soften_the_score():
    assert score("slightly disappointing") > score("disappointing")


def test_negating_praise_is_weaker_than_asserting_the_opposite():
    """"Not clean" states an absence; "filthy" is an accusation."""
    assert score("filthy") < score("not clean") < 0


def test_neutral_text_lands_near_zero():
    result = sentiment.analyse("I checked in at two o'clock")
    assert abs(result.score) < 0.15
    assert result.label == "neutral"


def test_empty_input_is_neutral_with_no_confidence():
    for text in ("", "   ", None):
        result = sentiment.analyse(text)
        assert result.score == 0.0
        assert result.confidence == 0.0


def test_score_always_stays_in_range():
    extreme = "absolutely terrible awful horrible disgusting filthy rude " * 10
    assert -1.0 <= score(extreme) <= 1.0
    assert -1.0 <= score("excellent perfect amazing wonderful " * 10) <= 1.0


# --- reporting ---------------------------------------------------------------------


def test_every_result_names_its_method():
    """The UI shows how a score was produced; it must never have to assume."""
    assert sentiment.analyse("lovely stay").method in {"lexicon", "transformer"}


def test_more_evidence_means_more_confidence():
    sparse = sentiment.analyse("good")
    rich = sentiment.analyse("good, clean, friendly, quick and delicious")
    assert rich.confidence > sparse.confidence


@pytest.mark.parametrize(
    ("value", "expected"),
    [(0.8, "delighted"), (0.3, "positive"), (0.0, "neutral"), (-0.3, "negative"), (-0.9, "upset")],
)
def test_labels_match_the_score_bands(value, expected):
    assert sentiment.to_label(value) == expected


@pytest.mark.parametrize(
    ("stars", "sign"), [(5, 1), (4, 1), (3, 0), (2, -1), (1, -1)]
)
def test_star_ratings_convert_with_the_right_sign(stars, sign):
    value = sentiment.from_rating(stars)
    assert (value > 0) == (sign > 0)
    assert (value < 0) == (sign < 0)
    assert -1.0 <= value <= 1.0
