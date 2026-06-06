# ThalNet — Progress & Work Log

Living document for **Team Distortion** (2 people). Update it whenever you start or finish
something so we both always know the state of play. Newest entries at the top of the log.

- **Project:** ThalNet — Autonomous Blood Bridge (see [`docs/DESIGN.md`](docs/DESIGN.md))
- **Hackathon:** AI4Good 2.0 (Blend360) · **AWS cap:** $40 (alert $30) · **Region:** us-east-1

---

## Current status

🟡 **Design approved? — PENDING.** Awaiting team sign-off on `docs/DESIGN.md` before coding.

## Who's doing what

| Person | Area | Currently working on |
|--------|------|----------------------|
| **Swaroop** | Backend + AI (FastAPI, Bedrock agent, Step Functions, DynamoDB) | _reviewing design_ |
| **Teammate** | Data + ML + Deploy (dataset, SageMaker models, AWS setup, Amplify) | _reviewing design_ |
| **Claude** | UI generation, scaffolding, glue code, keeps this file updated | drafting design + plan |

## Task board

### 🔜 To do (next up)
- [ ] Team: approve or amend `docs/DESIGN.md`
- [ ] AWS: log in, enable MFA, set region us-east-1, create **$40 Budget alarm** (first 10 min)
- [ ] AWS: request **Bedrock Claude Haiku** model access
- [ ] Data: clean `Dataset.csv`, upload to S3, seed DynamoDB
- [ ] ML: train Model A (willingness) + Model B (churn) in SageMaker notebook
- [ ] Backend: FastAPI skeleton + DynamoDB wiring
- [ ] Matching: ranking engine (blood compat + geo + ML scores + reasons)
- [ ] Agent: Bedrock chat with memory + reply interpretation
- [ ] Orchestration: Step Functions outreach loop
- [ ] Frontend: React dashboard + donor chat + request form
- [ ] Deploy: Lambda+API Gateway (backend), Amplify (frontend)
- [ ] Self-learning loop + consent gate
- [ ] Demo dry-run + submit

### 🏗️ In progress
- [ ] Design doc review (whole team)

### ✅ Done
- [x] 2026-06-06 — Read all hackathon docs (problem, AWS guide, dataset, criteria) — _Claude_
- [x] 2026-06-06 — Reviewed live Blood Warriors site for gaps/opportunities — _Claude_
- [x] 2026-06-06 — Cloned repo, inspected structure — _Claude_
- [x] 2026-06-06 — Wrote `docs/DESIGN.md` (architecture, ML spec, cost plan, timeline) — _Claude_

---

## Decisions log
- **2026-06-06** — Direction: build the **full platform thin + 2 deep AI spikes** (ML matching
  + autonomous agent), not one narrow slice.
- **2026-06-06** — Stack: React (Amplify) · FastAPI on Lambda+API Gateway · DynamoDB · Bedrock
  Claude Haiku · sklearn via SageMaker notebook · Step Functions outreach. Serverless-first
  to stay well under $40.
- **2026-06-06** — Outreach channel: **simulated in-app WhatsApp/SMS + real email via SES**
  (no paid Twilio/WhatsApp for the demo).
- **2026-06-06** — Skipping Glue/Kinesis/Redshift/Athena/EKS/Fargate (overkill for 7k rows);
  keep as "scale path" talking point.

## Daily log (newest first)
### 2026-06-06
- Brainstormed direction with Claude; chose ThalNet full-platform approach.
- Design doc + this tracker created. Pending team approval to start building.

---

## How to update this file
1. Move your task from **To do** → **In progress** → **Done** (add date + your name).
2. Add a one-line note in the **Daily log**.
3. Record any non-obvious choice in the **Decisions log**.
4. Keep the **Who's doing what** table current so we don't collide.
