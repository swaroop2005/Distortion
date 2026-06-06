# ThalNet — Autonomous Blood Bridge for Blood Warriors

**Hackathon:** AI4Good 2.0 (Blend360) · **Team:** Distortion (2 people) · **Date:** 2026-06-06
**Status:** 🟢 Approved — building. Validated against Problem Statement.pdf (required
capabilities + authorized AWS + recommended stack) and the live Blood Warriors site.

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
entire brief) with **three deep AI spikes** where judges reward depth most:

1. **Auto-Bridge Builder (flagship)** — automates the "8→1" Blood Bridge: for each patient
   it assembles and *maintains* a balanced squad of 8–10 donors that is blood-compatible,
   geographically spread, and **eligibility-staggered so someone is always eligible** every
   15–20 days. When a donor goes inactive or moves, the bridge **self-heals** by auto-recruiting
   a replacement. This is the thing Blood Warriors does entirely by hand today.
2. **Smart Matching & Prediction engine** (real ML on the provided 7,033-row dataset) — ranks
   donors and powers bridge assembly, donor-fatigue cadence, and the resilience map.
3. **Autonomous agentic outreach loop** (Bedrock + Step Functions) that contacts ranked
   donors, interprets their replies, follows up, escalates, and **learns from outcomes**.

Everything else (patient request flow, donor chat, admin dashboard, consent, memory) is
real but intentionally thin, so the demo *feels* like a complete product end-to-end.

### Headline features folded in (all powered by the same backbone)
- **Auto-Bridge Builder + Self-Healing Bridge** (spike 1) — autonomous 8→1 bridge formation,
  eligibility-stagger optimization, and auto-repair when a donor churns. **Bridge Integrity
  Score** (Full / At-risk / Broken + reason) surfaces health live.
- **Personal Donation Clock** (donor view) — proactive: "You're eligible in 12 days; a patient
  4 km away (O+) needs you on the 18th — reserve your slot?" Flips the chatbot from reactive
  to anticipatory.
- **Fatigue-Aware Cadence** — Model B (churn) doesn't just score risk, it picks the *action*:
  **contact now / wait / send appreciation / do-not-disturb** — so outreach scales without
  burning donors out.
- **India Resilience Heatmap** (admin) — per region × blood group, a resilience score
  (active donors vs demand) → "Hyderabad O+ 82/100, Nagpur 46/100." The supply-ops dashboard
  BW does not have. Optional **shortage-forecast** tile (labeled an estimate — patient data is thin).
- **Carrier Cascade** (prevention, stretch) — a positive carrier result auto-triggers
  multilingual nudges to screen at-risk family. One test → a family screened. Serves the
  "Thalassemia-Free India 2035" mission.

### What Blood Warriors already has → our differentiator
The live site already has: emergency request listings, blood-stock search, donor
leaderboard, registration, a dashboard, a **WhatsApp-based AI Blood Bridge chatbot** (built
with REAN Foundation — does scheduling + reminders + progress tracking), and **carrier
screening** ("Know Your Risk"). So "a chatbot" or "show community data" is **not** new — and
their chatbot is **scripted scheduling on WhatsApp**, not autonomous. Our edge is the thing they do
**not** have: an **autonomous multi-agent coordination backbone** that ranks → reaches out
→ interprets replies → follows up → escalates → **learns from failure**, with no human in
the loop until escalation. We win on the *operations* problem (donors going cold,
coordinators manually chasing 100+ donors per emergency), not on UI.

### Modeled as 3 agents (one unified AI layer, Step Functions orchestrated)
- **Triage Agent** — ingests a request *or* a patient needing a bridge; **builds/repairs the
  8→1 bridge** and produces a ranked donor shortlist (ML + matching + eligibility-stagger).
- **Outreach Agent** — conversational, multilingual contact; interprets free-text replies
  ("travelling this week" → reschedule; "in Chennai" → deprioritize; "yes" → confirm). Uses
  **fatigue-aware cadence** to decide contact now / wait / appreciate / DND per donor.
- **Escalation + Learning Agent** — watches response rates; if a batch goes cold, broadens
  the pool / alternate channel / flags a coordinator; logs what worked → updates matching
  weights and the resilience map. **This self-learning is the bullet most teams skip = our differentiator.**

