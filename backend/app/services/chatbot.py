"""Website chatbot — role-aware, read-only, grounded, multilingual.

Intent-router + grounded handlers (Approach C). Each handler fetches ONLY real
data it needs from the existing data layer and returns (facts, sources). The LLM
adapter then phrases those facts in the shared empathetic voice — it never sees
raw data and never invents numbers.

Grounded only on: Dataset.csv (clean.csv) + scraped e-RaktKosh + curated FAQ.

Run as a smoke test:  .venv/bin/python -m backend.tests.test_chatbot
"""
from __future__ import annotations

import math
from typing import Optional

from .store import get_donor, get_patient
from .bridge import patient_bridges
from ..utils.eligibility import days_until_eligible, is_eligible
from ..utils.compat import normalize_blood_group
from . import knowledge
from . import wellness
from . import supply_store_shim as _stock
from .outreach import get_llm

# Situational keyword → FAQ id mapping (first match wins)
_SITUATIONAL_MAP: list[tuple[list[str], str]] = [
    # Specific physical conditions — check these FIRST (before generic "want to donate")
    (["haven't slept", "no sleep", "didn't sleep", "not slept", "havent slept",
      "didnt sleep", "sleep deprived", "lack of sleep", "bad night", "couldnt sleep",
      "couldn't sleep", "exhausted", "sleepy", "tired", "no rest"], "situational_sleep_tired"),
    (["i have a cold", "i have flu", "i have fever", "feeling sick", "unwell",
      "runny nose", "sore throat", "cough", "body ache", "feeling feverish", "got fever",
      "sick today", "coming down with", "cold and flu", "have cold", "have fever",
      "have flu", "i am sick", "im sick", "feeling ill", "not well"], "situational_cold_flu_fever"),
    (["on medication", "taking medicine", "taking pills", "on tablets",
      "antibiotics", "blood thinners", "anticoagulant", "aspirin", "warfarin",
      "on antibiotics", "prescribed medicine", "can i donate on medication"], "situational_medication"),
    (["nervous", "scared of needles", "fear of needles", "afraid of needle",
      "needle phobia", "does it hurt", "will it hurt", "pain during donation",
      "scared of blood", "phobia of blood"], "situational_nervous_needles"),
    (["drank alcohol", "had a drink", "had beer", "had wine",
      "drinking last night", "hangover", "been drinking", "after alcohol",
      "can i donate after alcohol", "drank last night"], "situational_alcohol"),
    (["thirsty", "dehydrated", "not drinking enough water", "should i drink water",
      "drink water before", "dry mouth", "very thirsty"], "situational_dehydration"),
    (["just ate", "ate a lot", "heavy meal", "big meal", "full stomach",
      "just had food", "fatty food", "oily food", "after eating",
      "ate oily food"], "situational_heavy_meal"),
    (["got a tattoo", "tattooed", "tattoo", "piercing", "got pierced",
      "body piercing", "ear piercing", "nose ring", "new tattoo"], "situational_tattoo_piercing"),
    (["periods", "menstruation", "on my period", "time of the month",
      "monthly cycle", "menstruating"], "situational_period_menstruation"),
    (["feel weak", "feeling weak", "feel very weak", "feeling very weak",
      "anaemic", "anemic", "low hemoglobin", "low hb", "pale", "dizzy before donating",
      "not feeling strong", "feel low energy", "low energy today", "weak today"], "situational_low_hemoglobin_weak"),
    (["diabetic", "diabetes", "sugar patient", "blood pressure", "hypertension",
      "high bp", "low bp", "heart condition", "heart disease",
      "can diabetic donate", "can i donate with bp"], "situational_diabetes_bp"),
    # Generic intent — must stay LAST so specific conditions above take priority
    (["i want to donate", "i would like to donate", "i want to give blood",
      "thinking of donating", "planning to donate", "want to help",
      "interested in donating", "how do i donate"], "situational_want_to_donate_general"),
]


