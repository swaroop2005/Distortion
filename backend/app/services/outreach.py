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
        "can i donate", "am i eligible", "my eligibility", "next donation",
        "donation clock", "when is my next", "how many days", "days until",
        "kab donate", "kitne din", "kab kar", "eppudu", "rojulu", "donate cheya",
    ],
    "bridge_status": [
        "my bridge", "bridge status", "how is my bridge", "my squad", "my donors",
        "my patients", "bridge doing", "bridge looking", "bridge health",
        "how many donors do i have", "is my bridge ok", "bridge integrity",
    ],
    "stock_lookup": [
        "available", "stock", "units", "blood bank", "near me", "in stock",
        "is o+", "is a+", "is b+", "is ab+", "any blood", "blood available",
        "units available", "check stock", "blood supply", "find blood",
        "blood in", "bank have", "how much blood",
    ],
    "general_faq": [
        "what is", "thalassemia", "thalassaemia", "how often", "transfusion",
        "who can donate", "blood bridge", "how many donors", "90 days",
        "how does", "tell me about", "explain", "what happens", "side effect",
        "iron overload", "chelation", "carrier", "hplc", "compatible",
        "blood type", "universal donor", "how many patients", "statistics",
        "india thalassemia", "donation process", "feel dizzy",
    ],
    "registration": [
        "how to register", "register", "sign up", "join", "enroll",
        "become a donor", "how do i volunteer", "new donor", "start donating",
        "how to join", "what is thalnet", "how does thalnet work", "about thalnet",
        "contact blood bank", "blood bank phone", "blood bank number", "nearest blood bank",
        "where to donate", "find blood bank",
    ],
    "emergency": [
        "emergency", "urgent", "need blood urgently", "blood now", "immediately",
        "critical", "icu", "surgery", "blood for surgery", "help now",
        "urgent need", "emergency request", "life threatening",
    ],
    "situational_advice": [
        # sleep / fatigue
        "haven't slept", "no sleep", "didn't sleep", "tired", "exhausted", "sleepy",
        "sleep deprived", "lack of sleep", "bad night", "couldn't sleep",
        # illness
        "i have a cold", "i have flu", "i have fever", "feeling sick", "unwell",
        "runny nose", "sore throat", "cough", "body ache", "feeling feverish",
        # medication
        "on medication", "taking medicine", "taking pills", "antibiotics",
        "blood thinners", "anticoagulant", "can i donate on medication",
        # nerves
        "nervous", "scared of needles", "afraid", "needle phobia", "does it hurt",
        "will it hurt", "pain during donation", "scared of blood",
        # alcohol / food / hydration
        "drank alcohol", "had a drink", "had beer", "hangover", "being drinking",
        "just ate", "heavy meal", "big meal", "full stomach", "fatty food", "oily food",
        "thirsty", "dehydrated", "should i drink water",
        # body conditions
        "got a tattoo", "tattooed", "tattoo", "piercing", "got pierced",
        "on my period", "menstruating", "feel weak", "feeling weak", "anaemic",
        "anemic", "low hemoglobin", "diabetic", "diabetes", "blood pressure",
        "hypertension", "high bp",
        # want to donate
        "i want to donate", "i would like to donate", "thinking of donating",
        "want to help", "interested in donating", "how do i donate",
        "want to give blood", "planning to donate",
    ],
    "wellness": [
        "what should i eat", "what to eat", "diet", "food", "stay healthy",
        "feel better", "tips", "lifestyle", "take care", "advice", "healthy",
        "sad", "stress", "anxious", "lonely", "depress", "overwhelm",
        "cope", "scared", "worried", "mental health", "emotional",
        "hydration", "water", "nutrition", "vitamins", "exercise",
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
        # Direct, calm tone — state the fact first, no filler openers.
        greet = {"en": ["", ""], "hi": ["", ""], "te": ["", ""]}.get(lang, [""])

        def _hi() -> str:
            g = {"en": ["Hello.", "Hi."], "hi": ["Namaste.", "Namaskar."],
                 "te": ["Namaskaram.", "Hello."]}.get(lang, ["Hello."])
            return random.choice(g)

        if facts.get("note") == "no_record":
            return random.choice([
                "No record found for that ID. Double-check your donor or patient ID and try again.",
                "That ID doesn't match any record. If you registered recently, try again in a moment.",
            ])

        if facts.get("note") == "wrong_role":
            return random.choice([
                "That information is available in a different role view. Ask me what I can help with here.",
                "That section belongs to a different portal. Let me know what else you need.",
            ])

        if facts.get("note") == "need_location":
            return random.choice([
                "Share your district or city and I'll check which blood banks have stock nearby.",
                "Which district are you in? I'll find the nearest banks with available stock.",
            ])

        # Eligibility
        if "days_until" in facts:
            if facts.get("eligible"):
                body = random.choice([
                    "You're eligible to donate now.",
                    "Your 90-day window is clear — you can donate today.",
                    "You're cleared to donate. A patient on your bridge may need you soon.",
                ])
            else:
                d = facts["days_until"]
                body = random.choice([
                    f"You'll be eligible again in {d} days.",
                    f"Eligibility returns in {d} days — your body is still in the recovery window.",
                    f"{d} days until your next donation window opens.",
                ])
            if facts.get("total_donations"):
                body += f" {facts['total_donations']} donations on record — thank you."
            return body

        # Bridge
        if "bridges" in facts:
            bs = facts["bridges"]
            if not bs:
                return random.choice([
                    "No active bridge on record for you yet. An admin can build one that links 8–10 donors to your cycle.",
                    "Your bridge hasn't been set up yet. Once it's built, I can show you live status.",
                ])
            b = bs[0]
            integrity = b.get("integrity", "Unknown")
            donors = b.get("donors", 0)
            phrases = {
                "full": f"Bridge status: Full — {donors} donors lined up. You're covered.",
                "at-risk": f"Bridge status: At-risk — {donors} donor(s) active. The system may auto-recruit a replacement.",
                "broken": f"Bridge status: Broken — only {donors} donor(s). An admin has been notified to repair it.",
            }
            return phrases.get(integrity.lower(), f"Bridge integrity: {integrity} — {donors} donor(s).")

        # Stock
        if "banks" in facts:
            banks = facts["banks"]
            if not banks:
                return random.choice([
                    f"No {facts.get('blood_group','')} stock found near {facts.get('district','that area')} right now. Try a neighbouring district or check e-RaktKosh directly.",
                    f"{facts.get('blood_group','')} stock unavailable near {facts.get('district','that area')} in our data. Call your nearest hospital blood bank for live availability.",
                ])
            top = banks[0]
            count = len(banks)
            return random.choice([
                f"{top.get('name', 'Nearby bank')} in {top.get('district', 'your area')}: "
                f"{top.get('available_units', 0)} units of {top.get('blood_group', '')}. "
                f"{count} bank(s) with stock found.",
                f"Closest: {top.get('name', 'a nearby bank')} — "
                f"{top.get('available_units', 0)} units of {top.get('blood_group', '')} "
                f"in {top.get('district', 'your area')}. {count} total.",
            ])

        # FAQ / situational / registration / emergency
        if "answer" in facts:
            return facts["answer"]

        # Wellness
        if "suggestions" in facts:
            parts = []
            caution = facts.get("caution")
            if caution:
                parts.append("Note: " + caution)
            others = [s for s in facts["suggestions"] if s != caution]
            if others:
                parts.append(random.choice(["Some suggestions:", "A few things that may help:", "Here are some ideas:"]) + " " + " ".join(others))
            parts.append(WELLNESS_DISCLAIMER)
            return " ".join(parts)

        # Fallback
        return random.choice([
            "I can help with donation eligibility, bridge status, nearby blood stock, or general thalassemia questions. What do you need?",
            "Ask me about your donation window, bridge health, blood banks near you, or how ThalNet works.",
            "Not sure I caught that. Try: 'am I eligible?', 'my bridge status', 'blood banks in Hyderabad', or any thalassemia question.",
        ])


class BedrockLLM:
    """Real Bedrock Claude Haiku adapter. Requires AWS credentials."""

    def __init__(self):
        try:
            import boto3
            self.client = boto3.client("bedrock-runtime", region_name="us-east-1")
            self.model_id = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
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
            "personal_eligibility, bridge_status, stock_lookup, general_faq, wellness, fallback. "
            "personal_eligibility = when they can donate again; bridge_status = their "
            "own bridge/donor squad; stock_lookup = blood availability at banks; "
            "general_faq = general questions about thalassemia or donating; "
            "wellness = diet, hydration, lifestyle, or emotional-wellbeing tips; fallback = "
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
