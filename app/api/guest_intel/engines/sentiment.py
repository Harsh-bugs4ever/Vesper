"""Sentiment scoring for guest comments.

The prototype counted keywords, which is why "the room was not clean" scored positive —
it saw "clean". Replacing that is a named Day 1 bug fix.

Preference order:
  1. A fine-tuned transformer, when VESPER_SENTIMENT_USE_TRANSFORMER is on. Handles
     negation, sarcasm and intensity properly. Off by default: loading it downloads
     roughly 500MB of weights, and a cold deployment must not make the first guest to
     rate their breakfast wait for that.
  2. A lexicon model with negation scope, intensifiers and contrast handling. Pure
     Python. Not a neural net, but it gets "not clean" right, which is the whole point.

Every score carries the method that produced it so the UI never implies more rigour
than was actually applied.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from functools import lru_cache

from vesper_common.config import settings

log = logging.getLogger(__name__)


@dataclass(slots=True)
class Sentiment:
    # -1.0 (furious) .. +1.0 (delighted)
    score: float
    label: str
    confidence: float
    method: str


# Words carrying sentiment on their own, weighted by strength.
POSITIVE = {
    "excellent": 1.0, "outstanding": 1.0, "perfect": 1.0, "amazing": 0.9, "wonderful": 0.9,
    "fantastic": 0.9, "delightful": 0.85, "lovely": 0.75, "great": 0.75, "good": 0.55,
    "clean": 0.6, "spotless": 0.9, "friendly": 0.7, "helpful": 0.7, "quick": 0.5,
    "fast": 0.5, "prompt": 0.6, "comfortable": 0.65, "polite": 0.65, "courteous": 0.7,
    "fresh": 0.55, "delicious": 0.85, "tasty": 0.7, "warm": 0.4, "attentive": 0.7,
    "professional": 0.6, "impressed": 0.8, "recommend": 0.7, "enjoyed": 0.7, "happy": 0.75,
    "satisfied": 0.6, "pleasant": 0.6, "smooth": 0.55, "thanks": 0.5, "thank": 0.5,
}

NEGATIVE = {
    "terrible": -1.0, "awful": -1.0, "horrible": -1.0, "worst": -1.0, "disgusting": -1.0,
    "filthy": -0.95, "dirty": -0.8, "unclean": -0.8, "rude": -0.9, "unhelpful": -0.75,
    "slow": -0.6, "late": -0.6, "delayed": -0.6, "cold": -0.5, "stale": -0.7,
    "broken": -0.75, "noisy": -0.65, "smell": -0.7, "smelly": -0.8, "uncomfortable": -0.7,
    "disappointed": -0.8, "disappointing": -0.8, "poor": -0.7, "bad": -0.6, "worse": -0.7,
    "unacceptable": -0.95, "ignored": -0.8, "waiting": -0.5, "waited": -0.55, "never": -0.4,
    "complaint": -0.6, "problem": -0.5, "issue": -0.45, "refund": -0.6, "leak": -0.7,
    "overpriced": -0.7, "expensive": -0.4, "cramped": -0.6, "tiny": -0.4,
}

# Flip the polarity of what follows, within a short window.
NEGATIONS = {"not", "no", "never", "without", "isn't", "wasn't", "aren't", "weren't",
             "don't", "didn't", "doesn't", "can't", "couldn't", "won't", "wouldn't",
             "hardly", "barely", "neither", "nor", "lacking", "lacked"}
# How many tokens after a negation stay flipped. Three catches "not very clean" without
# swallowing the next clause.
NEGATION_WINDOW = 3

INTENSIFIERS = {"very": 1.5, "really": 1.4, "extremely": 1.8, "incredibly": 1.7,
                "absolutely": 1.6, "totally": 1.5, "so": 1.3, "quite": 1.15,
                "too": 1.3, "highly": 1.4, "super": 1.4}
DIMINISHERS = {"slightly": 0.5, "somewhat": 0.6, "a bit": 0.6, "fairly": 0.75,
               "rather": 0.8, "kind of": 0.6, "sort of": 0.6}

# After one of these, what came before matters less: "the room was nice but filthy".
CONTRAST_MARKERS = {"but", "however", "although", "though", "except", "unfortunately"}

TOKEN_RE = re.compile(r"[a-z']+")


def analyse(text: str | None) -> Sentiment:
    if not text or not text.strip():
        return Sentiment(score=0.0, label="neutral", confidence=0.0, method="empty")

    transformer = _transformer(text)
    if transformer is not None:
        return transformer
    return _lexicon(text)


def _lexicon(text: str) -> Sentiment:
    tokens = TOKEN_RE.findall(text.lower())
    if not tokens:
        return Sentiment(score=0.0, label="neutral", confidence=0.0, method="lexicon")

    total = 0.0
    matched = 0
    negation_countdown = 0
    multiplier = 1.0
    # Everything before a contrast marker is downweighted once we hit one.
    contrast_seen = False
    pre_contrast: list[float] = []
    post_contrast: list[float] = []

    for token in tokens:
        if token in CONTRAST_MARKERS:
            contrast_seen = True
            negation_countdown = 0
            multiplier = 1.0
            continue

        if token in NEGATIONS:
            negation_countdown = NEGATION_WINDOW
            continue

        if token in INTENSIFIERS:
            multiplier = INTENSIFIERS[token]
            continue
        if token in DIMINISHERS:
            multiplier = DIMINISHERS[token]
            continue

        weight = POSITIVE.get(token) or NEGATIVE.get(token)
        if weight is None:
            if negation_countdown:
                negation_countdown -= 1
            continue

        value = weight * multiplier
        if negation_countdown:
            # "not clean" is negative, but weaker than "filthy" — negating a positive
            # states an absence, it does not assert the opposite extreme.
            value = -value * 0.75
            negation_countdown -= 1

        matched += 1
        multiplier = 1.0
        (post_contrast if contrast_seen else pre_contrast).append(value)

    if not matched:
        return Sentiment(score=0.0, label="neutral", confidence=0.1, method="lexicon")

    # "Nice but filthy" is a complaint: what follows the contrast dominates.
    if post_contrast:
        total = sum(pre_contrast) * 0.35 + sum(post_contrast)
        count = len(pre_contrast) * 0.35 + len(post_contrast)
    else:
        total = sum(pre_contrast)
        count = len(pre_contrast)

    score = max(-1.0, min(1.0, total / max(count, 1)))
    # More sentiment-bearing words means a more reliable read, up to a point.
    confidence = min(0.75, 0.3 + matched * 0.1)
    return Sentiment(
        score=round(score, 4),
        label=to_label(score),
        confidence=round(confidence, 4),
        method="lexicon",
    )


def _transformer(text: str) -> Sentiment | None:
    pipeline = _load_pipeline()
    if pipeline is None:
        return None
    try:
        result = pipeline(text[:512])[0]
    except Exception:
        log.exception("sentiment model failed; falling back to the lexicon")
        return None

    label = str(result["label"]).lower()
    confidence = float(result["score"])
    # Map the model's three-way label onto our signed scale, scaled by its own certainty.
    if label.startswith("pos"):
        score = confidence
    elif label.startswith("neg"):
        score = -confidence
    else:
        score = 0.0
    return Sentiment(
        score=round(score, 4),
        label=to_label(score),
        confidence=round(confidence, 4),
        method="transformer",
    )


@lru_cache(maxsize=1)
def _load_pipeline():
    """Loaded once per process, and never fatally.

    Gated on the setting rather than on the import: `transformers` being present in the
    image is not consent to spend a minute downloading weights mid-request.
    """
    if not settings.sentiment_use_transformer:
        return None
    try:
        from transformers import pipeline
    except ImportError:
        log.warning("sentiment transformer requested but transformers is not installed")
        return None
    try:
        return pipeline("sentiment-analysis", model=settings.sentiment_model, truncation=True)
    except Exception:
        log.warning(
            "could not load %s; using the lexicon model", settings.sentiment_model, exc_info=True
        )
        return None


def to_label(score: float) -> str:
    if score >= 0.5:
        return "delighted"
    if score >= 0.15:
        return "positive"
    if score > -0.15:
        return "neutral"
    if score > -0.5:
        return "negative"
    return "upset"


def from_rating(rating: int) -> float:
    """A 1-5 star rating as a signed score, for comments that have none."""
    return round((rating - 3) / 2, 4)
