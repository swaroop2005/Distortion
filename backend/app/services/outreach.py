"""Outreach agent — autonomous donor contact with empathy + impact.

Two adapters: MockLLM (always works, $0) and BedrockLLM (real Haiku).
Switch via THALNET_LLM_BACKEND env var ("mock" | "bedrock", default "mock").

Capabilities:
  - compose_message: personalized, empathetic donor outreach with impact stats
  - interpret_reply: classify free-text reply → accept/decline/maybe/later/question
  - compose_impact: post-donation thank-you with real impact data
  - compose_clock_nudge: proactive "you're eligible again" ping
  - detect_language: for multilingual support
"""
from __future__ import annotations

import os
import random
from datetime import date, datetime
from typing import Optional

from ..utils.compat import normalize_blood_group
from ..utils.eligibility import days_until_eligible
from .voice import system_prompt

LLM_BACKEND = os.environ.get("THALNET_LLM_BACKEND", "mock")

# ── Reply labels ──────────────────────────────────────────────────────────
REPLY_LABELS = ["accept", "decline", "maybe", "later", "question"]

# ── Chatbot intent keywords (EN + HI + TE markers) ───────────────────────
CHAT_INTENT_KEYWORDS = {
    "personal_eligibility": [
        "eligible", "donate again", "when can i", "how often can i donate",
        "kab donate", "kitne din", "kab kar", "eppudu", "rojulu", "donate cheya",
    ],
    "bridge_status": [
        "my bridge", "bridge status", "how is my bridge", "my squad", "my donors",
        "my patients", "bridge doing", "bridge looking",
    ],
    "stock_lookup": [
        "available", "stock", "units", "blood bank", "near me", "in stock",
        "is o+", "is a+", "is b+", "is ab+", "any blood",
    ],
    "general_faq": [
        "what is", "thalassemia", "thalassaemia", "how often", "transfusion",
        "who can donate", "blood bridge", "how many donors", "90 days",
    ],
    "wellness": [
        "what should i eat", "what to eat", "diet", "food", "stay healthy",
        "feel better", "tips", "lifestyle", "take care", "advice", "healthy",
        "kya khana", "khana", "aahar", "emcomito", "ela undali",
    ],
}

WELLNESS_DISCLAIMER = ("These are general suggestions, not medical advice — "
                       "please check with your hematologist before making changes.")


# ── LLM Adapters ─────────────────────────────────────────────────────────

