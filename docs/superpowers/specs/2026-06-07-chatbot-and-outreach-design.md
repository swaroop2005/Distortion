# ThalNet — Website Chatbot + Outreach-Loop Hardening — Design

**Date:** 2026-06-07
**Author:** Swaroop + Claude
**Status:** Approved design, pending spec review
**Build order:** Chatbot first (this spec, Part A) → Outreach hardening second (Part B, outlined here)

---

## 0. Context & Goal

ThalNet (Layer 2) already has a working autonomous outreach loop
(`backend/app/services/outreach.py` + `orchestrator.py`, `/agent/*` routes). Two things
are requested:

1. **Website chatbot** — net-new, top unchecked item in `CLAUDE.md`. Role-aware,
   read-only, grounded, warm/empathetic, multilingual.
2. **Outreach-loop hardening** — close real gaps in the existing loop (Part B).

This spec details the **chatbot in full** and **outlines** the outreach hardening so both
share one LLM/voice layer. The chatbot is built first.

### Hard constraints (from CLAUDE.md / project rules)
- **Authentic data only:** the only real data is `Dataset.csv` (→ `data/clean.csv`) and the
  scraped e-RaktKosh data (`data/blood_stock_long.csv`, `data/blood_banks.csv`). The bot
  **never invents stats** — it only phrases facts the data layer returns.
- **Medical honesty:** thalassemia is lifelong. Never say "cure". No gamifying a child's illness.
- **Mock-first, $0:** must work fully with `MockLLM` offline. Bedrock Haiku is switchable via
  `THALNET_LLM_BACKEND=bedrock`. No SageMaker endpoint, no fine-tuning (budget <$10 / $40 cap).
- **Smoke test every module.**

---

## Part A — Website Chatbot

### A1. Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Scope | Read-only personal context (role-aware; reads, never writes) |
| Languages | EN + Hindi + Telugu |
| LLM backend | Mock-first, Bedrock switchable (reuse existing adapters) |
| Empathy approach | Tone guide + few-shot exemplars (NO model training, NO audio) |
| Architecture | Intent-router + grounded handlers (Approach C) |
| Conversation | Stateless, single-turn (v1) |
| Auth | `role`/`user_id` trusted from request body (RBAC middleware is a later TODO) |
| Grounding | Only `Dataset.csv` + scraped e-RaktKosh + curated FAQ |

### A2. File layout

```
backend/app/services/voice.py       NEW — shared empathy layer (TONE_GUIDE + EXEMPLARS)
backend/app/services/knowledge.py   NEW — curated, cite-able thalassemia/donation FAQ
backend/app/services/chatbot.py     NEW — intent router + 5 grounded handlers
backend/app/routers/chat.py         NEW — POST /chat endpoint
backend/app/services/outreach.py    EDIT — add classify_intent() + compose_chat_reply() to both LLM adapters
backend/app/main.py                 EDIT — register chat router (+ fix agent/supply wiring, see Part B)
```

### A3. Request flow

```
POST /chat  {message, role, user_id?, lang?}
      │
      ▼
chatbot.handle_chat()
  1. lang = lang or detect_language(message)        # reuse outreach.detect_language
  2. intent = classify_intent(message)              # personal_eligibility | bridge_status
                                                     #  | stock_lookup | general_faq | fallback
  3. facts, sources = dispatch(intent, role, user_id, message)   # deterministic data fetch
  4. reply = compose_chat_reply(facts, tone_context, lang)       # LLM phrases facts in voice
      │
      ▼
  {reply, intent, lang, grounded_facts, sources}
```

**Invariant:** `grounded_facts` is built by the handler from the data layer *before* the LLM is
called. `compose_chat_reply` may only phrase those facts; if a fact is missing it must say so,
never fabricate.

### A4. The shared empathy layer — `voice.py`

Exports:

1. **`TONE_GUIDE`** (str) — system-prompt fragment:
   - Address the person warmly (by name/role when known).
   - Acknowledge the patient's lifelong reality gently. Never say "cure"; never gamify illness.
   - State one concrete real fact (provided by the handler).
   - Soft call-to-action; never pressure or guilt.
   - Mirror the user's language (EN/HI/TE).
2. **`EXEMPLARS`** (list[str]) — 3–5 short, original example messages carrying a warm cadence
   (written by us; no copyrighted light-novel text). Used as few-shot "write in this voice".

`voice.py` is shared by the chatbot and (Part B) the outreach bot so both sound like one voice.

### A5. LLM adapter additions (`outreach.py`, both `MockLLM` and `BedrockLLM`)

- `classify_intent(message: str) -> dict` → `{"intent": str, "confidence": float}`
  - Mock: keyword match incl. HI/TE markers (e.g. "eligible/donate/kab/eppudu" → `personal_eligibility`;
    "bridge/squad" → `bridge_status`; "stock/units/available/bank" → `stock_lookup`;
    else `general_faq`; truly empty/odd → `fallback`).
  - Bedrock: one short Haiku classify call returning the label.
- `compose_chat_reply(facts: dict, tone_context: dict, lang: str) -> str`
  - System prompt = `TONE_GUIDE` + `EXEMPLARS` + "Respond in {lang}. Use ONLY the facts provided;
    if a fact is missing, say you don't have it. Never invent numbers."
  - Mock: warm template that slots `facts` into a fixed shape; localized greeting token per lang;
    body in EN when mock.
  - Bedrock: real Haiku call.

### A6. Intent router + 5 handlers — `chatbot.py`

Each handler returns `(grounded_facts: dict, sources: list[str])`. Handlers fetch only the
asking user's own data. All are individually smoke-testable.

**1. `personal_eligibility`** (donor)
- Data: `store.get_donor(user_id)` → `eligibility.days_until_eligible(donor)`,
  `eligibility.is_eligible(donor)`, `donor["donations_till_date"]`.
