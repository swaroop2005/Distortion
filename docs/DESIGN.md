# ThalNet — Autonomous Blood Bridge for Blood Warriors

**Hackathon:** AI4Good 2.0 (Blend360) · **Team:** Distortion (2 people) · **Date:** 2026-06-06
**Status:** 📝 Design — awaiting team approval before implementation.

---

## 1. The problem (in one paragraph)

Blood Warriors connects voluntary donors with Thalassemia patients across India through
recurring "Blood Bridges." Today, matching donors to patients, coordinating requests,
chasing follow-ups, and keeping donors engaged is **mostly manual** and does not scale.
We are asked to build an **autonomous, AI-powered blood-support network** that coordinates
requests, engages the *right* donors at the *right* time, holds conversations with memory
across languages, learns from failures, and gives admins live insight — with minimal
manual effort.

## 2. What we are building

**ThalNet** — one platform that covers the whole workflow (a "walking skeleton" of the
entire brief) with **two deep AI spikes** where judges reward depth most:

1. **Smart Matching & Prediction engine** (real ML on the provided 7,033-row dataset).
2. **Autonomous agentic outreach loop** (Bedrock + Step Functions) that contacts ranked
   donors, interprets their replies, follows up, escalates, and **learns from outcomes**.

Everything else (patient request flow, donor chat, admin dashboard, consent, memory) is
real but intentionally thin, so the demo *feels* like a complete product end-to-end.

### Design principle
> Build the **full platform thin**, then make the **AI core deep**. Serverless-first so
> idle cost ≈ $0. I (Claude) generate the React UI and most infra; the team owns Python,
> ML, and AWS wiring.

## 3. Users / roles

| Role | What they do in ThalNet |
|------|--------------------------|
| **Patient / Bridge** | Raises a recurring or emergency blood request. |
| **Donor** | Receives outreach, chats with the multilingual assistant, accepts/declines, checks eligibility. |
| **Admin (Blood Warriors staff)** | Watches live requests, donor-pool health, predictions, and escalations on a dashboard. |
| **The Agent (autonomous)** | Ranks → contacts → interprets → follows up → escalates → logs outcomes, with no human in the loop until escalation. |

## 4. Architecture

```
                         ┌──────────────────────────────────────────────┐
   React (Vite) UI ─────▶│  FastAPI on Lambda + API Gateway (REST)      │
   - Admin dashboard     │  - requests, donors, chat, dashboard data     │
   - Donor chat          └───────┬───────────────┬──────────────────────┘
   - Request form                │               │
   (hosted on Amplify)           ▼               ▼
                          ┌──────────────┐  ┌─────────────────────┐
                          │  DynamoDB    │  │  Amazon Bedrock      │
                          │  Users       │  │  (Claude Haiku)      │
                          │  Bridges     │  │  - chat + memory     │
                          │  Requests    │  │  - reply interpret   │
                          │  Conversations│ │  - multilingual      │
                          │  Outcomes    │  └─────────────────────┘
                          └──────┬───────┘
                                 │
   New request triggers ─────────▼───────────────────────────────────────
   ┌───────────────────── AWS Step Functions: Outreach Loop ─────────────┐
   │ 1 RankDonors (Lambda → ML model + matching rules)                    │
   │ 2 ContactDonor (Bedrock writes msg → SES email + in-app inbox)       │
   │ 3 Wait (EventBridge timer)                                           │
   │ 4 InterpretReply (Bedrock classifies: accept / decline / unclear)    │
   │ 5 Choice → accepted? confirm & stop : next donor / escalate          │
   │ 6 EscalateToAdmin (SNS)                                              │
   │ 7 LogOutcome → DynamoDB  ──────────▶ feeds Self-Learning loop        │
   └─────────────────────────────────────────────────────────────────────┘

   ML: sklearn models trained in a SageMaker notebook on Dataset.csv,
       artifact saved to S3, loaded by the RankDonors Lambda.
   Self-learning: logged outcomes → (a) periodic model retrain,
       (b) appended to agent prompt context as "what worked / failed."
```

## 5. Components (each: purpose · interface · depends on)

