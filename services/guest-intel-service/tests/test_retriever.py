"""Concierge retrieval.

The concierge answers only from what retrieval returns, so a retrieval miss is the
difference between "the spa closes at 9" and an invented closing time.
"""
from __future__ import annotations

import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(SERVICE_ROOT.parents[1] / "packages" / "py-common"))

from app.rag.retriever import Passage, Retriever  # noqa: E402

PASSAGES = [
    Passage("1", "Swimming pool timings", "The rooftop pool is open from 6:00 AM to 9:00 PM daily. Children under 12 must be accompanied.", "facilities"),
    Passage("2", "Spa timings and booking", "The Quan Spa is open from 9:00 AM to 9:00 PM. Book treatments two hours ahead on extension 4444.", "facilities"),
    Passage("3", "Check-in and check-out", "Check-in is from 2:00 PM and check-out is by 12:00 noon. Late check-out is subject to availability.", "policy"),
    Passage("4", "Breakfast", "Breakfast is served at the all-day dining restaurant from 7:00 AM to 10:30 AM on weekdays.", "dining"),
    Passage("5", "Airport transfer", "The airport is 20 minutes away. Transfers are arranged through the concierge on extension 3333.", "services"),
    Passage("6", "Laundry service", "Laundry collected before 9:00 AM is returned the same evening. Express service carries a surcharge.", "services"),
]


def build() -> Retriever:
    retriever = Retriever()
    retriever.index(PASSAGES)
    return retriever


def top_title(retriever: Retriever, query: str) -> str | None:
    hits = retriever.search(query, top_k=3)
    return hits[0].passage.title if hits else None


def test_a_direct_question_finds_its_passage():
    assert top_title(build(), "what time does the spa close") == "Spa timings and booking"


def test_questions_phrased_differently_still_land():
    retriever = build()
    assert top_title(retriever, "when is breakfast served") == "Breakfast"
    assert top_title(retriever, "how do I get to the airport") == "Airport transfer"
    assert top_title(retriever, "when does the pool open") == "Swimming pool timings"


def test_plurals_and_inflections_still_match():
    """Guests write "timing" and "dog"; the passages say "timings" and "dogs"."""
    retriever = build()
    assert top_title(retriever, "pool timing") == "Swimming pool timings"
    assert top_title(retriever, "spa booked") == "Spa timings and booking"


def test_a_pure_synonym_is_a_known_limitation_of_lexical_search():
    """"Clothes washed" shares no word with "laundry", so BM25 cannot reach it.

    Documented rather than asserted away: this is precisely the gap the optional
    embedding path (VESPER_CONCIERGE_USE_EMBEDDINGS) closes. Until it is on, the
    concierge escalates this question to the front desk rather than inventing an
    answer, which is the safe failure.
    """
    hits = build().search("can I have my clothes washed", top_k=3)
    assert not hits or hits[0].passage.title != "Laundry service"


def test_pool_and_spa_are_not_confused():
    """Both are facilities with opening hours — the classic near-miss."""
    retriever = build()
    assert top_title(retriever, "is the pool open in the evening") == "Swimming pool timings"
    assert top_title(retriever, "spa booking") == "Spa timings and booking"


def test_an_unanswerable_question_returns_nothing_usable():
    """No passage means the concierge escalates instead of inventing an answer."""
    hits = build().search("what is the wifi password for the helipad drone", top_k=3)
    assert not hits or all(h.score < 0.3 for h in hits)


def test_results_are_ranked_best_first():
    hits = build().search("check out time", top_k=4)
    assert hits
    assert [h.score for h in hits] == sorted((h.score for h in hits), reverse=True)


def test_scores_are_normalised():
    for hit in build().search("spa", top_k=4):
        assert 0.0 <= hit.score <= 1.0


def test_top_k_is_respected():
    assert len(build().search("the", top_k=2)) <= 2


def test_an_empty_query_returns_nothing():
    assert build().search("", top_k=3) == []
    assert build().search("   ", top_k=3) == []


def test_an_empty_index_returns_nothing():
    assert Retriever().search("spa timings", top_k=3) == []


def test_a_stopword_only_query_returns_nothing():
    """"What is the" carries no signal and must not match at random."""
    assert build().search("what is the", top_k=3) == []


def test_reindexing_replaces_rather_than_appends():
    retriever = build()
    assert retriever.size == len(PASSAGES)
    retriever.index(PASSAGES[:2])
    assert retriever.size == 2


def test_new_content_is_searchable_straight_away():
    """A passage added in the admin panel must be answerable immediately."""
    retriever = build()
    retriever.index(
        PASSAGES + [Passage("7", "Pet policy", "Guide dogs are welcome. Other pets cannot be accommodated.", "policy")]
    )
    assert top_title(retriever, "can I bring my dog") == "Pet policy"


def test_the_retriever_names_its_method():
    """"embeddings" or "bm25" — the UI states which, never implies."""
    assert build().method in {"bm25", "embeddings"}
