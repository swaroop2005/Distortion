# Website Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a role-aware, read-only, multilingual (EN/HI/TE) website chatbot that answers grounded questions about a user's eligibility, their bridge, real blood-bank stock, and thalassemia FAQs — in a warm, empathetic voice — served by `POST /chat`.

**Architecture:** Intent-router + grounded handlers (Approach C). Each handler deterministically fetches *only* real data from the existing data layer (`store.py`, `eligibility.py`, `supply_store.py`, `bridge.py`, plus a curated `knowledge.py`), builds a `grounded_facts` dict, then an LLM adapter phrases those facts in a shared empathetic voice. Mock-first ($0, offline); Bedrock Haiku switchable via `THALNET_LLM_BACKEND=bedrock`. The LLM never sees raw data and may never invent numbers.

**Tech Stack:** Python 3.9, FastAPI, Pydantic, existing in-memory store (pandas), existing MockLLM/BedrockLLM adapters. Tests are `assert`-based smoke scripts under `backend/tests/`, run with `.venv/bin/python -m backend.tests.<module>` (the repo's established pattern — no pytest dependency assumed).

**Spec:** `docs/superpowers/specs/2026-06-07-chatbot-and-outreach-design.md` (Part A).

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/app/services/voice.py` | NEW — shared empathy layer: `TONE_GUIDE`, `EXEMPLARS`, `system_prompt(lang)` |
| `backend/app/services/knowledge.py` | NEW — curated cite-able FAQ bank + `lookup(message)` |
| `backend/app/services/outreach.py` | EDIT — add `classify_intent` + `compose_chat_reply` to `MockLLM` and `BedrockLLM` |
| `backend/app/services/chatbot.py` | NEW — intent router + 5 handlers + `handle_chat()` |
| `backend/app/routers/chat.py` | NEW — `POST /chat` endpoint |
| `backend/app/main.py` | EDIT — register chat router |
| `backend/tests/__init__.py` | NEW — make tests a package |
| `backend/tests/test_voice.py` | NEW — smoke test |
| `backend/tests/test_knowledge.py` | NEW — smoke test |
| `backend/tests/test_outreach_chat.py` | NEW — smoke test for the adapter additions |
| `backend/tests/test_chatbot.py` | NEW — main handler smoke test (case table) |
| `backend/tests/test_chat_endpoint.py` | NEW — FastAPI TestClient endpoint test |

**Convention note:** all new code uses `from __future__ import annotations` to match the existing modules (Python 3.9, `dict[...]` hints).

---

## Task 1: Shared empathy layer (`voice.py`)

**Files:**
- Create: `backend/app/services/voice.py`
- Create: `backend/tests/__init__.py`
- Test: `backend/tests/test_voice.py`

- [ ] **Step 1: Create the tests package marker**

Create `backend/tests/__init__.py` as an empty file.

```python
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_voice.py`:

```python
"""Smoke test for the shared empathy/voice layer."""
from backend.app.services import voice


def test_constants_present():
    assert isinstance(voice.TONE_GUIDE, str) and len(voice.TONE_GUIDE) > 50
    assert isinstance(voice.EXEMPLARS, list) and 3 <= len(voice.EXEMPLARS) <= 6
    assert all(isinstance(e, str) and e.strip() for e in voice.EXEMPLARS)


def test_no_banned_language():
    """Medical-honesty rule: never promise a cure, never gamify illness."""
    blob = (voice.TONE_GUIDE + " " + " ".join(voice.EXEMPLARS)).lower()
    for banned in ["cure", "cured", "curing", "game", "points", "badge", "level up"]:
        assert banned not in blob, f"banned word in voice layer: {banned}"


def test_system_prompt_includes_lang_and_tone():
    sp = voice.system_prompt("te")
    assert voice.TONE_GUIDE in sp
    assert "te" in sp  # instructs the model which language to answer in
    assert "only the facts" in sp.lower()  # anti-hallucination guard


if __name__ == "__main__":
    test_constants_present()
    test_no_banned_language()
    test_system_prompt_includes_lang_and_tone()
    print("test_voice OK")
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_voice`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.app.services.voice'`

- [ ] **Step 4: Write the implementation**

Create `backend/app/services/voice.py`:

```python
"""Shared empathy/voice layer for ThalNet's chatbot and outreach bot.

A small tone guide + a few original exemplars give every message a warm, human
voice WITHOUT model training or copyrighted text. Imported by both chatbot.py
and (later) the outreach loop so the system speaks with one consistent voice.

Hard rule: thalassemia is lifelong — never promise a cure, never gamify illness.

Run as a smoke test:  .venv/bin/python -m backend.tests.test_voice
"""
from __future__ import annotations

LANG_NAMES = {"en": "English", "hi": "Hindi", "te": "Telugu"}

TONE_GUIDE = (
    "You are a warm, caring Blood Warriors coordinator. Speak like a kind human, "
    "not a form. Guidelines:\n"
    "- Greet the person warmly; use their role/name when known.\n"
    "- Thalassemia is a lifelong condition. Be gentle and honest; never say 'cure' "
    "and never treat a patient's illness as a game.\n"
    "- Share exactly one concrete, real fact that you were given.\n"
    "- End with a soft, optional next step. Never pressure or guilt anyone.\n"
    "- Keep it short (under 90 words) and easy to read."
)

# Original exemplars (written in-house — no copyrighted source). They carry the
# warm cadence we want the model to imitate.
EXEMPLARS = [
    "Hi Aarav — good news: you can give blood again in 5 days. Somewhere nearby, a "
    "young patient counts on donors like you to keep going. No rush at all — just "
    "reply whenever you're ready and we'll find a convenient slot.",
    "Hello! Thank you for caring about this. Thalassemia means a patient needs steady "
    "transfusions for life, so every donor truly matters. Whenever you're free, we'd be "
    "grateful to have you on a bridge.",
    "Hey Meera — your bridge looks healthy right now, with enough donors lined up for the "
    "next cycle. Nothing you need to do today. We'll gently nudge you if that ever changes.",
]


def system_prompt(lang: str = "en") -> str:
    """Build the shared system prompt for any reply, in the requested language."""
    lang = lang if lang in LANG_NAMES else "en"
    return (
        f"{TONE_GUIDE}\n\n"
        f"Examples of the voice to imitate:\n- "
        + "\n- ".join(EXEMPLARS)
        + f"\n\nRespond in {LANG_NAMES[lang]} (code: {lang}). "
        "Use only the facts provided to you; if a needed fact is missing, say you "
        "don't have it. Never invent numbers, names, or availability."
    )
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_voice`
Expected: `test_voice OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/voice.py backend/tests/__init__.py backend/tests/test_voice.py
git commit -m "feat(chatbot): shared empathy/voice layer"
```

---

## Task 2: Curated FAQ knowledge bank (`knowledge.py`)

**Files:**
- Create: `backend/app/services/knowledge.py`
- Test: `backend/tests/test_knowledge.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_knowledge.py`:

```python
"""Smoke test for the curated FAQ knowledge bank."""
from backend.app.services import knowledge


def test_entries_have_source():
    assert len(knowledge.FAQ) >= 4
    for entry in knowledge.FAQ:
        assert entry["answer"].strip()
        assert entry["source"].strip()
        assert isinstance(entry["keywords"], list) and entry["keywords"]


def test_lookup_matches_thalassemia():
    hit = knowledge.lookup("what is thalassemia?")
    assert hit is not None
    assert "lifelong" in hit["answer"].lower()
    assert hit["source"]


def test_lookup_no_match_returns_none():
    assert knowledge.lookup("what's the weather in paris") is None


if __name__ == "__main__":
    test_entries_have_source()
    test_lookup_matches_thalassemia()
    test_lookup_no_match_returns_none()
    print("test_knowledge OK")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_knowledge`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.app.services.knowledge'`

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/knowledge.py`:

```python
"""Curated, cite-able FAQ facts for the chatbot's general_faq handler.

Every entry carries a source so answers stay grounded and honest. These are
domain facts (not user data) drawn from the project's Problem Statement and
Blood Warriors' own published model. The chatbot phrases them warmly but never
adds medical claims beyond what's here.

Run as a smoke test:  .venv/bin/python -m backend.tests.test_knowledge
"""
from __future__ import annotations

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


def lookup(message: str) -> Optional[dict]:
    """Return the best-matching FAQ entry, or None if nothing matches.

    Scores each entry by how many of its keywords appear in the message; the
    longest matched keyword wins ties (more specific match).
    """
    text = message.lower()
    best: Optional[dict] = None
    best_score = 0
    for entry in FAQ:
        score = sum(len(kw) for kw in entry["keywords"] if kw in text)
        if score > best_score:
            best_score = score
            best = entry
    return best
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_knowledge`
Expected: `test_knowledge OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/knowledge.py backend/tests/test_knowledge.py
git commit -m "feat(chatbot): curated cite-able FAQ knowledge bank"
```

---

## Task 3: LLM adapter additions (`outreach.py`)

Add `classify_intent` and `compose_chat_reply` to **both** `MockLLM` and `BedrockLLM` so the chatbot works offline and with real Haiku.

**Files:**
- Modify: `backend/app/services/outreach.py`
- Test: `backend/tests/test_outreach_chat.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_outreach_chat.py`:

```python
"""Smoke test for the chatbot additions to the Mock LLM adapter."""
from backend.app.services.outreach import MockLLM


def test_classify_intent_labels():
    m = MockLLM()
    assert m.classify_intent("when can I donate again?")["intent"] == "personal_eligibility"
    assert m.classify_intent("how is my bridge doing")["intent"] == "bridge_status"
    assert m.classify_intent("is O+ available near me")["intent"] == "stock_lookup"
    assert m.classify_intent("what is thalassemia")["intent"] == "general_faq"
    assert m.classify_intent("asdfghjkl")["intent"] == "fallback"


def test_classify_intent_hindi_telugu():
    m = MockLLM()
    assert m.classify_intent("main kab donate kar sakta hoon")["intent"] == "personal_eligibility"
    assert m.classify_intent("naaku eppudu donate cheyochu")["intent"] == "personal_eligibility"


def test_compose_chat_reply_uses_facts_only():
    m = MockLLM()
    facts = {"eligible": False, "days_until": 12, "total_donations": 4}
    reply = m.compose_chat_reply(facts, {"role": "donor"}, "en")
    assert "12" in reply  # the real number is surfaced
    assert reply.strip()


def test_compose_chat_reply_missing_facts_is_honest():
    m = MockLLM()
    reply = m.compose_chat_reply({"note": "no_record"}, {"role": "donor"}, "en")
    assert reply.strip()


if __name__ == "__main__":
    test_classify_intent_labels()
    test_classify_intent_hindi_telugu()
    test_compose_chat_reply_uses_facts_only()
    test_compose_chat_reply_missing_facts_is_honest()
    print("test_outreach_chat OK")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_outreach_chat`
Expected: FAIL — `AttributeError: 'MockLLM' object has no attribute 'classify_intent'`

- [ ] **Step 3: Add intent keyword map + MockLLM methods**

In `backend/app/services/outreach.py`, add this constant just below the existing
`REPLY_LABELS = [...]` line (around line 26):

```python
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
}
```

Then, inside the `MockLLM` class (after its existing `detect_language` method,
around line 111), add:

```python
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
        from .voice import LANG_NAMES
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
            return (f"{greeting}! Your bridge currently looks '{b['integrity']}' with "
                    f"{b['donors']} donors lined up. We'll gently step in if that changes.")

        # Stock facts
        if "banks" in facts:
            banks = facts["banks"]
            if not banks:
                return (f"{greeting}! I couldn't find available {facts.get('blood_group','')} "
                        f"stock near {facts.get('district','that area')} right now. "
                        "I can check a wider area if you'd like.")
            top = banks[0]
            return (f"{greeting}! {top['name']} in {top['district']} currently shows "
                    f"{top['available_units']} units of {top['blood_group']}. "
                    f"I found {len(banks)} bank(s) with stock nearby.")

        # FAQ facts
        if "answer" in facts:
            return f"{greeting}! {facts['answer']}"

        # Fallback
        return (f"{greeting}! I can help with your donation eligibility, your bridge, "
                "blood availability near you, or questions about thalassemia donation. "
                "What would you like to know?")