class MockLLM:
    """Realistic canned responses for local dev. Zero cost."""

    def compose_outreach(self, donor: dict, patient_context: dict, impact: dict) -> str:
        name = donor.get("gender", "Friend")
        group = normalize_blood_group(donor.get("blood_group")) or "blood"
        dist = patient_context.get("distance_km", "nearby")
        donors_contributed = impact.get("donors_this_month", 0)
        patients_helped = impact.get("patients_helped", 0)

        return (
            f"Dear {name} donor,\n\n"
            f"A thalassemia patient {dist} km from you urgently needs {group} blood. "
            f"This month, {donors_contributed} donors like you have already stepped up, "
            f"helping {patients_helped} patients continue their lifelong treatment.\n\n"
            f"Your single donation can cover one transfusion cycle — that's 15-20 more days "
            f"of life for someone who depends on donors like you.\n\n"
            f"Can you donate? Reply YES to confirm, or let us know if you need more time.\n\n"
            f"— Blood Warriors Team"
        )

    def compose_impact_thankyou(self, donor: dict, impact: dict) -> str:
        group = normalize_blood_group(donor.get("blood_group")) or "blood"
        total_donations = impact.get("total_donations", 0)
        patients_helped = impact.get("patients_helped", 0)
        dte = days_until_eligible(donor)
        next_msg = f"You'll be eligible again in {dte} days." if dte > 0 else "You're eligible to donate again!"

        return (
            f"Thank you for your {group} donation! 🙏\n\n"
            f"Your impact so far:\n"
            f"  • {total_donations} donations made\n"
            f"  • {patients_helped} patients supported\n"
            f"  • You're in the top contributors for your area\n\n"
            f"{next_msg}\n"
            f"Check your position on the Blood Warriors leaderboard: "
            f"https://bloodwarriors.in/home\n\n"
            f"Are you willing to donate again next time? "
            f"Reply YES and we'll map you for the next cycle.\n\n"
            f"— Blood Warriors Team"
        )

    def compose_clock_nudge(self, donor: dict, nearby_patient: Optional[dict] = None) -> str:
        group = normalize_blood_group(donor.get("blood_group")) or "blood"
        if nearby_patient:
            dist = nearby_patient.get("distance_km", "nearby")
            return (
                f"Good news — you're eligible to donate again! "
                f"A {group} patient just {dist} km away needs a donor on their bridge. "
                f"Want to reserve your slot? Reply YES.\n\n"
                f"— Blood Warriors Team"
            )
        return (
            f"You're eligible to donate {group} again! "
            f"Ready to make a difference? Reply YES and we'll match you.\n\n"
            f"— Blood Warriors Team"
        )

    def interpret_reply(self, text: str) -> dict:
        t = text.strip().lower()
        if any(w in t for w in ["yes", "sure", "ok", "ready", "confirm", "haan", "ha"]):
            return {"label": "accept", "confidence": 0.95}
        if any(w in t for w in ["no", "can't", "cannot", "nahi", "not possible", "decline"]):
            return {"label": "decline", "confidence": 0.90}
        if any(w in t for w in ["later", "busy", "next week", "travelling", "baad mein"]):
            return {"label": "later", "confidence": 0.85}
        if any(w in t for w in ["maybe", "think", "not sure", "shayad"]):
            return {"label": "maybe", "confidence": 0.80}
        if "?" in t or any(w in t for w in ["where", "when", "how", "kahan", "kab"]):
            return {"label": "question", "confidence": 0.75}
        return {"label": "maybe", "confidence": 0.50}

    def detect_language(self, text: str) -> str:
        hindi_markers = ["hai", "haan", "nahi", "kya", "mein", "aap", "kab", "kahan"]
        telugu_markers = ["undi", "nenu", "meeru", "ela", "ikkada", "cheyandi"]
        t = text.lower()
        if any(w in t for w in hindi_markers):
            return "hi"
        if any(w in t for w in telugu_markers):
            return "te"
        return "en"

    def classify_intent(self, text: str) -> dict:
        t = text.strip().lower()
        if not t:
            return {"intent": "fallback", "confidence": 1.0}
        best_intent = "fallback"
        best_score = 0
        for intent, kws in CHAT_INTENT_KEYWORDS.items():
            score = sum(len(kw) for kw in kws if kw in t)
            if score > best_score:
                best_score = score
                best_intent = intent
        confidence = 0.9 if best_score else 0.4
        return {"intent": best_intent, "confidence": confidence}

    def compose_chat_reply(self, facts: dict, tone_context: dict, lang: str) -> str:
        greeting = {"en": "Hi there", "hi": "Namaste", "te": "Namaskaram"}.get(lang, "Hi there")

        if facts.get("note") == "no_record":
            return (f"{greeting}! I couldn't find a record for that, so I can't share "
                    "those details. If you've registered, double-check your ID and I'll "
                    "be glad to help.")
        if facts.get("note") == "wrong_role":
            return (f"{greeting}! That information is part of a different view, so I'm "
                    "not able to show it here — but I'm happy to help with what's "
                    "available to you.")
        if facts.get("note") == "need_location":
            return (f"{greeting}! Tell me your district or city and I'll check which "
                    "nearby blood banks have stock for you.")

        # Eligibility facts
        if "days_until" in facts:
            if facts.get("eligible"):
                body = ("Good news — you're eligible to donate right now. A patient "
                        "nearby would be grateful whenever you're ready.")
            else:
                body = (f"You'll be eligible to donate again in {facts['days_until']} days. "
                        "No rush — we'll be here when the time comes.")
            if facts.get("total_donations"):
                body += f" Thank you for your {facts['total_donations']} donations so far."
            return f"{greeting}! {body}"

        # Bridge facts
        if "bridges" in facts:
            bs = facts["bridges"]
            if not bs:
                return (f"{greeting}! You don't have an active bridge on record yet. "
                        "When one is set up, I can tell you how it's doing.")
            b = bs[0]
            return (f"{greeting}! Your bridge currently looks '{b.get('integrity', 'Unknown')}' with "
                    f"{b.get('donors', 0)} donors lined up. We'll gently step in if that changes.")

        # Stock facts
        if "banks" in facts:
            banks = facts["banks"]
            if not banks:
                return (f"{greeting}! I couldn't find available {facts.get('blood_group','')} "
                        f"stock near {facts.get('district','that area')} right now. "
                        "I can check a wider area if you'd like.")
            top = banks[0]
            return (f"{greeting}! {top.get('name', 'A nearby bank')} in "
                    f"{top.get('district', 'your area')} currently shows "
                    f"{top.get('available_units', 0)} units of "
                    f"{top.get('blood_group', facts.get('blood_group', ''))}. "
                    f"I found {len(banks)} bank(s) with stock nearby.")

        # FAQ facts
        if "answer" in facts:
            return f"{greeting}! {facts['answer']}"

        # Wellness suggestions (always carries the non-medical-advice disclaimer)
        if "suggestions" in facts:
            parts = [f"{greeting}!"]
            caution = facts.get("caution")
            if caution:
                parts.append("One important note: " + caution)
            others = [s for s in facts["suggestions"] if s != caution]
            if others:
                parts.append("A few things that may help: " + " ".join(others))
            parts.append(WELLNESS_DISCLAIMER)
            return " ".join(parts)

        # Fallback
        return (f"{greeting}! I can help with your donation eligibility, your bridge, "
                "blood availability near you, or questions about thalassemia donation. "
                "What would you like to know?")