- **React UI** — *purpose:* admin dashboard, donor chat, patient request form. *interface:*
  calls FastAPI REST. *depends on:* API Gateway URL. *(Claude writes all of it.)*
- **FastAPI service** — *purpose:* CRUD for requests/donors, chat endpoint, dashboard
  aggregations, triggers the Step Functions outreach. *interface:* REST/JSON. *depends on:*
  DynamoDB, Bedrock, Step Functions. *Runs on Lambda via Mangum.*
- **Matching + ML module** — *purpose:* score & rank donors for a request. *interface:*
  `rank_donors(request) -> [donor_id, score, reasons]`. *depends on:* model artifact in S3,
  blood-compatibility matrix, haversine geo.
- **Agent module (Bedrock)** — *purpose:* compose outreach, hold conversations with memory,
  interpret replies, translate. *interface:* `compose()`, `interpret(reply)`, `chat(user,msg)`.
  *depends on:* Bedrock Claude Haiku, Conversations table.
- **Outreach orchestrator (Step Functions)** — *purpose:* the autonomous loop. *interface:*
  started by FastAPI with a `requestId`. *depends on:* Lambdas, EventBridge, SES, SNS.
- **Data/seed scripts** — *purpose:* clean Dataset.csv → S3 → seed DynamoDB. *interface:* CLI.

## 6. Data model (DynamoDB, on-demand)

| Table | Key | Notable attributes |
|-------|-----|--------------------|
| `Users` | PK `userId` | role, blood_group, gender, lat, lng, donor_type, eligibility_status, next_eligible_date, donations_till_date, calls_to_donations_ratio, **willingness_score**, **churn_risk**, consent flags |
| `Bridges` | PK `bridgeId` | blood_group, quantity_required, frequency_in_days, expected_next_transfusion_date |
| `Requests` | PK `requestId` | bridgeId/patient, blood_group, needed_by, status (open/matched/fulfilled/escalated) |
| `Conversations` | PK `userId`, SK `ts` | role (user/assistant), text, lang — **this is the memory** |
| `Outcomes` | PK `requestId`, SK `donorId` | contacted_at, channel, reply, interpreted_label, result — **feeds learning** |

## 7. Machine-learning spec (the real-implementation proof)

Trained on `Dataset.csv` (7,033 rows) in a SageMaker notebook with pandas + scikit-learn.

- **Model A — Donation willingness / propensity** (classification): given donor features,
  predict likelihood of donating when contacted. Signal from `calls_to_donations_ratio`,
  `donated_earlier`, `donations_till_date`, `donor_type`, recency.
- **Model B — Inactivity / churn risk** (classification): predict `user_donation_active_status`
  = Inactive (label already present, plus `inactive_trigger_comment`).
- **Features:** blood_group, gender, donor_type, role, donations_till_date, cycle_of_donations,
  total_calls, frequency_in_days, calls_to_donations_ratio, days-since-last-donation,
  eligibility_status, + distance-to-patient (computed at rank time).
- **Serving:** model pickled → S3 → loaded once per Lambda cold start (no paid endpoint).

**Final ranking score** for a request =
`blood_compatible (hard filter) AND eligible_by_date (hard filter)` then weighted sum of
`willingness_score`, `geo_proximity`, `(1 − churn_risk)`, `recency`. Returns ranked donors
**with human-readable reasons** ("O+ match, 4 km away, 92% likely to respond").

## 8. AI agent & "failure learning"

- **Conversational memory:** every turn stored in `Conversations`; prior turns + a rolling
  summary are fed back into Bedrock so the agent "remembers" across interactions.
- **Multilingual:** agent detects and replies in the donor's language (English / Hindi /
  Telugu to start) via Bedrock.
- **Reply interpretation:** free-text donor replies → structured label
  (accept / decline / maybe / ask-later / question) → drives the Step Functions Choice state.
- **Self-improvement (failure learning):** outcomes (who accepted/declined and why) are logged
  and (a) re-fed as examples into the agent's prompt ("recent attempts that failed and why"),
  and (b) used to periodically retrain Model A. Demonstrates "systems self-manage improvement
  via failure learning."

## 9. Consent & responsible data

