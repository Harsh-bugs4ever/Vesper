"""Guest DNA and at-risk detection.

Guest DNA is a profile built from what a guest actually did rather than what they told
us: what they ordered, when they ordered it, what they complained about, how they rated
things. The output is preference chips a front-desk agent can act on in five seconds.

At-risk detection asks a narrower question: is this returning guest drifting away? The
signal is a drop against *their own* rhythm, not against the average guest — somebody who
visits quarterly is not at risk in month two, and somebody who came weekly until March is.
"""
from __future__ import annotations

import statistics
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from itertools import pairwise


@dataclass(slots=True)
class Preference:
    """One chip on the Guest DNA card."""

    key: str
    label: str
    detail: str
    # How sure we are, driven by how many observations support it.
    confidence: float


@dataclass(slots=True)
class DnaProfile:
    preferences: list[Preference] = field(default_factory=list)
    favourite_items: list[str] = field(default_factory=list)
    average_sentiment: float = 0.0
    sentiment_label: str = "neutral"
    complaint_themes: list[str] = field(default_factory=list)
    # Where this guest sits: "new", "occasional", "regular", "loyal".
    segment: str = "new"
    observations: int = 0


@dataclass(slots=True)
class RiskProfile:
    is_at_risk: bool
    risk_score: float
    reasons: list[str]
    # Days between visits, historically. None when they have only ever come once.
    typical_gap_days: float | None
    days_since_last_visit: int | None
    suggested_offer: dict | None


# A guest needs at least this many visits before "their rhythm" means anything.
MIN_VISITS_FOR_RHYTHM = 3
# Overdue by this multiple of their own typical gap counts as drifting.
OVERDUE_MULTIPLIER = 1.75

SEGMENTS = ((10, "loyal"), (4, "regular"), (2, "occasional"), (0, "new"))

# Complaint themes we can name from a comment, for the sentiment trend chart.
THEME_KEYWORDS = {
    "cleanliness": {
        "clean", "cleaned", "dirty", "filthy", "unclean", "dust", "dusty", "stain",
        "stained", "smell", "smells", "smelly", "hygiene", "mould", "grubby",
    },
    "service speed": {
        "slow", "slowly", "wait", "waited", "waiting", "late", "delayed", "forgot",
        "forgotten", "delay",
    },
    "staff attitude": {
        "rude", "unhelpful", "ignored", "polite", "friendly", "attentive", "helpful",
        "courteous",
    },
    "food quality": {
        "food", "cold", "stale", "tasty", "delicious", "breakfast", "dinner", "lunch",
        "undercooked", "bland",
    },
    "room comfort": {
        "bed", "pillow", "noisy", "noise", "ac", "air", "hot", "cramped", "mattress",
        "stuffy",
    },
    "value": {"expensive", "overpriced", "value", "charge", "charged", "bill", "refund"},
}


def build_profile(
    *,
    orders: list[dict],
    ratings: list[dict],
    visits: list[dict],
    total_stays: int,
) -> DnaProfile:
    """Turn raw history into preference chips.

    Every chip carries its own confidence rather than a single profile-wide number: we
    may be certain about their breakfast order and guessing about their spa habits.
    """
    profile = DnaProfile(observations=len(orders) + len(ratings) + len(visits))
    profile.segment = _segment(total_stays)

    item_counts: Counter[str] = Counter()
    hour_counts: Counter[int] = Counter()
    for order in orders:
        for line in order.get("items", []) or []:
            item_counts[line.get("name", "")] += int(line.get("quantity", 1))
        hour = order.get("hour")
        if hour is not None:
            hour_counts[int(hour)] += 1
    item_counts.pop("", None)

    profile.favourite_items = [name for name, _ in item_counts.most_common(5)]

    # A repeat order is a preference; a single order is a data point.
    for name, count in item_counts.most_common(3):
        if count >= 2:
            profile.preferences.append(
                Preference(
                    key="favourite_item",
                    label=name,
                    detail=f"Ordered {count} times",
                    confidence=round(min(0.95, 0.45 + count * 0.12), 3),
                )
            )

    if hour_counts:
        peak_hour, peak_count = hour_counts.most_common(1)[0]
        if peak_count >= 2:
            profile.preferences.append(
                Preference(
                    key="ordering_time",
                    label=_describe_hour(peak_hour),
                    detail=f"{peak_count} orders around {peak_hour:02d}:00",
                    confidence=round(min(0.9, 0.4 + peak_count * 0.12), 3),
                )
            )

    outlet_counts = Counter(v.get("outlet") for v in visits if v.get("outlet"))
    for outlet, count in outlet_counts.most_common(2):
        if count >= 2:
            profile.preferences.append(
                Preference(
                    key="favourite_outlet",
                    label=str(outlet),
                    detail=f"Visited {count} times",
                    confidence=round(min(0.9, 0.4 + count * 0.15), 3),
                )
            )

    scores = [float(r["sentiment_score"]) for r in ratings if r.get("sentiment_score") is not None]
    if scores:
        profile.average_sentiment = round(statistics.fmean(scores), 4)
        profile.sentiment_label = _sentiment_label(profile.average_sentiment)

    profile.complaint_themes = detect_themes(
        " ".join(r.get("comment") or "" for r in ratings if float(r.get("sentiment_score") or 0) < -0.15)
    )
    for theme in profile.complaint_themes[:2]:
        profile.preferences.append(
            Preference(
                key="sensitive_to",
                label=f"Sensitive about {theme}",
                detail="Raised in a previous complaint",
                confidence=0.6,
            )
        )

    profile.preferences.sort(key=lambda p: p.confidence, reverse=True)
    return profile


