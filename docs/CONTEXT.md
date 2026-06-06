# ThalNet — Context Handoff (paste/point a fresh chat here)

> Self-contained brain dump so a new session continues with zero ramp-up.
> Pairs with [`DESIGN.md`](DESIGN.md) (full spec) + [`../PROGRESS.md`](../PROGRESS.md) (live log).
> **Standing rule: update PROGRESS.md every chat.** Date anchor: hackathon is 2026-06-06, LIVE.

## 1. One-line
**ThalNet** = autonomous AI blood-support network for **Blood Warriors** (Hyderabad NGO,
thalassemia patients ↔ voluntary donors). Hackathon: **AI For Good 2.0 (Blend360)**, team
**Distortion** (Swaroop = backend/AI, Vijetha = data/supply, Claude = UI/scaffold/glue/docs).

## 2. The system = ONE product, TWO layers (joined by one file)
```
LAYER 1 — SUPPLY COMMAND CENTER   (Vijetha · project/ + optimizer/)   [BUILT]
  real e-RaktKosh national data (3,863 banks, 44,675 rows, 1.07M units)
  → predict shortage → optimize: redistribution MILP (bank→bank)
  + MOBILIZATION PLAN (which donors) → dashboard.html (admin)
                    │  data/optimizer/mobilization_plan.csv   ← THE SEAM
                    ▼  (region, district, blood_group, donor_id, units)
LAYER 2 — AUTONOMOUS COORDINATION (Swaroop+Claude · backend/ ThalNet)  [scaffold]
  Triage (rank + Auto-Bridge Builder + antigen/geo/ML)
  → Outreach (Bedrock multilingual, reply-interpret, fatigue cadence)
  → Escalate+Learn (failure learning)
```
**Tagline:** Predict & Optimize → Coordinate & Learn.
**The seam is the demo spine:** wire `mobilization_plan.csv` → Triage `rank_donors`.

## 3. VERIFIED facts (grounded, cite-able)
- **Blood Bridge = 8–10 donors per 1 patient, transfusion every 15–20 days.** REAL, BW's own
  model. Currently 58 patients / 579 volunteers. (sources below)
- **Manual coordination doesn't scale** — stated verbatim in official `Problem Statement.pdf` pg 2.
- **Donor churn is real in the data** — 682 inactive; trigger comments "Not donated in last 1
  year", "Very limited activity despite multiple calls".
- **BW already has** (don't rebuild): emergency requests, blood-stock search, leaderboard,
  registration, **WhatsApp AI chatbot** (REAN Foundation — scheduling+reminders only, scripted),
  **carrier-screening dashboard** (HPLC). Their dashboard/data = PREVENTION side; donor-OPS side
  has NO automation/dashboard/prediction = our lane.

## 4. OPEN questions for the BW insider (confirm, don't assume)
- ⚠️ **HPLC silo** (hypothesis, unverified): are HPLC-negative screened people auto-invited as
  donors, or are screening-registry and donor-list separate? (our "HPLC→donor pipeline" feature)
- ⚠️ Does BW track **extended antigens** (Kell/Duffy/Kidd) / phenotype / alloimmunization?
- How is a bridge formed today (who, what rules)? How often does it break? Replacement time?
- Per emergency: # donors contacted, % reply, time taken? Main failure mode?
- Can we get **sample anonymized** bridge/response/contact data?
- Consent capture? Which regional languages matter most? 90-day eligibility tracked?

## 5. Dataset reality (audited — `Dataset.csv` 7033 rows → `data/clean.csv`)
- **Model B (churn) = STRONG** (signal by donor_type 22%/7%/0.15%, eligibility 18%/9%).
- **Model A (willingness) = WEAK** → reframed honestly as **"donor responsiveness score"** (no
  true contacted→donated label exists).
- **Drop** dead cols `role_status`,`status`. **EXCLUDE** `inactive_trigger_comment` from churn =
  **target leakage**. Missingness high (gender 59%, blood_group 27%). Geo coarse (132 pts).
  Only 84 patients / 80 bridges in sample → synthesize requests for demo.
- **NEW real data:** `data/blood_stock_long.csv` + `data/blood_banks.csv` = national e-RaktKosh
  supply (Vijetha's scraper) → kills the "tiny dataset" weakness.

## 6. Flagship + differentiators
- **Flagship = Auto-Bridge Builder** (auto-form 8→1 + eligibility-stagger + **self-heal** on churn).
- **Failure-learning loop** (outcomes → matching weights) — the rare bullet.
- **Alloimmunization-aware ranking** — antigen schema (Kell/Duffy/Kidd/MNS) + 90-day eligibility;
  schema+logic real, **synthetic antigen values for demo** (no hospital EMR API in India).
- **HPLC→donor pipeline** (pending verification), **multilingual Bedrock outreach**,
  **Personal Donation Clock** (donor proactive), **rank-don't-filter + growth mode**.
- **Medical honesty:** thalassemia lifelong, NOT curable by donations. No cure bars, no gamifying
  a child's illness. Gamify donor reliability, never patient disease.

## 7. Tech stack (matches official Recommended Stack)
React (Vite) · FastAPI on Lambda+API Gateway (Mangum) · DynamoDB · **Bedrock Claude Haiku** ·
sklearn via SageMaker notebook · Step Functions + EventBridge + SES + SNS · S3 · Amplify.
Optimizer core = stdlib-only (+ optional PuLP). **Deviation:** deck recommends EC2; we use
serverless (≈$0 idle, protects $40 cap) — call it a cost choice.
**Budget tactics:** cache Bedrock · Haiku for classify · big model only free-form · mock Kinesis.

## 8. Repo state (branch `scaffold-and-design` == `main`, all pushed, HEAD 4430e9b)
```
backend/app/main.py     FastAPI skeleton (/, /health) + Mangum — BOOTS
backend/requirements.txt deps installed in .venv/ (Python 3.9.6)
scripts/clean_data.py    -> data/clean.csv
optimizer/               Vijetha: demand/supply/gap/redistribution(MILP)/mobilization/dashboard
project/                 Vijetha: e-RaktKosh scraper
data/                    clean.csv, blood_stock_long.csv, blood_banks.csv, optimizer/*.csv, dashboard.html
docs/DESIGN.md           full spec (2-layer)   docs/CONTEXT.md  this file
private/                 DEVLOG.md + specs (tracked; repo is private)
PROGRESS.md              live work log
notebooks/ infra/        empty — next
```
Remote: https://github.com/swaroop2005/Distortion

## 9. Blockers / env gaps
- **node/npm NOT installed** → React blocked (install nodejs.org LTS).
- **aws CLI NOT installed** → deploy/seed blocked.
- **Bedrock Haiku access + $40 Budget alarm** = team console action, **NOT confirmed** = LONG POLE.
- git commits tagged "Vijetha Medi" on this laptop even for Swaroop → set `git config user.*`.

## 10. NEXT STEP (pick one)
- **A) #4 ML notebook** (`notebooks/train_models.py`): Model B churn (exclude leakage) + Model A
  responsiveness on `data/clean.csv`, save `.pkl`. No AWS needed.
- **B) The seam:** read `data/optimizer/mobilization_plan.csv` → `backend/app/matching.py`
  `rank_donors()` → fastest end-to-end proof.
- **C)** Fold BW insider's answers once collected.

## Sources (8→1 verification)
- https://bloodwarriors.in/home · https://www.bloodwarriors.in/about
- https://svpindia.org/investees/blood-warriors/
- REAN chatbot: https://www.reanfoundation.org/thalassemia-assistant/