```

- [ ] **Step 4: Add the matching methods to BedrockLLM**

Inside the `BedrockLLM` class (after its existing `detect_language` method,
around line 197), add:

```python
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
            if data.get("intent") in CHAT_INTENT_KEYWORDS or data.get("intent") == "fallback":
                return data
        except json.JSONDecodeError:
            pass
        return {"intent": "fallback", "confidence": 0.3}

    def compose_chat_reply(self, facts: dict, tone_context: dict, lang: str) -> str:
        from .voice import system_prompt
        import json
        system = system_prompt(lang)
        user_msg = (
            "Write a reply using ONLY these facts (JSON). If a needed fact is missing, "
            "say you don't have it. Do not invent numbers.\n"
            f"Role of the person: {tone_context.get('role', 'unknown')}\n"
            f"Facts: {json.dumps(facts, default=str)}"
        )
        return self._call(system, user_msg, max_tokens=220)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_outreach_chat`
Expected: `test_outreach_chat OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/outreach.py backend/tests/test_outreach_chat.py
git commit -m "feat(chatbot): add classify_intent + compose_chat_reply to LLM adapters"
```

---

## Task 4: Intent router + handlers (`chatbot.py`)

The core. Each handler returns `(facts: dict, sources: list[str])`. `handle_chat`
ties detection → classification → dispatch → phrasing together.

**Files:**
- Create: `backend/app/services/chatbot.py`
- Test: `backend/tests/test_chatbot.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_chatbot.py`:

```python
"""Main smoke test for the chatbot intent router + grounded handlers."""
from backend.app.services import chatbot
from backend.app.services.store import all_donors, all_patients
from backend.app.utils.eligibility import days_until_eligible


