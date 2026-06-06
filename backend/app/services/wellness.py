"""Wellness suggestion bank — role-filtered, source-cited, non-prescriptive.

Loads data/wellness_suggestions.csv once (cached). The chatbot's _wellness handler
calls suggest(audience, topic) to get vetted rows; the LLM only phrases them.

Safety: suggest() filters by audience so a patient never receives a donor-only row
(iron-overload trap), and anonymous/admin users get only audience="any" rows.

Run as a smoke test:  .venv/bin/python -m backend.tests.test_wellness
"""
from __future__ import annotations

import csv
import functools
import os
from typing import Optional

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
CSV_PATH = os.path.join(HERE, "data", "wellness_suggestions.csv")

TOPIC_KEYWORDS = {
    "diet": ["eat", "food", "diet", "nutrition", "meal", "khana", "aahar"],
    "hydration": ["water", "drink", "hydrat", "sleep", "rest", "routine", "habit"],
    "emotional": ["sad", "stress", "anxious", "lonely", "alone", "depress",
                  "feel", "cope", "mental", "worried", "scared", "overwhelm"],
}


@functools.lru_cache(maxsize=1)
def load() -> list:
    """Read the suggestion CSV once. Returns a list of row dicts."""
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def suggest(audience: str, topic: Optional[str] = None, limit: int = 3) -> list[dict]:
    """Vetted rows for this audience (+ 'any'), optionally a topic, caution rows first.

    Never returns a row for the *other* specific role — the core safety filter.
    """
    rows = [r for r in load() if r["audience"] in (audience, "any")]
    if topic:
        rows = [r for r in rows if r["topic"] == topic]
    # caution rows first, then original file order (sorted is stable)
    rows = sorted(rows, key=lambda r: 0 if r.get("caution_flag", "none") != "none" else 1)
    return rows[:limit]


def detect_topic(message: str) -> Optional[str]:
    """Light keyword match → diet | hydration | emotional, or None for no specific topic."""
    t = message.lower()
    best, best_score = None, 0
    for topic, kws in TOPIC_KEYWORDS.items():
        score = sum(1 for kw in kws if kw in t)
        if score > best_score:
            best_score, best = score, topic
    return best
