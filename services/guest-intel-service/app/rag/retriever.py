"""Retrieval over the resort's own knowledge base.

Sentence-BERT embeddings in a FAISS index when both are installed; otherwise BM25-style
lexical scoring in pure Python. For a knowledge base of a few hundred short passages
about spa timings and check-out policy, lexical retrieval is genuinely competitive — the
queries are short and use the same words as the answers.

The index is rebuilt from the database rather than persisted: it takes milliseconds at
this size, and a stale index that answers with last season's pool hours is worse than a
cold start.
"""
from __future__ import annotations

import logging
import math
import re
from collections import Counter
from dataclasses import dataclass
from threading import Lock

log = logging.getLogger(__name__)

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
TOKEN_RE = re.compile(r"[a-z0-9']+")

# BM25 parameters. k1 controls term-frequency saturation, b the length normalisation.
BM25_K1 = 1.5
BM25_B = 0.75

STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "do", "does", "did", "i", "we", "you",
    "my", "our", "your", "to", "of", "in", "on", "at", "for", "and", "or", "it", "this",
    "that", "can", "could", "would", "should", "what", "when", "where", "how", "there",
    "have", "has", "had", "be", "been", "am", "will", "with", "please", "me",
}


@dataclass(slots=True)
class Passage:
    id: str
    title: str
    content: str
    category: str


@dataclass(slots=True)
class Hit:
    passage: Passage
    score: float


def tokenise(text: str) -> list[str]:
    return [t for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS and len(t) > 1]


class Retriever:
    """Holds one property's knowledge base and answers similarity queries."""

    def __init__(self) -> None:
        self._passages: list[Passage] = []
        self._doc_tokens: list[list[str]] = []
        self._doc_freq: Counter[str] = Counter()
        self._avg_len: float = 0.0
        self._vectors = None
        self._embedder = None
        self._method = "bm25"
        self._lock = Lock()

    @property
    def method(self) -> str:
        return self._method

    @property
    def size(self) -> int:
        return len(self._passages)

    def index(self, passages: list[Passage]) -> None:
        """Rebuild from scratch. Cheap at this scale, and never stale."""
        with self._lock:
            self._passages = passages
            self._doc_tokens = [tokenise(f"{p.title} {p.content}") for p in passages]
            self._doc_freq = Counter()
            for tokens in self._doc_tokens:
                self._doc_freq.update(set(tokens))
            self._avg_len = (
                sum(len(t) for t in self._doc_tokens) / len(self._doc_tokens)
                if self._doc_tokens
                else 0.0
            )
            self._vectors = self._embed([f"{p.title}. {p.content}" for p in passages])
            self._method = "embeddings" if self._vectors is not None else "bm25"

    def search(self, query: str, *, top_k: int = 4, min_score: float = 0.05) -> list[Hit]:
        if not self._passages or not query.strip():
            return []
        if self._vectors is not None:
            hits = self._search_embeddings(query, top_k)
            if hits is not None:
                return [h for h in hits if h.score >= min_score]
        return [h for h in self._search_bm25(query, top_k) if h.score >= min_score]

    def _search_bm25(self, query: str, top_k: int) -> list[Hit]:
        terms = tokenise(query)
        if not terms:
            return []
        total_docs = len(self._passages)
        scored: list[Hit] = []
        for passage, tokens in zip(self._passages, self._doc_tokens, strict=True):
            counts = Counter(tokens)
            length = len(tokens) or 1
            score = 0.0
            for term in terms:
                frequency = counts.get(term, 0)
                if not frequency:
                    continue
                # Standard BM25 IDF, with the +1 that keeps common terms non-negative.
                idf = math.log(
                    1 + (total_docs - self._doc_freq[term] + 0.5) / (self._doc_freq[term] + 0.5)
                )
                denominator = frequency + BM25_K1 * (
                    1 - BM25_B + BM25_B * length / (self._avg_len or 1)
                )
                score += idf * (frequency * (BM25_K1 + 1)) / denominator
            if score > 0:
                scored.append(Hit(passage=passage, score=score))

        scored.sort(key=lambda h: h.score, reverse=True)
        top = scored[:top_k]
        # Normalise to 0..1 so the caller's threshold means the same thing either way.
        if top:
            best = top[0].score or 1.0
            for hit in top:
                hit.score = round(hit.score / best, 4)
        return top

    def _search_embeddings(self, query: str, top_k: int) -> list[Hit] | None:
        try:
            import numpy as np
        except ImportError:
            return None
        query_vector = self._embed([query])
        if query_vector is None:
            return None
        try:
            # Vectors are L2-normalised at embed time, so a dot product is cosine.
            similarities = (self._vectors @ query_vector[0]).tolist()
            ranked = sorted(
                zip(self._passages, similarities, strict=True), key=lambda p: p[1], reverse=True
            )
            return [
                Hit(passage=p, score=round(float(s), 4))
                for p, s in ranked[:top_k]
            ]
        except Exception:
            log.exception("embedding search failed; falling back to BM25")
            return None

    def _embed(self, texts: list[str]):
        if not texts:
            return None
        embedder = self._load_embedder()
        if embedder is None:
            return None
        try:
            return embedder.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        except Exception:
            log.exception("could not embed passages; falling back to BM25")
            return None

    def _load_embedder(self):
        if self._embedder is not None:
            return self._embedder
        from vesper_common.config import settings

        # Same reasoning as the sentiment model: downloading weights is opt-in, not a
        # side effect of the library happening to be installed.
        if not settings.concierge_use_embeddings:
            return None
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            return None
        try:
            self._embedder = SentenceTransformer(EMBEDDING_MODEL)
        except Exception:
            log.warning("could not load %s; using BM25", EMBEDDING_MODEL, exc_info=True)
            return None
        return self._embedder


# One retriever per property, built on first use.
_retrievers: dict[str, Retriever] = {}
_registry_lock = Lock()


def for_property(property_id: str) -> Retriever:
    with _registry_lock:
        retriever = _retrievers.get(property_id)
        if retriever is None:
            retriever = Retriever()
            _retrievers[property_id] = retriever
        return retriever