def _a_donor_id():
    return all_donors()[0]["user_id"]


def _a_patient_id():
    return all_patients()[0]["user_id"]


def test_personal_eligibility_grounded():
    did = _a_donor_id()
    res = chatbot.handle_chat("when can I donate again?", role="donor", user_id=did)
    assert res["intent"] == "personal_eligibility"
    # grounded_facts number must equal what the data layer returns — no hallucination
    from backend.app.services.store import get_donor
    expected = days_until_eligible(get_donor(did))
    assert res["grounded_facts"]["days_until"] == expected
    assert "Dataset.csv" in res["sources"]
    assert res["reply"].strip()


def test_bridge_status_intent():
    pid = _a_patient_id()
    res = chatbot.handle_chat("how is my bridge doing?", role="patient", user_id=pid)
    assert res["intent"] == "bridge_status"
    assert "bridges" in res["grounded_facts"]


def test_stock_lookup_uses_real_supply():
    res = chatbot.handle_chat("is O+ available in Hyderabad?", role="public", user_id=None)
    assert res["intent"] == "stock_lookup"
    assert "banks" in res["grounded_facts"]
    assert "e-RaktKosh" in " ".join(res["sources"])


def test_general_faq():
    res = chatbot.handle_chat("what is thalassemia?", role="public", user_id=None)
    assert res["intent"] == "general_faq"
    assert "lifelong" in res["grounded_facts"]["answer"].lower()


