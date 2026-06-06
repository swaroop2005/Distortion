# ThalNet — Chatbot Wellness Suggestions — Design

**Date:** 2026-06-07
**Author:** Swaroop + Claude
**Status:** Approved design, pending spec review
**Builds on:** the website chatbot (`docs/superpowers/specs/2026-06-07-chatbot-and-outreach-design.md`, Part A — shipped to main).

---

## 0. Goal & Safety Framing

Let the website chatbot offer **supportive, everyday wellness suggestions** (diet, hydration/daily
habits, emotional wellbeing) to patients, donors, and general users — so people feel supported
between doctor visits. Suggestions only; never a replacement for a clinician.

### Hard safety decisions (settled during brainstorming)
- **NOT free-form / model-generated medical advice.** The bot only phrases **vetted, cited
  suggestions** the handler already selected. The LLM never invents health facts.
- **NO Reddit-sourced medical content and NO model fine-tuning.** (Reddit anecdotes are unsafe for
  this condition — e.g. "eat iron-rich food" is standard anemia advice but *harmful* for
  transfusion-dependent thalassemia patients due to iron overload; and fine-tuning doesn't fit the
  Bedrock-Haiku / no-SageMaker / <$10 stack.) The wellness bank is hand-curated from authoritative
  sources: Thalassemia International Federation (TIF), Cooley's Anemia Foundation, NHS, Blood Warriors.
- **Role-specific by design.** Same question, different safe answer per audience: iron-rich food is
  good recovery advice for a *donor* but a harmful suggestion for a transfusion-dependent *patient*.
  Filtering by audience is the core safety mechanism.
