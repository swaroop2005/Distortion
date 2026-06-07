# ThalNet — Session Handoff Context

**Last updated:** 2026-06-06 | **Branch:** scaffold-and-design

---

## 1. One-line
**ThalNet** = autonomous AI blood-support network for **Blood Warriors** (Hyderabad NGO, thalassemia patients ↔ voluntary donors). Hackathon: **AI For Good 2.0 (Blend360)**, team **Distortion** (Swaroop = backend/AI, Vijetha = data/supply, Claude = UI/scaffold/glue).

## 2. System = TWO layers joined by one file
```
LAYER 1 — SUPPLY COMMAND CENTER   (Vijetha · project/ + optimizer/)   [BUILT]
  real e-RaktKosh national data (3,863 banks, 44,675 rows)
  → predict shortage → optimize: redistribution MILP + MOBILIZATION PLAN
  → dashboard.html (admin supply view)
                    │  data/optimizer/mobilization_plan.csv   ← THE SEAM
                    ▼
LAYER 2 — AUTONOMOUS COORDINATION (Swaroop+Claude · backend/)   [BUILT]
  Triage (rank + Auto-Bridge Builder + ML)
  → Outreach (LLM multilingual, reply-interpret, fatigue cadence)
  → Escalate+Learn (failure learning)
```

## 3. What's Built (all tested, 10/10 subsystems pass)

### Backend — 32 API endpoints across 5 routers
Full docs: `backend/API_ROUTES.md`

| Module | File | What |
|--------|------|------|
| Data layer | `store.py` | 84 patients, 4446 donors, ML scores |
| Blood compat | `compat.py` | ABO+Rh matrix, 16 raw→8 canonical + Bombay |
| Eligibility | `eligibility.py` | 90-day donation window |
| Geo | `geo.py` | Haversine distance |
| Matching | `matching.py` | 4-factor ranking (blood+elig+ML+geo), emergency mode |
| Bridge Builder | `bridge.py` | 8→1 auto-bridge, self-heal, integrity score, alarms |
| Supply | `supply.py` | L1→L2 bridge, 44,675 stock rows, 3,863 banks |
| Outreach | `outreach.py` | MockLLM+BedrockLLM, empathetic msgs, reply interpret (EN/HI/TE) |
| Orchestrator | `orchestrator.py` | 3-agent loop: triage→outreach→escalate→learn |
| ML Models | `models/*.pkl` | Churn (0.968 ROC) + Responsiveness (0.865 proxy) |

### Routers (all in `backend/app/routers/`)
- **patients.py** — list, detail, build-bridge, heal-bridge, bridge-status
- **donors.py** — list, detail, clock, emergency-rank, register
- **admin.py** — dashboard, churn-alerts, bridges, donor/patient CRUD, urgent alerts
- **agent.py** — transfusion-due, new-donor, emergency, events, learning, requests, outcomes, review
- **supply_routes.py** — banks, regional, mobilization, patient-map

### Layer 1 (Vijetha, DONE)
- `optimizer/` + `project/` — e-RaktKosh scraper, shortage forecast, redistribution MILP, mobilization plan, dashboard.html

---

## 4. What's NOT Built Yet

### Must-build next
1. **Chatbot endpoint** — `POST /chat` context-aware, multilingual (EN/HI/TE), conversation memory
2. **Conversation memory** — in-memory store for chat history
3. **Donor response flow** — `POST /donors/{id}/respond`, `GET /donors/{id}/requests`
4. **Patient request creation** — `POST /patients/{id}/request`
5. **Request lifecycle** — mark fulfilled/closed

### Frontend (not started, Vijetha designing in Claude Design)
- React + Vite scaffold
- 3 role-routed views: Patient, Donor, Admin
- Chatbot widget on every page
- Will receive React exports from Claude Design → wire to API

### Infrastructure (not started)
- DynamoDB swap (store.py internals)
- AWS deploy (Amplify + Lambda + API Gateway)

---

## 5. Key Decisions
- **Flagship = Auto-Bridge Builder** (8→1, self-heal, integrity score)
- **Medical honesty**: thalassemia lifelong, NO cure bars/gamification/leaderboards/badges/streaks
- **Rank don't filter**: ML orders + messages, never excludes
- **Tone**: Genuine, gentle, warm. Like a kind nurse. No marketing, no guilt, no urgency pressure
- **Budget**: <$10 target, $40 cap. Serverless only. BANNED: EC2, RDS, OpenSearch, Kinesis, SageMaker-endpoint, NAT-GW
- **LLM**: `THALNET_LLM_BACKEND=mock` (default, $0) or `bedrock` (real Haiku)

---

## 6. How to Run
```bash
.venv/bin/uvicorn backend.app.main:app --reload --port 8000
# API docs: http://localhost:8000/docs
# Python 3.9.6 via .venv/bin/python | node v24, npm 11
```

## 7. Files to Read First
1. `CLAUDE.md` — project rules + arch overview
2. `docs/DESIGN.md` — full architecture + data model + ML spec
3. `backend/API_ROUTES.md` — all 32 endpoints documented
4. `PROGRESS.md` — work log + decisions

## 8. Repo
- Remote: https://github.com/swaroop2005/Distortion
- Branch: `scaffold-and-design`