def test_fallback():
    res = chatbot.handle_chat("asdfghjkl", role="public", user_id=None)
    assert res["intent"] == "fallback"


def test_role_gating_no_leak():
    """A donor asking a patient-only question gets a graceful refusal, not data."""
    did = _a_donor_id()
    res = chatbot.handle_chat("how is my bridge doing?", role="donor", user_id=did)
    assert res["grounded_facts"].get("note") == "wrong_role"
    assert "bridges" not in res["grounded_facts"]


def test_unknown_user_no_fabrication():
    res = chatbot.handle_chat("when can I donate again?", role="donor", user_id="NOPE-404")
    assert res["grounded_facts"].get("note") == "no_record"
    assert "days_until" not in res["grounded_facts"]


def test_language_detection():
    # Telugu phrase containing existing detector markers ("nenu", "cheyandi")
    # plus the eligibility keyword "eppudu".
    res = chatbot.handle_chat("nenu eppudu donate cheyandi", role="donor", user_id=_a_donor_id())
    assert res["lang"] == "te"
    assert res["intent"] == "personal_eligibility"


if __name__ == "__main__":
    test_personal_eligibility_grounded()
    test_bridge_status_intent()
    test_stock_lookup_uses_real_supply()
    test_general_faq()
    test_fallback()
    test_role_gating_no_leak()
    test_unknown_user_no_fabrication()
    test_language_detection()
    print("test_chatbot OK")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_chatbot`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.app.services.chatbot'`

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/chatbot.py`:

```python
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
from . import supply_store_shim as _stock  # see note below
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
        rec = get_donor(user_id) or get_patient(user_id) if user_id else None
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
```

- [ ] **Step 4: Add the supply shim so stock lookups import cleanly**

`supply_store.py` lives at `backend/app/supply_store.py` (one level above
`services/`). Create `backend/app/services/supply_store_shim.py` to re-export the
functions the chatbot needs, keeping the import path inside `services/` tidy:

```python
"""Thin re-export of the app-level supply_store for use inside services/."""
from __future__ import annotations