- Facts: `{eligible, days_until, total_donations}`. Source: `Dataset.csv`.
- Guard: non-donor role or no record → polite "I can only see that for a registered donor."

**2. `bridge_status`** (patient)
- Data: `bridge.patient_bridges(user_id)` → integrity (Full/At-risk/Broken), donor count,
  coverage. (`bridge.build_bridge` is NOT called here — read-only; if no bridge exists, say so.)
- Facts: `{bridges: [{integrity, donors, ...}]}`. Source: `Dataset.csv` + bridge engine.

**3. `stock_lookup`** (anyone)
- Data: `supply_store.norm_bg()` to normalize the group; if lat/lon or district available use
  `supply_store.nearest_districts()` then `supply_store.banks_with_stock()` /
  `supply_store.stock_summary()`.
- Facts: `{blood_group, district, banks: [{name, units, type}]}`. Source: **e-RaktKosh scraped data**.
- Guard: if location unknown, ask the user for their district rather than guessing.

**4. `general_faq`** (anyone)
- Data: `knowledge.py` curated fact bank (thalassemia lifelong; 8→1 bridge model; transfusion
  every 15–20 days; 90-day donation window; who can donate). Each entry carries a source tag.
- Facts: matched FAQ entry. Source: `knowledge.py` (FAQ). No invented medical claims.

**5. `fallback`** (unmatched/off-topic)
- No data fetch. Warm redirect listing what it can help with.

**Cross-cutting rails:** role-gating (donor asking `bridge_status` → gentle "that's a patient
view", no leak); missing record/model → honest message, never a fabricated number;
`user_id` only ever fetches that user's row.

### A7. Endpoint contract — `routers/chat.py`

`POST /chat`

Request:
```json
{ "message": "inka enni rojulu naaku donate cheyadaniki",
  "role": "donor", "user_id": "abc123", "lang": null }
```
Response:
```json
{ "reply": "Namaste! You're eligible to donate again in 12 days...",
  "intent": "personal_eligibility", "lang": "te",
  "grounded_facts": {"eligible": false, "days_until": 12, "total_donations": 4},
  "sources": ["Dataset.csv"] }
```
- `role`: `donor | patient | admin | public`. `user_id` optional (null for public).
- `lang` optional override; auto-detected when null.
- Registered in `main.py` via `app.include_router(chat.router)`.

### A8. Multilingual flow (EN/HI/TE)
1. `lang = lang or detect_language(message)`.
2. Intent classification is language-agnostic (keyword lists include HI/TE markers; Haiku is
   natively multilingual).
3. Handler fetches facts (language-neutral data).
4. `compose_chat_reply` told to respond in `{lang}`. Bedrock replies natively; Mock uses a
   localized greeting token + EN body so it still demos offline.

### A9. Testing (all with MockLLM, offline, $0)
Each module runnable via `.venv/bin/python -m backend.app.services.<mod>`.
- `voice.py`: `TONE_GUIDE` + `EXEMPLARS` non-empty; exemplars contain no "cure"/gamification.
- `knowledge.py`: FAQ lookup returns a known entry + a source tag.
- `chatbot.py` (main): case table —
  - donor "when can I donate?" → `personal_eligibility`; facts match `days_until_eligible` for a real id.
  - patient "how's my bridge?" → `bridge_status`; integrity present.
  - "is O+ available in Hyderabad?" → `stock_lookup`; banks from e-RaktKosh.
  - "what is thalassemia?" → `general_faq`; source = knowledge.
  - gibberish → `fallback`.
  - role-gating: donor asking bridge_status → graceful refusal, no leak.
  - HI + TE messages → correct lang detected, intent still classified.
  - grounding guard: unknown user_id → honest "no record", no fabricated number.
- Endpoint: FastAPI `TestClient` on `POST /chat` happy path + no-record path; assert schema
  (`reply`, `intent`, `lang`, `sources`).
- **Integrity assertion:** for each handler, the numbers in `grounded_facts` equal what the data
  layer returned (warmth can't drift into hallucinated stats).

---

## Part B — Outreach-Loop Hardening (OUTLINE — designed later, built second)

The existing loop simulates replies and is single-pass. Gaps to close, sharing `voice.py`:

1. **Real inbound-reply endpoint** — `POST /agent/reply {request_id, donor_id, text}` →
   `detect_language` → `interpret_reply` → `log_outcome` → advance request. Replaces the dice-roll
   simulation with real interpreted replies (simulation kept as an optional demo mode).
2. **Follow-up loop** — for `maybe`/`later`/`no_response`, schedule a follow-up step instead of
   stopping after one pass (multi-touch with caps).
3. **Fatigue-aware cadence** — implement the documented action selector
   (contact now / wait / appreciate / DND) from Model B churn + recent-contact history, gating
   who gets contacted in `run_outreach_cycle`.
4. **Closed learning loop** — feed `failure_summary()` back into the outreach system prompt
   (currently computed but never used) so the message adapts to what's working.
5. **Wiring fix** — `main.py` does not register the `agent` router, and `routers/supply.py` is
   empty (0 bytes) while `supply_routes.py` holds the real code. Register `agent.router` and
   resolve the supply-router duplication so the loop + supply endpoints are reachable.

Each gets its own implementation plan after the chatbot ships.

---

## Out of scope (YAGNI)
- Model fine-tuning / training on light novels (stack + budget + medical-honesty reasons).
- Audio (TTS/STT) — text only.
- Multi-turn conversation memory (stateless v1; revisit later).
- RBAC/auth middleware (trust body fields for now; seam comment left).
- React chatbot UI (frontend not yet scaffolded; this spec delivers the backend endpoint).