- **Always-on disclaimer.** Every wellness reply ends, in code (not at the model's discretion), with
  a "general suggestions, not medical advice — check with your hematologist" line.
- **Medical honesty preserved:** thalassemia is lifelong; nothing prescriptive (no doses, no
  "you must"); never implies a cure.

### Scope (settled)
- Topics: **diet (with cautions), hydration/daily habits, emotional & mental wellbeing.** (Activity/
  exercise deliberately excluded for v1.)
- Languages: EN/HI/TE (same handling as the chatbot — stored EN, model translates at reply time;
  Mock falls back to EN body with a localized greeting).
- Mock-first ($0, offline); Bedrock switchable. No external fetching at build or run time.

---

## 1. Architecture

Reuses the shipped intent-router chatbot. A new `wellness` intent routes to a `_wellness` handler
that fetches role-filtered, vetted suggestions; `compose_chat_reply` phrases them warmly and always
appends the disclaimer.

```
POST /chat {message:"what should I eat?", role:"patient", user_id}
  → classify_intent → "wellness"
  → _wellness(role, user_id, message):
        audience = {donor→"donor", patient→"patient", public/admin→"any"}
        topic    = wellness.detect_topic(message)   # diet|hydration|emotional|None
        rows     = wellness.suggest(audience, topic, limit=3)   # vetted, role-filtered
        facts    = {"suggestions":[...], "caution": <iron row if any, else None>}
        sources  = sorted distinct row sources
  → compose_chat_reply → warm phrasing, caution-first if present, + WELLNESS_DISCLAIMER
  → {reply, intent:"wellness", lang, grounded_facts, sources}
```

**Safety property:** role→audience filtering happens in `wellness.suggest()` (one tested function),
so a patient never receives donor-only diet advice, and `public`/`admin` only ever get
`audience="any"` general-safe tips. The LLM only sees the already-filtered rows.

---

## 2. Files

| File | Responsibility |
|---|---|
| `data/wellness_suggestions.csv` | NEW — curated, cited suggestion bank (the data) |
| `backend/app/services/wellness.py` | NEW — cached CSV loader; `suggest(audience, topic, limit)`, `detect_topic(message)` |
| `backend/app/services/chatbot.py` | EDIT — add `_wellness` handler + register `HANDLERS["wellness"]` + `_AUDIENCE` map |
| `backend/app/services/outreach.py` | EDIT — add `"wellness"` to `CHAT_INTENT_KEYWORDS`; add wellness reply branch + `WELLNESS_DISCLAIMER` to both adapters |
| `backend/tests/test_wellness.py` | NEW — loader + role-filter + caution-flag safety tests |
| `backend/tests/test_chatbot.py` | EDIT — add wellness intent/handler cases + disclaimer invariant |

All new code uses `from __future__ import annotations` (Python 3.9 style, matches the codebase).

---

## 3. Data — `data/wellness_suggestions.csv`

Columns: `id, topic, audience, suggestion, caution_flag, source, lang`

- `id`: stable slug (e.g. `patient_diet_iron`).
- `topic`: `diet` | `hydration` | `emotional`.
- `audience`: `patient` | `donor` | `any`.
- `suggestion`: vetted, plain-language tip (1–2 sentences). Non-prescriptive.
- `caution_flag`: `none` | `iron_overload` (extensible). Surfaced first when set.
- `source`: authoritative citation (non-empty on every row).
- `lang`: `en` for v1.

Seed ~12–18 rows across the 3 topics × audiences. The safety-critical divergence:

```
id                   topic      audience  caution_flag   source
patient_diet_iron    diet       patient   iron_overload  Thalassemia International Federation
patient_diet_tea     diet       patient   none           Cooley's Anemia Foundation
donor_diet_recovery  diet       donor     none           NHS Give Blood
any_hydration        hydration  any       none           NHS
patient_emotional    emotional  patient   none           Cooley's Anemia Foundation
donor_emotional      emotional  donor     none           Blood Warriors
any_emotional        emotional  any       none           Cooley's Anemia Foundation
```

`patient_diet_iron` (avoid excess iron) and `donor_diet_recovery` (iron-rich recovery foods) give
opposite guidance; the audience filter is what keeps them apart. Every row carries a real `source`;
nothing is prescriptive.

---

## 4. `wellness.py`

```python
load() -> list[dict]                          # read CSV once (lru_cache), like store.py
suggest(audience, topic=None, limit=3) -> list[dict]
    # rows where row["audience"] in {audience, "any"}; optional topic match; capped at limit.
    # deterministic ordering (caution rows first, then file order) so the iron caution surfaces.
detect_topic(message) -> Optional[str]        # keyword match; None = no specific topic
TOPIC_KEYWORDS = {"diet": [...], "hydration": [...], "emotional": [...]}
```

`suggest` is pure and deterministic. It must never return a row whose `audience` is the *other*
specific role (patient↔donor); only the requested audience plus `any`.

---

## 5. `_wellness` handler (`chatbot.py`)

```python
_AUDIENCE = {"donor": "donor", "patient": "patient", "admin": "any", "public": "any"}

def _wellness(role, user_id, message):
    audience = _AUDIENCE.get(role, "any")
    topic = wellness.detect_topic(message)
    rows = wellness.suggest(audience, topic, limit=3)
    if not rows:
        return {"note": "fallback"}, []
    facts = {
        "suggestions": [r["suggestion"] for r in rows],
        "caution": next((r["suggestion"] for r in rows if r["caution_flag"] != "none"), None),
    }
    sources = sorted({r["source"] for r in rows})
    return facts, sources
```
Register `HANDLERS["wellness"] = _wellness`. Read-only — no state mutation.

---

## 6. Intent routing (`outreach.py`)

Add to `CHAT_INTENT_KEYWORDS` (both Mock keyword-match and Bedrock allow-list pick it up):
```python
"wellness": ["what should i eat", "what to eat", "diet", "food", "stay healthy",
             "feel better", "tips", "lifestyle", "take care", "advice", "healthy",
             "kya khana", "khana", "aahar", "emcomito", "ela undali"],
```
`general_faq` keeps factual questions ("who can donate"); `wellness` owns "what should *I* eat / how
to stay healthy" suggestions. Length-weighted scoring separates them; a test locks it in.

---

## 7. Reply phrasing + disclaimer (`outreach.py`, both adapters)

Shared constant:
```python
WELLNESS_DISCLAIMER = ("These are general suggestions, not medical advice — "
                       "please check with your hematologist before making changes.")
```

**MockLLM** — add a branch in `compose_chat_reply` before the generic fallback:
```python
if "suggestions" in facts:
    parts = [f"{greeting}!"]
    if facts.get("caution"):
        parts.append("One important note: " + facts["caution"])
    others = [s for s in facts["suggestions"] if s != facts.get("caution")]
    if others:
        parts.append("A few things that may help: " + " ".join(others))
    parts.append(WELLNESS_DISCLAIMER)
    return " ".join(parts)
```

**BedrockLLM** — uses the existing facts-only path (`system_prompt(lang)` + JSON facts) with extra
instructions for this branch: if `caution` present, lead with it gently; always end with the exact
`WELLNESS_DISCLAIMER`; suggest, never prescribe (no doses, no "you must"). Disclaimer text comes from
the one shared constant so Mock and Bedrock match.

**Multilingual:** Bedrock replies + disclaimer in the user's language; Mock uses the localized
greeting + EN body/disclaimer (offline demo parity).

---

## 8. Testing (MockLLM, offline, $0)

`test_wellness.py`:
- CSV loads; every row has non-empty `id, topic, audience, suggestion, source`; `audience ∈
  {patient,donor,any}`; `caution_flag` valid.
- **Safety invariant 1:** `suggest("patient")` returns no `audience=="donor"` row; `suggest("donor")`
  returns no `patient` row; both include `any` rows.
- **Safety invariant 2:** ≥1 patient diet row has `caution_flag=="iron_overload"`; no donor diet row
  appears in a patient result set.
- `suggest("any")` returns only `any` rows (no patient/donor leak to anonymous users).
- `detect_topic`: "what should I eat" → `diet`; emotional phrasing → `emotional`; unknown → `None`.

`test_chatbot.py` additions:
- "what should I eat?" + `role=patient` → intent `wellness`; facts has `suggestions`; `caution`
  present; reply contains `WELLNESS_DISCLAIMER`.
- same + `role=donor` → `wellness`; donor-appropriate suggestions; **no** iron-overload caution.
- `role=public` "any tips to stay healthy?" → `wellness`; only `any` suggestions; disclaimer present.
- "who can donate?" still → `general_faq` (wellness didn't cannibalize FAQ).
- **Disclaimer invariant:** every `wellness` reply contains `WELLNESS_DISCLAIMER`.

Safety enforced in code (role-filter + appended disclaimer), not by the LLM.

---

## 9. Out of scope (YAGNI)
- Reddit scraping / any external fetching; model fine-tuning.
- Activity/exercise topic (v1 excludes it).
- Per-language suggestion rows (store EN; translate at reply time).
- Personalized medical recommendations tied to a user's clinical data (we have none; would be unsafe).
- Multi-turn memory (chatbot is stateless single-turn).