from ..supply_store import banks_with_stock, stock_summary, nearest_districts  # noqa: F401
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_chatbot`
Expected: `test_chatbot OK`

(If `test_stock_lookup_uses_real_supply` finds zero banks for O+/Hyderabad in the
data, that's still a PASS — the assertion only checks that `banks` exists and the
source is tagged, not that it's non-empty.)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/chatbot.py backend/app/services/supply_store_shim.py backend/tests/test_chatbot.py
git commit -m "feat(chatbot): intent router + 5 grounded handlers"
```

---

## Task 5: `POST /chat` endpoint + wiring

**Files:**
- Create: `backend/app/routers/chat.py`
- Modify: `backend/app/main.py` (import + include the chat router)
- Test: `backend/tests/test_chat_endpoint.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_chat_endpoint.py`:

```python
"""Endpoint smoke test for POST /chat using FastAPI's TestClient."""
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.store import all_donors

client = TestClient(app)


def test_chat_happy_path():
    did = all_donors()[0]["user_id"]
    r = client.post("/chat", json={
        "message": "when can I donate again?",
        "role": "donor",
        "user_id": did,
    })
    assert r.status_code == 200
    body = r.json()
    for key in ("reply", "intent", "lang", "grounded_facts", "sources"):
        assert key in body
    assert body["intent"] == "personal_eligibility"


def test_chat_no_record():
    r = client.post("/chat", json={
        "message": "when can I donate again?",
        "role": "donor",
        "user_id": "NOPE-404",
    })
    assert r.status_code == 200
    assert r.json()["grounded_facts"].get("note") == "no_record"


if __name__ == "__main__":
    test_chat_happy_path()
    test_chat_no_record()
    print("test_chat_endpoint OK")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_chat_endpoint`
Expected: FAIL — POST /chat returns 404 (route not registered yet).

- [ ] **Step 3: Create the router**

Create `backend/app/routers/chat.py`:

