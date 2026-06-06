"""Curated, cite-able FAQ facts for the chatbot's general_faq handler.

Every entry carries a source so answers stay grounded and honest. These are
domain facts (not user data) drawn from the project's Problem Statement and
Blood Warriors' own published model. The chatbot phrases them warmly but never
adds medical claims beyond what's here.

Run as a smoke test:  .venv/bin/python -m backend.tests.test_knowledge
"""
from __future__ import annotations

import re
from typing import Optional

FAQ: list[dict] = [
    {
        "id": "what_is_thalassemia",
        "keywords": ["what is thalassemia", "thalassemia", "thalassaemia", "blood disorder"],
        "answer": (
            "Thalassemia is an inherited blood disorder where the body makes less "
            "healthy hemoglobin. People with the major form need regular blood "
            "transfusions throughout their life — it is a lifelong condition, "
            "managed with ongoing care."
        ),
        "source": "Problem Statement.pdf / Blood Warriors",
    },
    {
        "id": "how_often_transfusion",
        "keywords": ["how often", "transfusion", "how many days", "frequency", "cycle"],
        "answer": (
            "Most thalassemia patients need a transfusion roughly every 15–20 days, "
            "every cycle, for life. That steady demand is why a reliable group of "
            "donors matters so much."
        ),
        "source": "Blood Warriors Blood Bridge model",
    },
    {
        "id": "blood_bridge",
        "keywords": ["blood bridge", "bridge", "8 to 1", "squad", "how many donors"],
        "answer": (
            "A Blood Bridge links about 8–10 donors to one patient. Because donors "
            "can only give every so often, several share the responsibility so the "
            "patient always has someone available for each cycle."
        ),
        "source": "Blood Warriors Blood Bridge model",
    },
    {
        "id": "donation_eligibility",
        "keywords": ["who can donate", "am i eligible", "how often can i donate",
                     "90 days", "donate again", "donation gap"],
        "answer": (
            "A healthy adult can usually donate whole blood once every 90 days. "
            "After you donate, your body needs that time to recover before the next "
            "donation."
        ),
        "source": "90-day whole-blood interval (eligibility rule)",
    },
]


def _matches(keyword: str, text: str) -> bool:
    """True if keyword appears in text on word boundaries (case-insensitive already lowered)."""
    return re.search(r"\b" + re.escape(keyword) + r"\b", text) is not None


def lookup(message: str) -> Optional[dict]:
    """Return the best-matching FAQ entry, or None if nothing matches.

    Scores each entry by how many of its keywords appear in the message; the
    longest matched keyword wins ties (more specific match).
    """
    text = message.lower()
    best: Optional[dict] = None
    best_score = 0
    for entry in FAQ:
        score = sum(len(kw) for kw in entry["keywords"] if _matches(kw, text))
        if score > best_score:
            best_score = score
            best = entry
    return best