class BedrockLLM:
    """Real Bedrock Claude Haiku adapter. Requires AWS credentials."""

    def __init__(self):
        try:
            import boto3
            self.client = boto3.client("bedrock-runtime", region_name="us-east-1")
            self.model_id = "anthropic.claude-3-haiku-20240307-v1:0"
        except Exception:
            raise RuntimeError("boto3 not configured — set AWS credentials or use THALNET_LLM_BACKEND=mock")

    def _call(self, system: str, user: str, max_tokens: int = 300) -> str:
        import json
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        })
        resp = self.client.invoke_model(modelId=self.model_id, body=body)
        result = json.loads(resp["body"].read())
        return result["content"][0]["text"]

    def compose_outreach(self, donor: dict, patient_context: dict, impact: dict) -> str:
        system = (
            "You are a compassionate Blood Warriors coordinator. Write a short, empathetic "
            "message to a blood donor asking them to donate. Include the patient's need, "
            "the donor's impact stats, and a clear call to action. Keep under 150 words. "
            "Be warm but not manipulative. Thalassemia is lifelong — never say 'cure'."
        )
        group = normalize_blood_group(donor.get("blood_group")) or "blood"
        user_msg = (
            f"Donor blood group: {group}. "
            f"Patient distance: {patient_context.get('distance_km', 'nearby')} km. "
            f"Donors who contributed this month: {impact.get('donors_this_month', 0)}. "
            f"Patients helped: {impact.get('patients_helped', 0)}. "
            f"Donor's past donations: {donor.get('donations_till_date', 0)}."
        )
        return self._call(system, user_msg)

    def compose_impact_thankyou(self, donor: dict, impact: dict) -> str:
        system = (
            "You are a Blood Warriors coordinator. Write a warm thank-you message to a donor "
            "who just donated. Include their impact stats, next eligibility date, and ask if "
            "they'd like to be mapped for next time. Link to bloodwarriors.in leaderboard. "
            "Keep under 120 words."
        )
        user_msg = (
            f"Blood group: {normalize_blood_group(donor.get('blood_group'))}. "
            f"Total donations: {impact.get('total_donations', 0)}. "
            f"Patients helped: {impact.get('patients_helped', 0)}. "
            f"Days until eligible again: {max(0, days_until_eligible(donor))}."
        )
        return self._call(system, user_msg)

    def compose_clock_nudge(self, donor: dict, nearby_patient: Optional[dict] = None) -> str:
        system = (
            "You are a Blood Warriors coordinator. The donor is now eligible to donate again. "
            "Write a brief, proactive message. If a nearby patient needs their blood type, "
            "mention it. Ask if they want to reserve a slot. Keep under 80 words."
        )
        user_msg = (
            f"Blood group: {normalize_blood_group(donor.get('blood_group'))}. "
            f"Nearby patient: {'yes, ' + str(nearby_patient.get('distance_km', '?')) + ' km away' if nearby_patient else 'none right now'}."
        )
        return self._call(system, user_msg)

    def interpret_reply(self, text: str) -> dict:
        system = (
            "Classify this donor's reply into exactly one label: accept, decline, maybe, later, question. "
            "Respond with JSON only: {\"label\": \"...\", \"confidence\": 0.0-1.0}. "
            "Handle Hindi, Telugu, and English."
        )
        import json
        raw = self._call(system, text, max_tokens=50)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"label": "maybe", "confidence": 0.3}

    def detect_language(self, text: str) -> str:
        system = "Detect the language. Reply with only the ISO 639-1 code (en, hi, te, etc)."
        code = self._call(system, text, max_tokens=5).strip().lower()[:2]
        return code if code in ("en", "hi", "te", "kn", "ta", "mr") else "en"

    def classify_intent(self, text: str) -> dict:
        system = (
            "Classify the user's message into exactly one intent label: "
            "personal_eligibility, bridge_status, stock_lookup, general_faq, fallback. "
            "personal_eligibility = when they can donate again; bridge_status = their "
            "own bridge/donor squad; stock_lookup = blood availability at banks; "
            "general_faq = general questions about thalassemia or donating; fallback = "
            "anything else. Reply with JSON only: {\"intent\": \"...\", \"confidence\": 0.0-1.0}. "
            "Handle English, Hindi, and Telugu."
        )
        import json
        raw = self._call(system, text, max_tokens=40)
        try:
            data = json.loads(raw)
            intent = str(data.get("intent", "")).lower()
            if intent in CHAT_INTENT_KEYWORDS or intent == "fallback":
                data["intent"] = intent
                data.setdefault("confidence", 0.5)
                return data
        except json.JSONDecodeError:
            pass
        return {"intent": "fallback", "confidence": 0.3}

    def compose_chat_reply(self, facts: dict, tone_context: dict, lang: str) -> str:
        import json
        system = system_prompt(lang)
        wellness_rule = ""
        if "suggestions" in facts:
            wellness_rule = (
                " These are wellness suggestions: if a 'caution' field is present, lead "
                "with it gently. Suggest, never prescribe (no doses, no 'you must'). "
                f"End your reply with exactly this sentence: {WELLNESS_DISCLAIMER}"
            )
        user_msg = (
            "Write a reply using ONLY these facts (JSON). If a needed fact is missing, "
            "say you don't have it. Do not invent numbers." + wellness_rule + "\n"
            f"Role of the person: {tone_context.get('role', 'unknown')}\n"
            f"Facts: {json.dumps(facts, default=str)}"
        )
        return self._call(system, user_msg, max_tokens=240)