```python
"""Chatbot route — role-aware, read-only, grounded, multilingual assistant.

POST /chat is stateless and single-turn. role/user_id are trusted from the body
for now; when RBAC middleware lands, derive them from the auth context instead.
"""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..services.chatbot import handle_chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    role: Literal["donor", "patient", "admin", "public"] = "public"
    user_id: Optional[str] = None
    lang: Optional[str] = None  # "en" | "hi" | "te"; auto-detected when null


@router.post("")
def chat(req: ChatRequest):
    """Answer one grounded, empathetic message. Read-only — never mutates state."""
    return handle_chat(
        message=req.message,
        role=req.role,
        user_id=req.user_id,
        lang=req.lang,
    )
```

- [ ] **Step 4: Register the router in main.py**

In `backend/app/main.py`, update the router import line (currently
`from .routers import admin, donors, patients, supply`) to include `chat`:

```python
from .routers import admin, chat, donors, patients, supply
```

Then add this line in the "Public portals" section (after
`app.include_router(patients.router)`, around line 78):

```python
app.include_router(chat.router)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_chat_endpoint`
Expected: `test_chat_endpoint OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/chat.py backend/app/main.py backend/tests/test_chat_endpoint.py
git commit -m "feat(chatbot): POST /chat endpoint + router wiring"
```

---

## Task 6: Full smoke run + docs

**Files:**
- Modify: `PROGRESS.md`
- Modify: `CLAUDE.md` (check off the chatbot item, add file to the Files map)

- [ ] **Step 1: Run every chatbot smoke test together**

Run:
```bash
.venv/bin/python -m backend.tests.test_voice && \
.venv/bin/python -m backend.tests.test_knowledge && \
.venv/bin/python -m backend.tests.test_outreach_chat && \
.venv/bin/python -m backend.tests.test_chatbot && \
.venv/bin/python -m backend.tests.test_chat_endpoint
```
Expected: five `... OK` lines, no traceback.

- [ ] **Step 2: Manually verify the live endpoint (Bedrock off = mock)**

Run the server: `.venv/bin/uvicorn backend.app.main:app --port 8000` (in another shell),
then:
```bash
curl -s -X POST localhost:8000/chat -H 'content-type: application/json' \
  -d '{"message":"what is thalassemia?","role":"public"}' | python3 -m json.tool
```
Expected: JSON with `"intent": "general_faq"`, a warm `reply`, and
`"sources": ["Problem Statement.pdf / Blood Warriors"]`.

- [ ] **Step 3: Update PROGRESS.md**

Add a dated entry under the work log noting: website chatbot built (intent-router
+ 5 grounded handlers, EN/HI/TE, mock-first, shared voice layer), all 5 smoke tests
pass, `POST /chat` live. Mention Part B (outreach hardening) is next.

- [ ] **Step 4: Update CLAUDE.md**

In the `## Next` section, change the chatbot line from unchecked to done, and add to
the Files map under `backend/app/`:
```
backend/app/services/chatbot.py   intent-router chatbot (5 grounded handlers, EN/HI/TE)
backend/app/services/voice.py     shared empathy layer (tone guide + exemplars)
backend/app/services/knowledge.py curated cite-able FAQ
```

- [ ] **Step 5: Commit**

```bash
git add PROGRESS.md CLAUDE.md
git commit -m "docs: mark website chatbot done; update file map + progress"
```

---

## Self-Review notes (for the implementer)

- **Mock-first guarantee:** every test runs with the default `MockLLM` (no AWS). Do not set
  `THALNET_LLM_BACKEND=bedrock` while running the smoke tests.
- **No hallucinated stats:** the `test_personal_eligibility_grounded` test asserts the
  `grounded_facts` number equals the data layer's own `days_until_eligible` output. Keep that
  invariant if you refactor.
- **Read-only:** no handler calls `build_bridge`, `heal_bridge`, `log_outcome`, or any mutator.
  If a future change needs an action, that belongs in Part B, not here.
- **`days_until` clamping:** handler clamps negatives to 0 (`max(0, ...)`) so an "overdue"
  donor reads as eligible; `eligible` boolean comes from the unclamped `is_eligible`.