- Consent flags per user; the agent only contacts donors with `consent = true`.
- PII minimized in prompts (no raw IDs to the LLM; use display names/roles).
- All outreach + decisions logged to `Outcomes` = audit trail.
- Secrets via AWS Secrets Manager / env (already gitignored).

## 10. AWS services & cost plan (cap = $40, alert at $30)

| Service | Use | Est. cost |
|---|---|---|
| Amplify | host React UI | free tier |
| Lambda + API Gateway | FastAPI + agent lambdas | free tier |
| DynamoDB (on-demand) | all app data | free tier |
| Amazon Bedrock (Claude **Haiku**) | chat / interpret / translate | a few $ at most |
| SageMaker notebook | train sklearn models | ~$0.05/hr — **stop when idle** |
| S3 | dataset + model artifact | pennies |
| SES | real outreach email | free tier |
| Step Functions + EventBridge | outreach loop + timers | pennies |
| SNS | admin escalation | pennies |
| CloudWatch + **AWS Budgets** | logs + **$40 alarm set first 10 min** | free |

**Skipped (YAGNI for 7k static rows):** Glue, Kinesis, Redshift, Athena, EKS, Fargate,
WAF. Mentioned only as a "how this scales" slide. **Realistic total: < $10** if the
SageMaker notebook is stopped when not training.

## 11. Scope — in vs. out

**In (MVP we will demo):** request flow · donor chat w/ memory · ML ranking w/ reasons ·
autonomous outreach loop (rank→contact→interpret→follow-up→escalate) · outcome logging +
basic learning · admin dashboard · consent gate · deployed on AWS.

**Stretch (only if time):** real WhatsApp/SMS via a provider · live model retrain button ·
Cognito auth · Athena analytics tab · richer multilingual set.

**Out:** payments, full user management, mobile apps, anything not in the brief.

## 12. Mapping to evaluation criteria (5 × 20%)

| Criterion | How ThalNet scores |
|---|---|
| Ideation (practicality/scalability) | Serverless, real NGO problem, clear scale path |
| Innovation (uniqueness) | Autonomous agentic loop + predictive matching the current site lacks |
| Prototype (real, not just UI) | Working FastAPI + DynamoDB + Step Functions, live data |
| AI Component | Trained ML models **and** Bedrock agent w/ memory + failure learning |
| End-to-End Execution | Deployed on AWS (Amplify + Lambda), budget-guarded |

## 13. Risks & mitigations

- **Time (24h, 2 ppl):** thin platform + 2 deep spikes; Claude generates UI/infra.
- **AWS unfamiliarity:** serverless + copy-paste console steps + budget alarm Day-1.
- **Bedrock model access delay:** request Claude Haiku access in the first hour.
- **Frontend gap:** Claude owns React; team only wires API URL + deploys.

## 14. Proposed work split (team of 2)

- **Person A — Swaroop (backend + AI):** FastAPI, Bedrock agent module, Step Functions
  outreach, DynamoDB wiring.
- **Person B — teammate (data + ML + deploy):** dataset cleaning + seed scripts, SageMaker
  model training (Models A & B), AWS account/services setup, Amplify deploy.
- **Claude (me):** generates React UI, scaffolds FastAPI + Lambda handlers, writes the ML
  training notebook, Step Functions definition, and all glue code; keeps `PROGRESS.md` updated.

## 15. Rough timeline (mapped to the hackathon schedule)

| Window | Goal |
|---|---|
| Day 1, 11:00–13:00 | AWS setup + budget alarm + Bedrock access; repo scaffold; data cleaned |
| Day 1, 14:00–16:00 (Checkpoint 1) | DynamoDB seeded; FastAPI skeleton; ML model v1 trained |
| Day 1, 16:00–21:00 | Matching+ranking live; Bedrock chat w/ memory; React dashboard shell |
| Day 1, 21:00 – Day 2, 02:00 | Step Functions outreach loop end-to-end; reply interpretation |
| Day 2, 02:00–09:00 (Checkpoint 2) | Self-learning loop; consent gate; polish UI; deploy to AWS |
| Day 2, 09:00–11:00 | Dry-run demo, fix, **submit** |

---

*Next step after approval: I create `PROGRESS.md`, then we move to a step-by-step
implementation plan and start building.*
