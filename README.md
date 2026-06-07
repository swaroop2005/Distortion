# ThalNet — AI Blood Support Network

**Blend360 AI For Good 2.0 Hackathon · Team Distortion · 2026**

Autonomous AI system connecting thalassemia patients with voluntary blood donors across India. Replaces manual phone-call coordination with a 3-agent AI loop that never sleeps, speaks 3 languages, and learns from every failure.

---

## What It Does

- **Auto-Bridge Builder** — 8-donor staggered chain per patient. Self-heals on decline. Zero coordinator intervention.
- **3-Agent Loop** — Triage → Outreach → Escalate+Learn. Autonomous end-to-end.
- **ML Models** — Churn prediction (0.968 ROC-AUC) + Responsiveness proxy (0.865 AUC).
- **LLM Outreach** — Empathetic personalized donor messages via AWS Bedrock Haiku. Interprets replies in EN/HI/TE.
- **National Stock Layer** — 44,675 records across 3,863 blood banks (e-RaktKosh).
- **Role-Based Portal** — Patient · Donor · Admin Coordinator (React 19 + Vite).

---

## Quick Start

```bash
# Backend (FastAPI on :8001)
.venv/bin/uvicorn backend.app.main:app --reload --port 8001

# Frontend (Vite on :5173, proxies to :8001)
cd frontend && npm install && npm run dev
```

Visit `http://localhost:5173`. API docs at `http://localhost:8001/docs`.

**Demo IDs:** Patient: `PT-001` · Donor: `DN-001`

**LLM:** defaults to mock ($0). Switch to real: `THALNET_LLM_BACKEND=bedrock`

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind v4 |
| Backend | FastAPI + Mangum (Lambda-ready) |
| AI / LLM | AWS Bedrock Haiku (mock default) |
| ML | sklearn — churn + responsiveness models |
| Data | DynamoDB (prod) / in-memory store (local) |
| Deploy | Amplify + Lambda + API Gateway + SES |

Budget: `<$10` target · `<$40` hard cap. No EC2/RDS/SageMaker endpoints.

---

## Repository Layout

```
backend/          FastAPI app — 55 endpoints across 7 routers
frontend/         React portal — Patient / Donor / Admin views
data/             Cleaned CSVs + national blood stock
models/           Trained .pkl files (churn + responsiveness)
optimizer/        L1 supply optimizer (built, do not modify)
project/          L1 project scaffolding
docs/             Architecture + design notes
scripts/          Data cleaning utilities
notebooks/        Model training script
deploy/           AWS deploy scripts
Dataset.csv       Raw hackathon dataset (7,033 rows, Hyderabad)
requirements.txt  Python dependencies
```

---

## Data

- **7,033 rows** — Hyderabad district donor/patient records
- **132 geo-coded** collection points (haversine matching)
- **44,675 blood stock records** — 3,863 national banks (e-RaktKosh)
- Privacy: all data local-first. Patient data never sent to LLM prompts.

---

## Team - Distortion

- Swaroop Chandra Ponnada
- Medi Harshith Kumar
