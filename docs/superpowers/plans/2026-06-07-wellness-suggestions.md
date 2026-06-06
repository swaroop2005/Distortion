# Wellness Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `wellness` chatbot intent that gives role-aware, source-cited, non-prescriptive wellness suggestions (diet / hydration & daily habits / emotional wellbeing) with an always-on "not medical advice" disclaimer.

**Architecture:** Reuses the shipped intent-router chatbot. A curated CSV (`data/wellness_suggestions.csv`) is the suggestion bank; `wellness.py` loads + role-filters it; a new `_wellness` handler in `chatbot.py` builds a `grounded_facts` dict from vetted rows; `compose_chat_reply` phrases them warmly and appends the shared `WELLNESS_DISCLAIMER`. The LLM only phrases already-filtered, already-safe rows — it never invents health facts.

**Tech Stack:** Python 3.9 (env is 3.14), FastAPI, stdlib `csv`, existing MockLLM/BedrockLLM adapters. Tests are `assert`-based smoke scripts run with `.venv/bin/python -m backend.tests.<module>`.

**Spec:** `docs/superpowers/specs/2026-06-07-wellness-suggestions-design.md`.

**Safety invariants (must hold):** patient never receives a `donor`-only row (iron-overload trap); `public`/`admin` get only `audience="any"` rows; every wellness reply contains `WELLNESS_DISCLAIMER`; nothing prescriptive.

---

## File Structure

| File | Responsibility |
|---|---|
| `data/wellness_suggestions.csv` | NEW — curated, cited suggestion bank |
| `backend/app/services/wellness.py` | NEW — cached CSV loader; `suggest(audience, topic, limit)`, `detect_topic(message)` |
| `backend/app/services/outreach.py` | EDIT — add `"wellness"` to `CHAT_INTENT_KEYWORDS`; add `WELLNESS_DISCLAIMER` + wellness branch to MockLLM; add wellness instruction to BedrockLLM |
| `backend/app/services/chatbot.py` | EDIT — add `_AUDIENCE`, `_wellness` handler, register `HANDLERS["wellness"]`, import `wellness` |
| `backend/tests/test_wellness.py` | NEW — loader + role-filter + caution-flag safety tests |
| `backend/tests/test_outreach_chat.py` | EDIT — add a wellness mock-reply test |
| `backend/tests/test_chatbot.py` | EDIT — add wellness intent/handler cases + disclaimer invariant |

All new code uses `from __future__ import annotations`.

---

## Task 1: Wellness data + loader (`wellness.py`)

**Files:**
- Create: `data/wellness_suggestions.csv`
- Create: `backend/app/services/wellness.py`
- Test: `backend/tests/test_wellness.py`

- [ ] **Step 1: Create the curated CSV**

Create `data/wellness_suggestions.csv` with EXACTLY this content (header + 14 rows; suggestion fields are quoted because they contain commas):

```csv
id,topic,audience,suggestion,caution_flag,source,lang
patient_diet_iron,diet,patient,"Because regular transfusions can cause iron to build up in the body, many patients are advised to avoid iron supplements and limit very high-iron foods — your hematologist guides what is right for you.",iron_overload,Thalassemia International Federation,en
patient_diet_tea,diet,patient,"Some patients find that tea or coffee with meals can lower how much iron the body absorbs; ask your doctor whether that suits your plan.",none,Cooley's Anemia Foundation,en
patient_diet_calcium,diet,patient,"Calcium and vitamin D — from foods like dairy or fortified options, plus safe sunlight — support bone health, which thalassemia can affect over time.",none,Thalassemia International Federation,en
donor_diet_recovery,diet,donor,"After donating, iron-rich foods like leafy greens, beans, and dates, along with good hydration, help your body rebuild.",none,NHS Give Blood,en
donor_diet_vitc,diet,donor,"Pairing iron-rich foods with vitamin C, such as citrus or tomatoes, can help your body absorb iron as you recover from a donation.",none,NHS Give Blood,en
any_diet_balanced,diet,any,"A balanced plate with vegetables, whole grains, and some protein is a friendly everyday default for most people.",none,NHS,en
any_hydration,hydration,any,"Staying well-hydrated supports your energy through the day; water is usually the simplest choice.",none,NHS,en
donor_hydration,hydration,donor,"Drinking extra water before and after donating helps you feel steadier and supports recovery.",none,NHS Give Blood,en
patient_hydration,hydration,patient,"Gentle, steady hydration can help you feel better around treatment days; your care team can advise if you have any fluid limits.",none,Cooley's Anemia Foundation,en
any_rest,hydration,any,"Regular sleep and a gentle daily routine help your body cope; small consistent habits beat big sudden changes.",none,NHS,en
patient_emotional,emotional,patient,"Living with a lifelong condition is heavy sometimes — leaning on family, peer support groups, or a counsellor is a real strength, not a weakness.",none,Cooley's Anemia Foundation,en
patient_emotional_peer,emotional,patient,"Connecting with others who manage thalassemia can ease the feeling of going through it alone.",none,Thalassemia International Federation,en
donor_emotional,emotional,donor,"Thank you for showing up for patients — your steady support genuinely helps keep someone's treatment on track.",none,Blood Warriors,en
any_emotional,emotional,any,"If stress or low mood lingers, talking to someone you trust or a professional can really help — reaching out is okay.",none,Cooley's Anemia Foundation,en
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_wellness.py`:

