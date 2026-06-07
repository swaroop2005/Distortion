# ThalNet

AI blood-support network for Blood Warriors (thalassemia patients↔donors). Hackathon AI4Good 2.0, team Distortion, 2026-06-06.

## Arch
L1 SUPPLY (optimizer/+project/) BUILT → mobilization_plan.csv → L2 COORDINATION (backend/) BUILT: Triage→Outreach→Escalate+Learn

## Stack
React Vite | FastAPI+Mangum | DynamoDB(local=in-memory store.py) | Bedrock Haiku (mock+real) | sklearn .pkl in Lambda | Amplify+Lambda/APIGW+S3+SES+StepFn
BANNED: EC2,RDS,OpenSearch,Kinesis,SageMaker-endpoint,NAT-GW. Budget <$10/$40cap. Local-first, AWS last.
Switch LLM: `THALNET_LLM_BACKEND=bedrock` (default=mock, $0)

## Run
`.venv/bin/uvicorn backend.app.main:app --reload --port 8000`
Python 3.9.6 via `.venv/bin/python` | node v24 npm 11 | NO aws CLI | branch: scaffold-and-design
API docs: http://localhost:8000/docs (32 endpoints)

## Files
```
backend/app/main.py         FastAPI+Mangum, includes all routers
backend/app/store.py        data layer: clean.csv→84pat/4446donors+ML scores
backend/app/compat.py       ABO+Rh matrix (16 raw+canonical→8 types+Bombay)
backend/app/eligibility.py  90-day donation window
backend/app/geo.py          haversine
backend/app/matching.py     4-factor donor ranking (blood+elig+ML+geo)
backend/app/bridge.py       Auto-Bridge 8→1, self-heal, integrity, alarms
backend/app/supply.py       L1→L2 bridge (blood_stock+banks+mobilization seam)
backend/app/outreach.py     MockLLM+BedrockLLM, empathetic msgs, reply interpret(EN/HI/TE), failure learning
backend/app/orchestrator.py 3-agent loop: triage→outreach→escalate→learn
backend/app/services/chatbot.py   intent-router chatbot (5 grounded handlers, EN/HI/TE, read-only)
backend/app/services/voice.py     shared empathy layer (tone guide + exemplars)
backend/app/services/knowledge.py curated cite-able FAQ
backend/app/services/wellness.py  role-filtered cited wellness suggestions (diet/hydration/emotional)
data/wellness_suggestions.csv     curated wellness bank (audience + caution_flag + source)
backend/app/services/community_store.py  writable store: blood requests, connections, messages (DynamoDB-ready seam)
backend/app/routers/connections.py       /community/* donor<->patient connection endpoints
backend/app/routers/        patients,donors,admin,agent,supply_routes (32 endpoints)
models/*.pkl                churn(0.968ROC) + responsiveness(0.865proxy)
data/clean.csv              7033rows, Hyderabad, 132 geo pts
data/blood_stock_long.csv   44,675rows national stock (3,863 banks)
data/blood_banks.csv        bank metadata (district,phones,type)
optimizer/,project/         L1 BUILT — DON'T MODIFY
```

## Rules
- Flagship=Auto-Bridge Builder(8→1+stagger+self-heal)
- Medical honesty: thalassemia lifelong, NO cure bars/gamification
- Rank don't filter: ML=order+message, never exclusion
- Smoke test every module. Update PROGRESS.md every chat.
- UI via Claude Design cloning BW website style
- Push to main frequently so Swaroop stays in sync

## Done (all tested, subsystems pass)
ML models, store.py, compat, eligibility, geo, matching, bridge, supply integration, outreach agent (mock+bedrock), orchestrator (3-agent loop), API endpoints, **website chatbot (POST /chat: intent-router + 5 grounded read-only handlers, EN/HI/TE, mock-first)**, **wellness suggestions (role-filtered cited CSV bank, iron-overload guard, always-on non-medical-advice disclaimer)**

## Next
- [x] Chatbot endpoint (multilingual, context-aware) — POST /chat, intent-router + grounded handlers
- [ ] React scaffold + role-routed views (via Claude Design)
- [ ] DynamoDB swap (store.py internals)
- [ ] AWS deploy (Amplify + Lambda)