def detect_themes(text: str) -> list[str]:
    """Which themes a body of complaint text touches, most-mentioned first."""
    if not text.strip():
        return []
    words = set(text.lower().replace(".", " ").replace(",", " ").split())
    hits = [
        (theme, len(words & keywords))
        for theme, keywords in THEME_KEYWORDS.items()
        if words & keywords
    ]
    return [theme for theme, _ in sorted(hits, key=lambda h: h[1], reverse=True)]


def assess_risk(
    *,
    visit_dates: list[date],
    today: date,
    average_spend: float,
    recent_sentiment: float,
    segment: str,
) -> RiskProfile:
    """Is this guest drifting away?

    Measured against their own cadence. Comparing everyone to a single global threshold
    would flag every quarterly visitor and miss the weekly regular who stopped.
    """
    reasons: list[str] = []
    if not visit_dates:
        return RiskProfile(
            is_at_risk=False,
            risk_score=0.0,
            reasons=["No visit history yet"],
            typical_gap_days=None,
            days_since_last_visit=None,
            suggested_offer=None,
        )

    ordered = sorted(visit_dates)
    last_visit = ordered[-1]
    days_since = (today - last_visit).days

    if len(ordered) < MIN_VISITS_FOR_RHYTHM:
        # Not enough history to know their rhythm. A one-time guest who has not come
        # back is not "at risk" — they were never a regular.
        return RiskProfile(
            is_at_risk=False,
            risk_score=0.0,
            reasons=[f"Only {len(ordered)} visit(s) — not enough to establish a pattern"],
            typical_gap_days=None,
            days_since_last_visit=days_since,
            suggested_offer=None,
        )

    gaps = [(b - a).days for a, b in pairwise(ordered)]
    typical_gap = statistics.median(gaps)
    risk = 0.0

    if typical_gap > 0 and days_since > typical_gap * OVERDUE_MULTIPLIER:
        overdue_ratio = days_since / typical_gap
        risk += min(0.6, (overdue_ratio - 1) * 0.35)
        reasons.append(
            f"Last visit {days_since} days ago; they normally return every "
            f"{typical_gap:.0f} days"
        )

    # Their visits thinning out even before they stop is the earlier warning.
    if len(gaps) >= 3:
        early = statistics.fmean(gaps[: len(gaps) // 2])
        late = statistics.fmean(gaps[len(gaps) // 2 :])
        if late > early * 1.4:
            risk += 0.2
            reasons.append(
                f"Visits are spacing out — every {early:.0f} days before, {late:.0f} now"
            )

    if recent_sentiment < -0.15:
        risk += 0.25
        reasons.append(f"Recent feedback was {_sentiment_label(recent_sentiment)}")

    # Losing a high spender matters more, so it takes less drift to warrant an offer.
    if average_spend > 8000:
        risk += 0.1
        reasons.append(f"High average spend of ₹{average_spend:,.0f} per visit")

    risk = round(min(1.0, risk), 4)
    is_at_risk = risk >= 0.4
    return RiskProfile(
        is_at_risk=is_at_risk,
        risk_score=risk,
        reasons=reasons,
        typical_gap_days=round(typical_gap, 1),
        days_since_last_visit=days_since,
        suggested_offer=_suggest_offer(risk, average_spend, segment) if is_at_risk else None,
    )


def _suggest_offer(risk: float, average_spend: float, segment: str) -> dict:
    """Size the offer to what the guest is worth and how far gone they are.

    Capped at 25%: past that it stops being a retention offer and starts training
    regulars to wait for a discount.
    """
    base = 0.10
    if segment == "loyal":
        base += 0.05
    if average_spend > 8000:
        base += 0.05
    discount = min(0.25, base + risk * 0.10)

    return {
        "type": "discount",
        "discount_pct": round(discount * 100, 1),
        "estimated_value": round(average_spend * discount, 2),
        "rationale": f"{segment.title()} guest, {risk:.0%} churn risk",
        "channel": "whatsapp",
    }


def _segment(total_stays: int) -> str:
    for threshold, name in SEGMENTS:
        if total_stays >= threshold:
            return name
    return "new"


def _sentiment_label(score: float) -> str:
    if score >= 0.5:
        return "delighted"
    if score >= 0.15:
        return "positive"
    if score > -0.15:
        return "neutral"
    if score > -0.5:
        return "negative"
    return "upset"


def _describe_hour(hour: int) -> str:
    if hour < 11:
        return "Early riser"
    if hour < 16:
        return "Afternoon orders"
    if hour < 22:
        return "Evening diner"
    return "Late-night orders"