```python
"""Smoke + safety tests for the wellness suggestion bank."""
from backend.app.services import wellness


def test_rows_well_formed():
    rows = wellness.load()
    assert len(rows) >= 12
    for r in rows:
        assert r["id"].strip()
        assert r["topic"] in {"diet", "hydration", "emotional"}
        assert r["audience"] in {"patient", "donor", "any"}
        assert r["suggestion"].strip()
        assert r["source"].strip()
        assert r["caution_flag"] in {"none", "iron_overload"}


def test_patient_never_gets_donor_rows():
    """Safety invariant 1: the iron trap — no donor-only row reaches a patient."""
    rows = wellness.suggest("patient", limit=50)
    assert rows
    assert all(r["audience"] in {"patient", "any"} for r in rows)
    assert not any(r["audience"] == "donor" for r in rows)


def test_donor_never_gets_patient_rows():
    rows = wellness.suggest("donor", limit=50)
    assert rows
    assert all(r["audience"] in {"donor", "any"} for r in rows)


def test_public_gets_only_any_rows():
    rows = wellness.suggest("any", limit=50)
    assert rows
    assert all(r["audience"] == "any" for r in rows)


def test_patient_diet_has_iron_caution():
    """Safety invariant 2: at least one patient diet row carries the iron caution."""
    rows = wellness.suggest("patient", topic="diet", limit=50)
    assert any(r["caution_flag"] == "iron_overload" for r in rows)


def test_caution_rows_sorted_first():
    rows = wellness.suggest("patient", topic="diet", limit=3)
    assert rows[0]["caution_flag"] == "iron_overload"


def test_detect_topic():
    assert wellness.detect_topic("what should I eat?") == "diet"
    assert wellness.detect_topic("I feel so alone and stressed") == "emotional"
    assert wellness.detect_topic("how much water should I drink") == "hydration"
    assert wellness.detect_topic("xyzzy") is None


if __name__ == "__main__":
    test_rows_well_formed()
    test_patient_never_gets_donor_rows()
    test_donor_never_gets_patient_rows()
    test_public_gets_only_any_rows()
    test_patient_diet_has_iron_caution()
    test_caution_rows_sorted_first()
    test_detect_topic()
    print("test_wellness OK")
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_wellness`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.app.services.wellness'`

- [ ] **Step 4: Write the loader**

Create `backend/app/services/wellness.py`:

```python
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_wellness`
Expected: `test_wellness OK`

- [ ] **Step 6: Commit**

```bash
git add data/wellness_suggestions.csv backend/app/services/wellness.py backend/tests/test_wellness.py
git commit -m "feat(wellness): curated role-filtered suggestion bank + loader"
```

---

## Task 2: Wellness intent + reply phrasing (`outreach.py`)

**Files:**
- Modify: `backend/app/services/outreach.py`
- Test: `backend/tests/test_outreach_chat.py`

- [ ] **Step 1: Write the failing test**

Append these two test functions to `backend/tests/test_outreach_chat.py`, and add calls to them in the `if __name__ == "__main__":` block (before the `print(...)` line):

```python
def test_classify_intent_wellness():
    m = MockLLM()
    assert m.classify_intent("what should I eat to stay healthy?")["intent"] == "wellness"
    assert m.classify_intent("any tips for me?")["intent"] == "wellness"


def test_compose_wellness_reply_has_disclaimer_and_caution():
    from backend.app.services.outreach import WELLNESS_DISCLAIMER
    m = MockLLM()
    facts = {
        "suggestions": ["Avoid excess iron per your doctor.", "Stay hydrated."],
        "caution": "Avoid excess iron per your doctor.",
    }
    reply = m.compose_chat_reply(facts, {"role": "patient"}, "en")
    assert WELLNESS_DISCLAIMER in reply
    assert "important note" in reply.lower()  # caution surfaced first
    assert "hydrated" in reply
```