### Core principle: rank, don't filter (+ growth mode)
Prediction decides the **order and the message**, never *who is allowed in*. Two modes:
- **Emergency mode** — most-likely-to-respond-fast contacted first (speed = life); the loop
  falls through the whole list if needed, so nobody is permanently excluded.
- **Growth / re-engagement mode** — deliberately reaches **cold, new, and going-inactive**
  donors (driven by Model B) to *expand and retain* the pool. Every batch also includes a
  slice of "long-shot" donors → keeps the pool growing **and** feeds failure-learning so the
  model improves. The AI does not shrink outreach — it makes outreach scale.

### Medical honesty (non-negotiable)
Thalassemia is a **lifelong** management condition (500–700 transfusions/lifetime); it is
**not** "beaten" by donation count. **No cure progress bars, no gamifying a child's illness.**
Patient-facing view = honest operational transparency only ("3 donors contacted, 1
confirmed; next transfusion due in 4 days"). Phenotype/HLA compatibility (Kell/Duffy/Kidd)
is medically real but needs hospital EMR data that has **no open API in India** — so it is a
**scale-path talking point**, not something we build. We match on ABO+Rh + geo + ML.

### Design principle
> Build the **full platform thin**, then make the **AI core deep**. Serverless-first so
> idle cost ≈ $0. I (Claude) generate the React UI and most infra; the team owns Python,
> ML, and AWS wiring.

## 3. Users / roles

| Role | What they do in ThalNet |
|------|--------------------------|
| **Patient / Bridge** | Raises a request; sees honest ops status only (donors contacted/confirmed, **bridge integrity**, next transfusion due). No cure framing. |
| **Donor** | **Personal Donation Clock** (when am I eligible, who near me needs me, reserve a slot); receives fatigue-aware outreach, chats with the multilingual assistant, accepts/declines. |
| **Admin (Blood Warriors staff)** | Watches live requests, **bridge health board**, donor-pool/fatigue health, **India resilience heatmap**, predictions, and escalations on a dashboard. |
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
   ┌────────── AWS Step Functions: 3-Agent Coordination Loop ────────────┐
   │ [TRIAGE]  1 RankDonors (Lambda → ML model + matching rules)          │
   │ [OUTREACH]2 ContactDonor (Bedrock writes msg → SES email + inbox)    │
   │           3 Wait (EventBridge timer)                                 │
   │           4 InterpretReply (Bedrock: accept/decline/maybe/question)  │
   │           5 Choice → accepted? confirm & stop : next donor           │
   │ [ESCALATE 6 batch cold? broaden pool / alt channel / SNS to admin    │
   │  +LEARN]  7 LogOutcome → DynamoDB ──▶ update match weights + prompts │
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
- **Bridge module (Auto-Bridge Builder)** — *purpose:* assemble & maintain the 8→1 bridge.
  *interface:* `build_bridge(patient) -> [donor_ids, coverage_calendar, integrity_score]`,
  `heal_bridge(bridgeId) -> [replacement_donor_ids]`. *logic:* hard filter (blood-compat +
  eligible) → pick donors whose `next_eligible_date`s **stagger** across the cycle so coverage
  is continuous → on churn/move, recompute and recruit replacements. *depends on:* Matching+ML
  module, Bridges table.
- **Resilience module** — *purpose:* region × blood-group supply health for the admin heatmap.
  *interface:* `resilience_scores() -> [{region, blood_group, score, watch_in_days}]`.
  *depends on:* Users (geo, active status, churn_risk).
- **Agent module (Bedrock)** — *purpose:* compose outreach, hold conversations with memory,
  interpret replies, translate. *interface:* `compose()`, `interpret(reply)`, `chat(user,msg)`.
  *depends on:* Bedrock Claude Haiku, Conversations table.
- **Outreach orchestrator (Step Functions)** — *purpose:* the autonomous loop. *interface:*
  started by FastAPI with a `requestId`. *depends on:* Lambdas, EventBridge, SES, SNS.
- **Data/seed scripts** — *purpose:* clean Dataset.csv → S3 → seed DynamoDB. *interface:* CLI.

## 6. Data model (DynamoDB, on-demand)

| Table | Key | Notable attributes |
|-------|-----|--------------------|
| `Users` | PK `userId` | role, blood_group, gender, lat, lng, donor_type, eligibility_status, next_eligible_date, donations_till_date, calls_to_donations_ratio, **responsiveness_score**, **churn_risk**, consent flags |
| `Bridges` | PK `bridgeId` | patientId, blood_group, quantity_required, frequency_in_days, expected_next_transfusion_date, **donor_ids[]**, **coverage_calendar**, **integrity_score** (Full/At-risk/Broken) |
| `Requests` | PK `requestId` | bridgeId/patient, blood_group, needed_by, status (open/matched/fulfilled/escalated) |
| `Conversations` | PK `userId`, SK `ts` | role (user/assistant), text, lang — **this is the memory** |
| `Outcomes` | PK `requestId`, SK `donorId` | contacted_at, channel, reply, interpreted_label, result — **feeds learning** |

## 7. Machine-learning spec (the real-implementation proof)

Trained on `Dataset.csv` (7,033 rows) in a SageMaker notebook with pandas + scikit-learn.

> **Data-audit reality (EDA on the real file, see PROGRESS):** Model B is the strong model;
> Model A has no true "contacted → donated" label so it is framed honestly as a *score*, not an
> oracle. Drop dead columns (`role_status`, `status`, all-one-value). **Exclude
> `inactive_trigger_comment` from Model B — it only exists for inactive rows = target leakage.**

- **Model A — Donor Responsiveness Score** (classification *proxy*, framed honestly): estimates
  how responsive/active a donor profile is. No real per-request "yes/no" outcome exists in the
  data, so this is an **estimate**, not a willingness oracle. Signal from `calls_to_donations_ratio`,
  `donations_till_date`, `donor_type`, recency.
- **Model B — Inactivity / churn risk** (classification): predict `user_donation_active_status`
  = Inactive. **Strong, verified signal** (One-Time 22% vs Regular 7% vs Other 0.15%; not-eligible
  18% vs eligible 9%). Drives the **fatigue-aware cadence** action (contact / wait / appreciate / DND).
- **Features:** blood_group, gender, donor_type, role, donations_till_date, cycle_of_donations,
  total_calls, frequency_in_days, calls_to_donations_ratio, days-since-last-donation,
  eligibility_status, + distance-to-patient (computed at rank time). **Excluded:** `inactive_trigger_comment` (leakage), `role_status`/`status` (no variance).
- **Serving:** model pickled → S3 → loaded once per Lambda cold start (no paid endpoint).

**Final ranking score** for a request =
`blood_compatible (hard filter) AND eligible_by_date (hard filter)` then weighted sum of
`responsiveness_score`, `geo_proximity`, `(1 − churn_risk)`, `recency`. Returns ranked donors
**with human-readable reasons** ("O+ match, 4 km away, responsive profile"). Note: geo is coarse
(~132 unique points) so it breaks ties more than it dominates.

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

**Deliberate deviation from the recommended deck:** the official Recommended Stack (Problem
Statement pg 7) suggests deploying on **EC2 + CloudWatch**. We instead use **Amplify + Lambda
(serverless)** — both are authorized services (pg 6). Rationale: serverless idle cost ≈ $0,
which protects the $40 cap and demonstrates the cost/scale awareness the brief asks for. We
call this out on the architecture slide as a conscious choice, not an oversight.

## 11. Scope — in vs. out

**In (MVP we will demo):** **Auto-Bridge Builder + Self-Healing (flagship)** · **Personal
Donation Clock** (donor) · **Fatigue-aware cadence** · **India Resilience Heatmap** (admin) ·
request flow · donor chat w/ memory · ML ranking w/ reasons (responsiveness + churn) ·
autonomous outreach loop (rank→contact→interpret→follow-up→escalate, **rank-don't-filter +
growth mode**) · outcome logging + learning · consent gate · deployed on AWS.

**Stretch (only if time):** **Carrier Cascade** (prevention) · shortage-forecast tile ·
"what-if" resilience simulator · honest reliability streaks · real WhatsApp/SMS via a provider ·
live model retrain button · Cognito auth · richer multilingual set.

**Out / scale-path-only:** phenotype/HLA compatibility (no hospital EMR API in India) ·
graph/social-network science · marketplace · donor-lifetime-value · cure progress bars /
gamifying illness (medically wrong) · payments · full user management · mobile apps.

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

*Status: `PROGRESS.md` is live and updated each working session. Repo scaffolded, Python
stack installed, data cleaned. Next build = ML notebook (Models A + B) → matching engine →
agent → Step Functions loop → React shell.*
