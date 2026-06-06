"""Website chatbot — role-aware, read-only, grounded, multilingual.

Intent-router + grounded handlers (Approach C). Each handler fetches ONLY real
data it needs from the existing data layer and returns (facts, sources). The LLM
adapter then phrases those facts in the shared empathetic voice — it never sees
raw data and never invents numbers.

Grounded only on: Dataset.csv (clean.csv) + scraped e-RaktKosh + curated FAQ.

Run as a smoke test:  .venv/bin/python -m backend.tests.test_chatbot
"""
from __future__ import annotations

from typing import Optional

from .store import get_donor, get_patient
from .bridge import patient_bridges
from ..utils.eligibility import days_until_eligible, is_eligible
from ..utils.compat import normalize_blood_group
from . import knowledge
from . import supply_store_shim as _stock
from .outreach import get_llm


# ── Handlers: each returns (facts: dict, sources: list[str]) ─────────────

def _personal_eligibility(role: str, user_id: Optional[str], message: str) -> tuple[dict, list]:
    if role != "donor":
        return {"note": "wrong_role"}, []
    if not user_id:
        return {"note": "no_record"}, []
    donor = get_donor(user_id)
    if not donor:
        return {"note": "no_record"}, []
    facts = {
        "eligible": is_eligible(donor),
        "days_until": max(0, days_until_eligible(donor)),
        "total_donations": int(donor.get("donations_till_date", 0) or 0),
    }
    return facts, ["Dataset.csv"]


def _bridge_status(role: str, user_id: Optional[str], message: str) -> tuple[dict, list]:
    if role != "patient":
        return {"note": "wrong_role"}, []
    if not user_id or not get_patient(user_id):
        return {"note": "no_record"}, []
    bridges = patient_bridges(user_id)
    summary = [
        {"integrity": b.get("integrity", "Unknown"),
         "donors": len(b.get("donors", []))}
        for b in bridges
    ]
    return {"bridges": summary}, ["Dataset.csv", "bridge engine"]


def _stock_lookup(role: str, user_id: Optional[str], message: str) -> tuple[dict, list]:
    group = _extract_blood_group(message)
    district = _extract_district(message)
    if not district:
        # Try the user's own location if we have a record
        rec = (get_donor(user_id) or get_patient(user_id)) if user_id else None
        if not rec:
            return {"note": "need_location", "blood_group": group}, []
        banks = _stock.banks_with_stock(
            blood_group=group,
            lat=float(rec.get("latitude")) if rec.get("latitude") is not None else None,
            lon=float(rec.get("longitude")) if rec.get("longitude") is not None else None,
            limit=5,
        )
        district = "your area"
    else:
        banks = _stock.banks_with_stock(district=district, blood_group=group, limit=5)
    slim = [{"name": b["name"], "district": b["district"],
             "available_units": b["available_units"], "blood_group": b["blood_group"]}
            for b in banks]
    return {"blood_group": group, "district": district, "banks": slim}, ["e-RaktKosh scraped data"]


def _general_faq(role: str, user_id: Optional[str], message: str) -> tuple[dict, list]:
    hit = knowledge.lookup(message)
    if not hit:
        return {}, []  # let handle_chat fall through to a fallback reply
    return {"answer": hit["answer"]}, [hit["source"]]


def _fallback(role: str, user_id: Optional[str], message: str) -> tuple[dict, list]:
    return {"note": "fallback"}, []


HANDLERS = {
    "personal_eligibility": _personal_eligibility,
    "bridge_status": _bridge_status,
    "stock_lookup": _stock_lookup,
    "general_faq": _general_faq,
    "fallback": _fallback,
}


# ── Light extractors (deterministic, no LLM) ─────────────────────────────

_BG_TOKENS = {
    "o+": "O+", "o-": "O-", "a+": "A+", "a-": "A-", "b+": "B+", "b-": "B-",
    "ab+": "AB+", "ab-": "AB-",
}


def _extract_blood_group(message: str) -> Optional[str]:
    t = message.lower().replace(" ", "")
    for token, canon in _BG_TOKENS.items():
        if token in t:
            return normalize_blood_group(canon)
    return None


# Known district keywords; extend as needed. Matches against the message text.
_KNOWN_DISTRICTS = ["hyderabad", "rangareddy", "medchal", "warangal", "karimnagar"]


def _extract_district(message: str) -> Optional[str]:
    t = message.lower()
    for d in _KNOWN_DISTRICTS:
        if d in t:
            return d.capitalize()
    return None


# ── Entry point ──────────────────────────────────────────────────────────

def handle_chat(message: str, role: str = "public",
                user_id: Optional[str] = None, lang: Optional[str] = None) -> dict:
    """Classify → dispatch to a grounded handler → phrase warmly. Read-only."""
    llm = get_llm()
    lang = lang or llm.detect_language(message)
    intent = llm.classify_intent(message)["intent"]
    handler = HANDLERS.get(intent, _fallback)
    facts, sources = handler(role, user_id, message)
    reply = llm.compose_chat_reply(facts, {"role": role}, lang)
    return {
        "reply": reply,
        "intent": intent,
        "lang": lang,
        "grounded_facts": facts,
        "sources": sources,
    }