Add to the `__main__` block:
```python
    test_classify_intent_wellness()
    test_compose_wellness_reply_has_disclaimer_and_caution()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_outreach_chat`
Expected: FAIL — `AssertionError` on the wellness intent (it currently resolves to `general_faq`/`fallback`), or `ImportError` for `WELLNESS_DISCLAIMER`.

- [ ] **Step 3: Add the wellness intent keywords + disclaimer constant**

In `backend/app/services/outreach.py`, find the `CHAT_INTENT_KEYWORDS` dict (starts at the `"personal_eligibility"` block). Add a new `"wellness"` entry as the LAST key in the dict (after the `"general_faq"` list, before the closing `}`):

```python
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
```

Immediately AFTER the `CHAT_INTENT_KEYWORDS` dict closes, add the shared disclaimer constant:

```python
WELLNESS_DISCLAIMER = ("These are general suggestions, not medical advice — "
                       "please check with your hematologist before making changes.")
```

- [ ] **Step 4: Add the wellness branch to MockLLM.compose_chat_reply**

In `MockLLM.compose_chat_reply`, find the FAQ branch and the Fallback that follow it:

```python
        # FAQ facts
        if "answer" in facts:
            return f"{greeting}! {facts['answer']}"

        # Fallback
        return (f"{greeting}! I can help with your donation eligibility, your bridge, "
```

Insert a wellness branch BETWEEN the FAQ branch and the `# Fallback` comment:

```python
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
```

- [ ] **Step 5: Add wellness instruction to BedrockLLM.compose_chat_reply**

Find the SECOND `compose_chat_reply` (inside `BedrockLLM`):

```python
    def compose_chat_reply(self, facts: dict, tone_context: dict, lang: str) -> str:
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

Replace it with (adds a wellness instruction + the mandatory disclaimer; `system_prompt` is already imported at module level):

```python
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
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_outreach_chat`
Expected: `test_outreach_chat OK`

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/outreach.py backend/tests/test_outreach_chat.py
git commit -m "feat(wellness): wellness intent keywords + disclaimer-guarded reply phrasing"
```

---

## Task 3: Wellness handler in the router (`chatbot.py`)

**Files:**
- Modify: `backend/app/services/chatbot.py`
- Test: `backend/tests/test_chatbot.py`

- [ ] **Step 1: Write the failing test**

Append these test functions to `backend/tests/test_chatbot.py`, and add calls to them in the `if __name__ == "__main__":` block (before the `print(...)` line):

```python
def test_wellness_patient_has_caution_and_disclaimer():
    from backend.app.services.outreach import WELLNESS_DISCLAIMER
    res = chatbot.handle_chat("what should I eat?", role="patient", user_id=_a_patient_id())
    assert res["intent"] == "wellness"
    assert "suggestions" in res["grounded_facts"]
    assert res["grounded_facts"]["caution"]  # iron caution present for a patient
    assert WELLNESS_DISCLAIMER in res["reply"]
    assert res["sources"]


def test_wellness_donor_no_iron_caution():
    res = chatbot.handle_chat("what should I eat?", role="donor", user_id=_a_donor_id())
    assert res["intent"] == "wellness"
    assert res["grounded_facts"]["suggestions"]
    assert res["grounded_facts"].get("caution") is None  # donors get no iron-overload caution


def test_wellness_public_general_only():
    from backend.app.services.outreach import WELLNESS_DISCLAIMER
    res = chatbot.handle_chat("any tips to stay healthy?", role="public", user_id=None)
    assert res["intent"] == "wellness"
    assert res["grounded_facts"]["suggestions"]
    assert WELLNESS_DISCLAIMER in res["reply"]


def test_faq_still_routes_to_faq():
    """Wellness must not cannibalize the factual FAQ intent."""
    res = chatbot.handle_chat("what is thalassemia?", role="public", user_id=None)
    assert res["intent"] == "general_faq"
```

Add to the `__main__` block:
```python
    test_wellness_patient_has_caution_and_disclaimer()
    test_wellness_donor_no_iron_caution()
    test_wellness_public_general_only()
    test_faq_still_routes_to_faq()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_chatbot`
Expected: FAIL — `handle_chat` routes "what should I eat?" to a handler with no `wellness` entry, so `intent` is not `"wellness"` (falls to `fallback`), failing the first assertion.

- [ ] **Step 3: Import the wellness module**

