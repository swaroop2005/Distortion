"""Curated, cite-able FAQ facts for the chatbot.

Static FAQ below. Learned FAQ loaded at runtime from data/chatbot_learned_faqs.json.
New entries written there via learn_faq(); unanswered queries logged to
data/chatbot_unanswered.jsonl for admin review.

Run as a smoke test:  .venv/bin/python -m backend.tests.test_knowledge
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

_DATA_DIR = Path(__file__).resolve().parents[3] / "data"
_LEARNED_PATH = _DATA_DIR / "chatbot_learned_faqs.json"
_UNANSWERED_PATH = _DATA_DIR / "chatbot_unanswered.jsonl"

# ── Static FAQ ────────────────────────────────────────────────────────────
FAQ: list[dict] = [
    {
        "id": "what_is_thalassemia",
        "keywords": ["what is thalassemia", "thalassemia", "thalassaemia", "blood disorder",
                     "inherited", "genetic blood"],
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
        "keywords": ["how often", "transfusion", "how many days", "frequency", "cycle",
                     "how frequently", "transfusion schedule", "every how many"],
        "answer": (
            "Most thalassemia patients need a transfusion roughly every 15–20 days, "
            "every cycle, for life. That steady demand is why a reliable group of "
            "donors matters so much."
        ),
        "source": "Blood Warriors Blood Bridge model",
    },
    {
        "id": "blood_bridge",
        "keywords": ["blood bridge", "bridge", "8 to 1", "squad", "how many donors",
                     "donor group", "what is a bridge"],
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
                     "90 days", "donate again", "donation gap", "can i donate",
                     "requirements to donate", "donation requirements"],
        "answer": (
            "A healthy adult can usually donate whole blood once every 90 days. "
            "After you donate, your body needs that time to recover before the next donation."
        ),
        "source": "90-day whole-blood interval (eligibility rule)",
    },
    {
        "id": "how_to_register",
        "keywords": ["how to register", "register as donor", "sign up", "join blood warriors",
                     "become a donor", "enroll", "how do i join", "new donor",
                     "how to volunteer", "volunteer as donor"],
        "answer": (
            "To register as a Blood Warriors donor, visit bloodwarriors.in or use the ThalNet "
            "Donor Portal. You'll share your blood group, location, and contact details. "
            "Once registered, our system matches you to patients with your blood type nearby "
            "and builds you into a Blood Bridge. No hospital visit needed to register — "
            "you're contacted when a patient on your bridge needs you."
        ),
        "source": "Blood Warriors / ThalNet platform",
    },
    {
        "id": "what_thalnet_does",
        "keywords": ["what is thalnet", "what does thalnet do", "how does thalnet work",
                     "what is this app", "what can you do", "how does this work",
                     "thalnet platform", "about thalnet"],
        "answer": (
            "ThalNet is an autonomous blood-support network built for Blood Warriors. "
            "It automatically builds donor squads (Blood Bridges) for each patient, "
            "predicts when donors may go inactive, contacts the right donors at the right time "
            "in English, Hindi, or Telugu, and learns from every response to improve future "
            "outreach. Admins see live supply levels across India; donors see their personal "
            "donation clock; patients see their bridge status."
        ),
        "source": "ThalNet platform",
    },
    {
        "id": "iron_overload",
        "keywords": ["iron overload", "iron chelation", "chelation therapy", "too much iron",
                     "iron levels", "ferritin", "desferal", "exjade", "iron removal"],
        "answer": (
            "Regular blood transfusions gradually build up excess iron in the body — "
            "a condition called iron overload. Left untreated it can damage the heart, "
            "liver, and other organs. Chelation therapy (medication that removes iron) is a "
            "standard part of thalassemia management. Your hematologist monitors ferritin "
            "levels and prescribes the right chelation plan."
        ),
        "source": "Thalassemia International Federation (TIF)",
    },
    {
        "id": "carrier_screening",
        "keywords": ["carrier", "carrier test", "hplc test", "hplc", "thalassemia carrier",
                     "beta thalassemia trait", "carrier screening", "am i a carrier",
                     "family screening", "genetic test"],
        "answer": (
            "A thalassemia carrier (trait) has one abnormal hemoglobin gene and is usually "
            "healthy, but can pass the gene to children. Blood Warriors offers HPLC-based "
            "carrier screening. If you test positive, screening close family members is "
            "important. Carriers with normal hemoglobin are also ideal blood donors."
        ),
        "source": "Blood Warriors carrier-screening program",
    },
    {
        "id": "what_happens_during_donation",
        "keywords": ["what happens when i donate", "donation process", "how long does donation take",
                     "blood donation process", "what to expect", "donation procedure",
                     "what to do before donating", "before donation"],
        "answer": (
            "A whole-blood donation takes about 10–15 minutes. Before donating: eat a light meal, "
            "stay hydrated, and avoid fatty foods. At the donation center, hemoglobin and blood "
            "pressure are checked first. You rest for 10–15 minutes afterward and have a snack. "
            "Most people feel normal within a few hours. Avoid heavy exercise for the rest of the day."
        ),
        "source": "NHS Give Blood / Blood Warriors",
    },
    {
        "id": "side_effects_donation",
        "keywords": ["side effects", "after donation", "feel dizzy", "dizziness", "tired after",
                     "weakness after", "fainting", "bruise", "arm sore", "donation side effects",
                     "is it safe to donate"],
        "answer": (
            "Donation is safe for healthy adults. Some people feel briefly light-headed — "
            "sitting or lying down for a few minutes helps. A small bruise at the needle site "
            "is common and fades in a few days. Drink plenty of fluids and avoid strenuous "
            "activity for 24 hours. Serious complications are rare."
        ),
        "source": "NHS Give Blood",
    },
    {
        "id": "emergency_blood",
        "keywords": ["emergency", "urgent blood", "need blood urgently", "critical patient",
                     "blood now", "immediately", "urgent need", "patient in icu",
                     "blood for surgery", "emergency request"],
        "answer": (
            "For an urgent blood need, contact your nearest blood bank directly — "
            "they hold reserve stock for emergencies. In ThalNet, an Admin can trigger "
            "Emergency Outreach that immediately ranks and contacts the closest compatible donors. "
            "If you're a patient, share your patient ID with an admin so they can escalate. "
            "For life-threatening emergencies, call your hospital blood bank first."
        ),
        "source": "ThalNet emergency escalation / e-RaktKosh",
    },
    {
        "id": "blood_types_compatible",
        "keywords": ["compatible blood", "which blood type", "blood type compatibility",
                     "who can give me blood", "can o+ donate to", "universal donor",
                     "blood group match", "which blood group"],
        "answer": (
            "O- can donate to any blood type (universal donor). "
            "AB+ can receive from any type (universal recipient). For thalassemia patients, "
            "exact ABO + Rh matching is standard to reduce transfusion reactions. "
            "Over many transfusions, extended antigen matching (Kell, Duffy, Kidd) may also "
            "be considered — your hematologist guides this."
        ),
        "source": "ThalNet compatibility engine / TIF guidelines",
    },
    {
        "id": "how_many_patients_in_india",
        "keywords": ["how many patients", "thalassemia in india", "thalassemia india",
                     "how common is thalassemia", "how many thalassemia", "india thalassemia",
                     "prevalence", "how many people have thalassemia", "statistics",
                     "thalassemia statistics", "patients in india"],
        "answer": (
            "India has one of the world's highest burdens of thalassemia — an estimated "
            "10,000–12,000 children are born with thalassemia major each year. Around "
            "3–4% of the population carries the thalassemia trait. Blood Warriors currently "
            "supports patients across Telangana and Andhra Pradesh, with plans to expand nationally."
        ),
        "source": "Blood Warriors / Thalassemia International Federation",
    },
    {
        "id": "contact_blood_bank",
        "keywords": ["blood bank number", "contact blood bank", "blood bank phone",
                     "nearest blood bank", "blood bank address", "find blood bank",
                     "blood bank near me", "where to donate"],
        "answer": (
            "Use the ThalNet Stock Lookup to find blood banks near you — share your district "
            "or city and blood group. For a national directory, e-RaktKosh (eraktkosh.in) "
            "lists all licensed blood banks across India with phone numbers and real-time stock."
        ),
        "source": "e-RaktKosh national blood bank directory",
    },
    # ── Situational / pre-donation scenarios ─────────────────────────────
    {
        "id": "situational_sleep_tired",
        "keywords": ["haven't slept", "no sleep", "didn't sleep", "not slept", "tired",
                     "exhausted", "fatigued", "lack of sleep", "sleepy", "sleep deprived",
                     "couldn't sleep", "bad night", "didn't rest"],
        "answer": (
            "You can still donate if you feel otherwise healthy, but it's better to be "
            "well-rested. If you slept fewer than 5–6 hours or feel significantly fatigued, "
            "consider rescheduling — donation draws on your body's resources and fatigue can "
            "worsen light-headedness afterward. Drink water, eat a light meal, and if you "
            "feel fine by donation time, you're likely okay to proceed."
        ),
        "source": "NHS Give Blood / Blood Warriors guidelines",
    },
    {
        "id": "situational_cold_flu_fever",
        "keywords": ["i have a cold", "i have flu", "i have fever", "feeling sick", "runny nose",
                     "sore throat", "cough", "i'm sick", "unwell", "cold and cough",
                     "body ache", "feeling feverish", "got fever"],
        "answer": (
            "Do not donate while you have a cold, flu, or fever. Wait until you have been "
            "completely symptom-free for at least 7 days before donating. Your body needs "
            "its defenses to fight the infection, and donating while sick can also affect "
            "the safety of the donated blood."
        ),
        "source": "NHS Give Blood / WHO blood safety guidelines",
    },
    {
        "id": "situational_medication",
        "keywords": ["on medication", "taking medicine", "taking pills", "on tablets",
                     "prescribed medicine", "antibiotics", "blood thinners", "anticoagulant",
                     "aspirin", "warfarin", "steroids", "can i donate on medication"],
        "answer": (
            "It depends on the medication. Most over-the-counter pain relievers (paracetamol, "
            "ibuprofen) are fine. Antibiotics: wait 7 days after completing the course. "
            "Blood thinners (warfarin, aspirin): consult the donation center — usually deferred. "
            "Steroids or immunosuppressants: generally deferred. Always tell the donation staff "
            "what you're taking; they make the final call. When in doubt, call ahead."
        ),
        "source": "NHS Give Blood medication guidelines",
    },
    {
        "id": "situational_nervous_needles",
        "keywords": ["nervous", "scared", "fear of needles", "afraid", "anxious about donating",
                     "scared of blood", "phobia", "needle phobia", "worried about pain",
                     "will it hurt", "does it hurt", "pain during donation"],
        "answer": (
            "Being nervous before a first donation is completely normal. The needle pinch lasts "
            "about 2 seconds — most people say it's less than they expected. Staff at donation "
            "centers are trained to help nervous donors. Lie down during donation if that feels "
            "better, keep breathing steadily, and let staff know you're anxious — they'll talk "
            "you through it. Many donors who were nervous the first time say it gets easier."
        ),
        "source": "Blood Warriors / NHS Give Blood donor support",
    },
    {
        "id": "situational_alcohol",
        "keywords": ["drank alcohol", "had a drink", "had beer", "had wine", "alcohol",
                     "drinking last night", "hangover", "been drinking", "can i donate after alcohol"],
        "answer": (
            "Wait at least 24 hours after drinking alcohol before donating. Alcohol dehydrates "
            "you, which makes donation harder on your body and may cause light-headedness. "
            "Come in well-hydrated — drink 500 ml of water before you go."
        ),
        "source": "NHS Give Blood",
    },
    {
        "id": "situational_dehydration",
        "keywords": ["thirsty", "dehydrated", "not drinking enough water", "dry mouth",
                     "drink water before", "should i drink water", "hydrated before donating"],
        "answer": (
            "Good hydration makes donation easier and helps prevent dizziness. Drink at least "
            "500 ml of water in the hour or two before you donate. Avoid caffeinated drinks "
            "close to donation time. If you feel very thirsty right now, drink water and wait "
            "30–60 minutes before heading in."
        ),
        "source": "NHS Give Blood",
    },
    {
        "id": "situational_heavy_meal",
        "keywords": ["just ate", "ate a lot", "heavy meal", "big meal", "full stomach",
                     "just had food", "after eating", "can i donate after eating",
                     "ate fatty food", "oily food"],
        "answer": (
            "You should eat before donating — but avoid very fatty or oily foods in the "
            "2 hours before donation, as fat in the blood can affect blood tests. A light "
            "meal (rice, roti, fruit, juice) is ideal. If you just had a large fatty meal, "
            "wait 2–3 hours before donating."
        ),
        "source": "NHS Give Blood / Blood Warriors",
    },
    {
        "id": "situational_tattoo_piercing",
        "keywords": ["got a tattoo", "tattooed", "tattoo", "piercing", "got pierced",
                     "body piercing", "ear piercing", "nose ring", "can i donate after tattoo"],
        "answer": (
            "Wait 6 months after getting a tattoo or piercing before donating blood. "
            "This is a safety deferral: if the equipment used was not sterile, there is a "
            "short window where infections like hepatitis may not yet show up on tests. "
            "After 6 months you are clear to donate."
        ),
        "source": "WHO blood safety guidelines / NHS Give Blood",
    },
    {
        "id": "situational_period_menstruation",
        "keywords": ["periods", "menstruation", "on my period", "time of the month",
                     "monthly cycle", "can i donate during period", "menstruating"],
        "answer": (
            "You can donate during your period if you feel well and have no fever. "
            "Your hemoglobin level is checked before donation — if it is below the minimum "
            "threshold you will be deferred that day with no penalty. If you experience heavy "
            "periods or feel particularly low on energy, it may be better to donate in the "
            "week after your period ends."
        ),
        "source": "NHS Give Blood",
    },
    {
        "id": "situational_low_hemoglobin_weak",
        "keywords": ["feel weak", "feeling weak", "anaemic", "anemic", "low hemoglobin",
                     "low hb", "pale", "dizzy before donating", "feeling low",
                     "not feeling strong", "weak today"],
        "answer": (
            "If you feel weak or suspect low hemoglobin, the donation center will check your "
            "hemoglobin before proceeding. If it is below the safe threshold (typically 12.5 g/dL "
            "for women, 13.0 g/dL for men), you will not be allowed to donate that day — "
            "that is a safety check, not a rejection. Eat iron-rich foods (lentils, leafy greens, "
            "eggs) regularly to keep levels up."
        ),
        "source": "NHS Give Blood / TIF guidelines",
    },
    {
        "id": "situational_diabetes_bp",
        "keywords": ["diabetic", "diabetes", "sugar patient", "blood pressure", "hypertension",
                     "high bp", "low bp", "heart condition", "can diabetic donate",
                     "can i donate with bp"],
        "answer": (
            "Controlled type-2 diabetes on oral medication: generally eligible to donate. "
            "Insulin-dependent diabetes: deferred at most centers. "
            "Controlled blood pressure (below 160/100 mmHg): eligible. "
            "Uncontrolled hypertension or recent heart condition: deferred. "
            "Always inform donation staff about your condition — they do a mini health check "
            "and make the final eligibility call."
        ),
        "source": "NHS Give Blood eligibility guidelines",
    },
    {
        "id": "situational_want_to_donate_general",
        "keywords": ["i want to donate", "i would like to donate", "i want to give blood",
                     "thinking of donating", "planning to donate", "want to help",
                     "interested in donating", "how do i donate"],
        "answer": (
            "That's a meaningful decision. Here is what to do: register on the ThalNet Donor "
            "Portal or at bloodwarriors.in. On donation day, eat a light meal and drink "
            "500 ml of water beforehand. The donation itself takes about 10–15 minutes. "
            "Afterward, rest for 15 minutes and have a snack. Your donation directly supports "
            "a thalassemia patient who needs blood every 15–20 days for life."
        ),
        "source": "Blood Warriors / ThalNet platform",
    },
]


# ── Learned FAQ (persisted to disk) ──────────────────────────────────────

def _load_learned() -> list[dict]:
    try:
        data = json.loads(_LEARNED_PATH.read_text())
        return data if isinstance(data, list) else []
    except Exception:
        return []


def learn_faq(question: str, answer: str, source: str = "Admin-submitted") -> dict:
    """Append a new FAQ entry to the learned store. Returns the new entry."""
    learned = _load_learned()
    slug = re.sub(r"[^a-z0-9]+", "_", question.lower().strip())[:40]
    entry = {
        "id": f"learned_{slug}",
        "keywords": [question.lower().strip()],
        "answer": answer.strip(),
        "source": source,
        "learned": True,
    }
    learned.append(entry)
    _LEARNED_PATH.write_text(json.dumps(learned, indent=2, ensure_ascii=False))
    return entry


def log_unanswered(query: str, role: str) -> None:
    """Append an unanswered query to the review log (one JSON per line)."""
    try:
        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "query": query,
            "role": role,
        }
        with _UNANSWERED_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception:
        pass


def get_unanswered(limit: int = 50) -> list[dict]:
    """Return most recent unanswered queries for admin review."""
    try:
        lines = _UNANSWERED_PATH.read_text().splitlines()
        records = []
        for line in lines:
            try:
                records.append(json.loads(line))
            except Exception:
                pass
        return records[-limit:]
    except Exception:
        return []


# ── Lookup ────────────────────────────────────────────────────────────────

def _matches(keyword: str, text: str) -> bool:
    return re.search(r"\b" + re.escape(keyword) + r"\b", text) is not None


def lookup(message: str) -> Optional[dict]:
    """Best-matching FAQ entry across static + learned FAQ, or None."""
    text = message.lower()
    all_faq = FAQ + _load_learned()
    best: Optional[dict] = None
    best_score = 0
    for entry in all_faq:
        score = sum(len(kw) for kw in entry["keywords"] if _matches(kw, text))
        if score > best_score:
            best_score = score
            best = entry
    return best