def get_llm():
    """Get the active LLM adapter."""
    if LLM_BACKEND == "bedrock":
        return BedrockLLM()
    return MockLLM()


# ── Outcome logging (failure learning) ───────────────────────────────────

_outcomes: list[dict] = []


def log_outcome(
    request_id: str,
    donor_id: str,
    action: str,
    message_sent: str,
    reply: Optional[str] = None,
    label: Optional[str] = None,
    result: str = "pending",
) -> dict:
    """Log an outreach outcome for failure learning."""
    entry = {
        "request_id": request_id,
        "donor_id": donor_id,
        "action": action,
        "message_sent": message_sent[:200],
        "reply": reply,
        "label": label,
        "result": result,
        "timestamp": datetime.utcnow().isoformat(),
    }
    _outcomes.append(entry)
    return entry


def get_outcomes(request_id: Optional[str] = None) -> list[dict]:
    if request_id:
        return [o for o in _outcomes if o["request_id"] == request_id]
    return list(_outcomes)


def failure_summary() -> dict:
    """What worked and what didn't — feeds back into agent prompts."""
    total = len(_outcomes)
    if total == 0:
        return {"total": 0, "accept_rate": 0, "common_decline_reasons": []}

    accepted = sum(1 for o in _outcomes if o.get("label") == "accept")
    declined = [o for o in _outcomes if o.get("label") == "decline"]

    return {
        "total": total,
        "accepted": accepted,
        "accept_rate": round(accepted / total, 2) if total else 0,
        "declined": len(declined),
        "common_decline_reasons": [o.get("reply", "")[:50] for o in declined[:5]],
        "lesson": (
            "High accept rate — current approach working well."
            if accepted / max(total, 1) > 0.5
            else "Low accept rate — consider adjusting message tone or timing."
        ),
    }