In `backend/app/services/chatbot.py`, find the imports block:

```python
from . import knowledge
from . import supply_store_shim as _stock
from .outreach import get_llm
```

Add the wellness import:

```python
from . import knowledge
from . import wellness
from . import supply_store_shim as _stock
from .outreach import get_llm
```

- [ ] **Step 4: Add the `_AUDIENCE` map and `_wellness` handler**

In `backend/app/services/chatbot.py`, find the `_fallback` handler and the `HANDLERS` dict that follow it:

```python
def _fallback(role: str, user_id: Optional[str], message: str) -> tuple[dict, list]:
    return {"note": "fallback"}, []


HANDLERS = {
    "personal_eligibility": _personal_eligibility,
    "bridge_status": _bridge_status,
    "stock_lookup": _stock_lookup,
    "general_faq": _general_faq,
    "fallback": _fallback,
}
```

Insert the `_AUDIENCE` map and `_wellness` handler BETWEEN `_fallback` and `HANDLERS`, then add the `"wellness"` entry to `HANDLERS`:

```python
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
    "fallback": _fallback,
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_chatbot`
Expected: `test_chatbot OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/chatbot.py backend/tests/test_chatbot.py
git commit -m "feat(wellness): role-filtered _wellness handler in the chatbot router"
```

---

## Task 4: Full smoke run + docs

**Files:**
- Modify: `PROGRESS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full chatbot + wellness smoke suite**

Run:
```bash
.venv/bin/python -m backend.tests.test_voice && \
.venv/bin/python -m backend.tests.test_knowledge && \
.venv/bin/python -m backend.tests.test_wellness && \
.venv/bin/python -m backend.tests.test_outreach_chat && \
.venv/bin/python -m backend.tests.test_chatbot && \
.venv/bin/python -m backend.tests.test_chat_endpoint
```
Expected: six `... OK` lines, no traceback. (A scikit-learn `InconsistentVersionWarning` is harmless.)
If any test FAILS, STOP and report BLOCKED — do not edit docs.

- [ ] **Step 2: Manually verify wellness via the endpoint**

Run:
```bash
.venv/bin/python -c "
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.store import all_donors, all_patients
c = TestClient(app)
pid = all_patients()[0]['user_id']
did = all_donors()[0]['user_id']
print('PATIENT:', c.post('/chat', json={'message':'what should I eat?','role':'patient','user_id':pid}).json())
print('DONOR  :', c.post('/chat', json={'message':'what should I eat?','role':'donor','user_id':did}).json())
print('PUBLIC :', c.post('/chat', json={'message':'any tips to stay healthy?','role':'public'}).json())
"
```
Expected: PATIENT response has `intent=wellness`, a non-null `caution` (iron), and the disclaimer in `reply`; DONOR response has `intent=wellness` with `caution: null`; PUBLIC has `intent=wellness` with only general suggestions. Capture the output for the report.

- [ ] **Step 3: Update PROGRESS.md**

READ it first to match the format. Add a dated entry (2026-06-07) noting: wellness suggestions added to the chatbot — new `wellness` intent + role-filtered handler, curated cited CSV (`data/wellness_suggestions.csv`), diet/hydration/emotional topics, patient-vs-donor filtering guards the iron-overload trap, always-on non-medical-advice disclaimer, all 6 chatbot smoke tests pass.

- [ ] **Step 4: Update CLAUDE.md**

READ it first. In the `## Files` code block under `backend/app/`, add:
```
backend/app/services/wellness.py  role-filtered cited wellness suggestions (diet/hydration/emotional)
data/wellness_suggestions.csv     curated wellness bank (audience + caution_flag + source)
```
Do not make other edits.

- [ ] **Step 5: Commit**

```bash
git add PROGRESS.md CLAUDE.md
git commit -m "docs: record wellness suggestions feature"
```

---

## Self-Review notes (for the implementer)

- **Mock-first:** all tests run with default `MockLLM`. Do not set `THALNET_LLM_BACKEND=bedrock`.
- **Safety invariants are enforced in code:** `wellness.suggest` filters by audience (patient never sees donor rows), and the `WELLNESS_DISCLAIMER` is appended by `compose_chat_reply`, not left to the model. Keep both if you refactor.
- **Read-only:** `_wellness` only reads the CSV; no state mutation.
- **Intent ordering:** "what should I eat" must classify as `wellness`, while "what is thalassemia" stays `general_faq` — `test_faq_still_routes_to_faq` guards this. If you add wellness keywords, re-run `test_chatbot` to confirm FAQ isn't cannibalized.
```
