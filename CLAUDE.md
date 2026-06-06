# ThalNet — CLAUDE.md

## What this is
Autonomous AI blood-support network for Blood Warriors (Hyderabad NGO, thalassemia patients ↔ donors). Hackathon: AI For Good 2.0 (Blend360), team Distortion. **Date: 2026-06-06.**

## Architecture: 2 layers joined by one CSV
```
LAYER 1 — SUPPLY COMMAND CENTER (optimizer/ + project/) [BUILT]
  e-RaktKosh national data → predict shortage → MILP redistribution
  → mobilization_plan.csv (THE SEAM) → dashboard.html
LAYER 2 — AUTONOMOUS COORDINATION (backend/) [BUILDING]
  Triage → Outreach → Escalate+Learn (3-agent loop)
```

## Stack (LOCKED)
- **Frontend:** React (Vite) — UI will be generated via Claude Design from BW website style
- **Backend:** FastAPI + Mangum (Lambda-ready), Python 3.9.6, venv at `.venv/`
- **DB:** DynamoDB (on-demand). Local dev = in-memory (store.py)
- **AI:** Bedrock Claude Haiku (chat/interpret/translate), sklearn .pkl in Lambda
- **Infra:** 100% serverless — Amplify + Lambda/API Gateway + DynamoDB + S3 + SES + Step Functions
- **BANNED (bill idle):** EC2, RDS, OpenSearch, Kinesis, SageMaker endpoint, NAT GW
- **Budget:** <$10 target under $40 cap. ML served by loading .pkl inside Lambda = $0
- **Local-first:** React Vite + FastAPI on localhost ($0). AWS deploy last.

## Repo layout
```
backend/app/main.py        FastAPI app + Mangum handler
backend/app/store.py       In-memory data layer (clean.csv + ML scores)
backend/app/compat.py      ABO+Rh compatibility matrix (16 messy strings → 8 canonical)
backend/app/eligibility.py 90-day donation window
backend/app/geo.py          Haversine distance
backend/app/matching.py    4-factor donor ranking (blood + eligibility + ML + geo)
backend/app/bridge.py      Auto-Bridge Builder (8→1, self-heal, integrity, alarms)
backend/app/routers/       patients.py, donors.py, admin.py (11 endpoints)
models/                    churn_model.pkl, responsiveness_model.pkl, metrics.json
notebooks/train_models.py  ML training script
data/clean.csv             7033 rows (84 patients, 4446 donors)
data/blood_banks.csv       National e-RaktKosh (3863 banks)
data/blood_stock_long.csv  National stock (44675 rows)
optimizer/                 Layer 1 (Vijetha) — BUILT, don't modify
project/                   Layer 1 scraper — BUILT, don't modify
docs/DESIGN.md             Full spec
docs/CONTEXT.md            Session handoff doc
PROGRESS.md                Live work log — UPDATE EVERY CHAT
```

## Running
```bash
# Backend
.venv/bin/uvicorn backend.app.main:app --reload --port 8000

# Smoke test any module
.venv/bin/python -m backend.app.store

# Run ML training
.venv/bin/python notebooks/train_models.py
```

## Data facts
- clean.csv: 7033 rows, 84 patients, 4446 donors (Emergency+Bridge roles)
- Blood groups: 16 messy strings normalized to 8 ABO+Rh types + Bombay
- Geo: Hyderabad-centric, 132 unique lat/lng points, coarse
- No consent column → synthesized in store.py
- ML: churn 0.968 ROC (strong), responsiveness 0.865 (weak proxy — never headline)

## Key decisions
- **Flagship:** Auto-Bridge Builder (8→1 bridge, eligibility-stagger, self-heal)
- **Medical honesty:** Thalassemia lifelong, NO cure progress bars, no gamifying illness
- **Rank don't filter:** ML decides order + message, never who's allowed
- **Build order:** Patient view first → Donor → Admin
- **Cognito:** Real login, role claim routes to role-specific dashboard
- **UI approach:** Clone BW website style via Claude Design, add new pages/features

## Conventions
- Run with `.venv/bin/python` (Python 3.9.6)
- node v24 + npm 11 installed
- aws CLI NOT installed
- Branch: scaffold-and-design
- Smoke test every new module before moving on
- Update PROGRESS.md every chat session (standing rule)

## What's built (as of 2026-06-06)
- [x] ML models (churn + responsiveness) with leakage fix
- [x] store.py data layer
- [x] Shared modules: geo, compat, eligibility
- [x] matching.py (4-factor ranker)
- [x] bridge.py (Auto-Bridge Builder + self-heal + alarms)
- [x] FastAPI routers (11 endpoints, all tested)
- [x] Layer 1 optimizer (Vijetha) — BUILT

## What's next
- [ ] Outreach agent (Bedrock contact loop, reply interpretation, failure learning)
- [ ] Step Functions orchestration (rank→contact→interpret→follow-up→escalate)
- [ ] React scaffold + role-routed views
- [ ] DynamoDB migration (swap store.py internals)
- [ ] Deploy (Amplify + Lambda)