def _valid_coord(v) -> bool:
    """True only for a real, finite coordinate (rejects None and pandas NaN)."""
    try:
        return v is not None and not math.isnan(float(v))
    except (TypeError, ValueError):
        return False


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
         "donors": b.get("donor_count", 0)}
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
        lat, lon = rec.get("latitude"), rec.get("longitude")
        banks = _stock.banks_with_stock(
            blood_group=group,
            lat=float(lat) if _valid_coord(lat) else None,
            lon=float(lon) if _valid_coord(lon) else None,
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


def _norm(text: str) -> str:
    """Lowercase + strip apostrophes/punctuation so 'havent' matches 'haven't'."""
    return text.lower().replace("'", "").replace("'", "")


def _situational_advice(role: str, user_id: Optional[str], message: str) -> tuple[dict, list]:
    """Route situational donor queries (sleep/sick/meds/nervous/etc.) to the right FAQ."""
    msg_lower = _norm(message)
    for keywords, faq_id in _SITUATIONAL_MAP:
        if any(_norm(kw) in msg_lower for kw in keywords):
            # Direct lookup by ID rather than keyword scoring
            entry = next((e for e in knowledge.FAQ if e["id"] == faq_id), None)
            if entry:
                return {"answer": entry["answer"]}, [entry["source"]]
    # Fall back to scored lookup
    hit = knowledge.lookup(message)
    if hit:
        return {"answer": hit["answer"]}, [hit["source"]]
    return {"note": "fallback"}, []


def _registration(role: str, user_id: Optional[str], message: str) -> tuple[dict, list]:
    """Handle registration, 'how thalnet works', and blood-bank contact queries."""
    msg_lower = message.lower()
    # Route to the most relevant FAQ entry
    if any(w in msg_lower for w in ["thalnet", "how does this", "what is this", "about thalnet"]):
        hit = knowledge.lookup("what is thalnet what does thalnet do")
    elif any(w in msg_lower for w in ["blood bank", "contact", "phone", "nearest", "where to donate", "find blood"]):
        hit = knowledge.lookup("contact blood bank blood bank near me")
    else:
        hit = knowledge.lookup("how to register become a donor sign up")
    if hit:
        return {"answer": hit["answer"]}, [hit["source"]]
    return {"note": "fallback"}, []


def _emergency(role: str, user_id: Optional[str], message: str) -> tuple[dict, list]:
    """Handle urgent/emergency blood requests."""
    hit = knowledge.lookup("emergency urgent blood urgently")
    if hit:
        return {"answer": hit["answer"]}, [hit["source"]]
    return {"note": "fallback"}, []


def _fallback(role: str, user_id: Optional[str], message: str) -> tuple[dict, list]:
    return {"note": "fallback"}, []


# role → which audience's wellness rows they may see (public/admin: general only)
_AUDIENCE = {"donor": "donor", "patient": "patient", "admin": "any", "public": "any"}


def _wellness(role: str, user_id: Optional[str], message: str) -> tuple[dict, list]:
    audience = _AUDIENCE.get(role, "any")
    topic = wellness.detect_topic(message)
    rows = wellness.suggest(audience, topic, limit=3)
    if not rows:
        return {"note": "fallback"}, []
    caution = next((r["suggestion"] for r in rows if r["caution_flag"] != "none"), None)
    facts = {
        "suggestions": [r["suggestion"] for r in rows],
        "caution": caution,
    }
    sources = sorted({r["source"] for r in rows})
    return facts, sources


HANDLERS = {
    "personal_eligibility": _personal_eligibility,
    "bridge_status": _bridge_status,
    "stock_lookup": _stock_lookup,
    "general_faq": _general_faq,
    "wellness": _wellness,
    "registration": _registration,
    "emergency": _emergency,
    "situational_advice": _situational_advice,
    "fallback": _fallback,
}


# ── Light extractors (deterministic, no LLM) ─────────────────────────────

_BG_TOKENS = {
    "o+": "O+", "o-": "O-", "a+": "A+", "a-": "A-", "b+": "B+", "b-": "B-",
    "ab+": "AB+", "ab-": "AB-",
}


def _extract_blood_group(message: str) -> Optional[str]:
    t = message.lower().replace(" ", "")
    # Check longer tokens first so "ab+"/"ab-" win over "b+"/"b-".
    for token, canon in sorted(_BG_TOKENS.items(), key=lambda kv: -len(kv[0])):
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

def _is_situational(message: str) -> bool:
    """True if the message matches any situational pre-donation scenario."""
    msg_lower = _norm(message)
    for keywords, _ in _SITUATIONAL_MAP:
        if any(_norm(kw) in msg_lower for kw in keywords):
            return True
    return False


def handle_chat(message: str, role: str = "public",
                user_id: Optional[str] = None, lang: Optional[str] = None) -> dict:
    """Classify → dispatch to a grounded handler → phrase warmly. Read-only."""
    llm = get_llm()
    lang = lang or llm.detect_language(message)
    intent = llm.classify_intent(message)["intent"]
    # Situational override: specific medical/condition phrases beat generic classifier.
    if intent != "situational_advice" and _is_situational(message):
        intent = "situational_advice"
    handler = HANDLERS.get(intent, _fallback)
    facts, sources = handler(role, user_id, message)
    # Intents that return grounded answers — if no answer found, fall back.
    _answer_intents = ("general_faq", "registration", "emergency", "situational_advice")
    if intent in _answer_intents and "answer" not in facts:
        intent = "fallback"
        facts, sources = {"note": "fallback"}, []
    # Log unanswered queries so admins can review and teach the bot.
    if facts.get("note") == "fallback":
        knowledge.log_unanswered(message, role)
    reply = llm.compose_chat_reply(facts, {"role": role}, lang)
    return {
        "reply": reply,
        "intent": intent,
        "lang": lang,
        "grounded_facts": facts,
        "sources": sources,
    }
