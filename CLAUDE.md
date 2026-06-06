# ThalNet

AI blood-support network for Blood Warriors (thalassemia patients↔donors). Hackathon AI4Good 2.0, team Distortion, 2026-06-06.

## Arch
L1 SUPPLY (optimizer/+project/) BUILT → mobilization_plan.csv → L2 COORDINATION (backend/) BUILDING: Triage→Outreach→Escalate+Learn

## Stack
React Vite | FastAPI+Mangum | DynamoDB(local=in-memory store.py) | Bedrock Haiku | sklearn .pkl in Lambda | Amplify+Lambda/APIGW+S3+SES+StepFn
BANNED: EC2,RDS,OpenSearch,Kinesis,SageMaker-endpoint,NAT-GW. Budget <$10/$40cap. Local-first, AWS last.

## Run
`.venv/bin/uvicorn backend.app.main:app --reload --port 8000`
`.venv/bin/python -m backend.app.store` (smoke test)
Python 3.9.6 via `.venv/bin/python` | node v24 npm 11 | NO aws CLI | branch: scaffold-and-design

## Files
```
backend/app/main.py       FastAPI+Mangum
backend/app/store.py      data layer: clean.csv→84pat/4446donors+ML scores+synth consent
backend/app/compat.py     ABO+Rh matrix (16 raw strings→8 canonical+Bombay)
backend/app/eligibility.py 90-day window
backend/app/geo.py        haversine
backend/app/matching.py   rank donors: blood+elig+ML+geo, emergency mode
backend/app/bridge.py     Auto-Bridge 8→1, self-heal, integrity(Full/At-risk/Broken), alarms
backend/app/routers/      patients,donors,admin (11 endpoints)
models/*.pkl              churn(0.968ROC) + responsiveness(0.865proxy)
data/clean.csv            7033rows, Hyderabad, 132 geo pts, no consent col
optimizer/,project/       L1 BUILT — DON'T MODIFY
```

## Rules
- Flagship=Auto-Bridge Builder(8→1+stagger+self-heal)
- Medical honesty: thalassemia lifelong, NO cure bars/gamification
- Rank don't filter: ML=order+message, never exclusion
- Smoke test every module. Update PROGRESS.md every chat.
- UI via Claude Design cloning BW website style

## Done
ML models, store.py, geo/compat/eligibility, matching.py, bridge.py, 11 API endpoints

## Next
Outreach agent(Bedrock contact+reply-interpret+failure-learn) → StepFn orchestration → React → DynamoDB swap → deploy
