# ThalNet — Progress & Work Log

Living document for **Team Distortion** (2 people). Update it whenever you start or finish
something so we both always know the state of play. Newest entries at the top of the log.

- **Project:** ThalNet — Autonomous Blood Bridge (see [`docs/DESIGN.md`](docs/DESIGN.md))
- **Hackathon:** AI4Good 2.0 (Blend360) · **AWS cap:** $40 (alert $30) · **Region:** us-east-1

---

## Current status

🟢 **Building LIVE — two halves merged into ONE system.** Vijetha's `optimizer/` + `project/`
(supply side) merged into branch `scaffold-and-design` alongside ThalNet (donor/coordination
side). **Direction = 2-layer system:** Layer 1 Supply Command Center (predict shortage + optimize
+ mobilization plan + dashboard, BUILT) → seam (`mobilization_plan.csv`) → Layer 2 ThalNet
autonomous coordination. **Real national e-RaktKosh data now in repo** (3,863 banks, 44,675 rows)
→ kills the "tiny dataset" weakness. **Blocker:** Bedrock Haiku access + AWS budget alarm not yet
confirmed — long pole.

## Locked scope (this session)
**Flagship = Auto-Bridge Builder** (8→1 bridge: auto-form + eligibility-stagger + self-heal +
integrity score). **Core = win = 3-agent loop:** 1) Triage (build/repair bridge + rank donors) ·
2) Outreach (Bedrock chat, multilingual, reply interpret, fatigue-aware cadence) · 3)
Escalate+Learn (cold batch → broaden/flag, log outcomes → reweight). Principle: **rank don't
filter + growth mode.** Donor view = Personal Donation Clock. Admin = India Resilience Heatmap.
**Proof pieces:** 4) ML notebook (Model A willingness + Model B churn on real 7k rows) · 5)
FastAPI + DynamoDB glue · 6) Step Functions wiring · 7) React shell (role-routed: admin
dashboard + donor inbox/chat + 1 honest patient status line).
**Role-routed UI:** login detects Patient / Donor / Admin → role-specific view.
**Cut / talk-only (don't build):** phenotype/HLA, cure progress bars, gamify, "overcame"
stories, IVR, payments, auth.
**Build order:** Claude starts #4 ML notebook (no AWS needed) → feeds Triage. Team requests
Bedrock Haiku + budget alarm in parallel. Then #5 FastAPI matching, then loop, then UI.

## Who's doing what

| Person | Area | Currently working on |
|--------|------|----------------------|
| **Swaroop** | Layer 2 Backend + AI (FastAPI, Bedrock agent, Step Functions, DynamoDB) | wire mobilization_plan → Triage; AWS/Bedrock status TBD |
| **Vijetha** | Layer 1 Supply (scraper + optimizer + dashboard) — **DONE** | next: ML models A&B + AWS deploy |
| **Claude** | UI, scaffolding, glue, keeps DESIGN/PROGRESS reconciled | React frontend built + bug-fixed; SupplyPage rewrite done; next: build verify + chatbot widget |

> **Env note:** Python 3.9.6 venv at `.venv/` (all deps installed). **node/npm + aws CLI NOT
> installed** on this machine → frontend + deploy blocked until installed (see daily log for cmds).

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
- [ ] Frontend bug sweep — SupplyPage.jsx needs rewrite to match api.js (in progress)
- [ ] Backend merge conflicts — admin.py has <<<<<<< HEAD markers (Swaroop's code, not touching yet)

### ✅ Done (this session, cont.)
- [x] 2026-06-06 — **Backend Route Refactoring (Production Grade)** — Reorganized 5 router domains (admin, donors, patients, agent, supply) into RBAC-ready architecture. Fixed path ambiguities, expanded admin.py with full CRUD (donors/patients/bridges), split public portals from management. Created API_ROUTES.md (500-line reference) + REFACTORING_CHANGELOG.md + VERIFICATION_REPORT.md. All 44 routes verified, FastAPI app initializes cleanly. Ready for auth middleware — _Claude_
- [x] 2026-06-06 — **Autonomous orchestrator** `backend/app/orchestrator.py` — 3-agent loop: triage→outreach→escalate→learn. Entry points: handle_transfusion_due (full cycle), handle_new_donor (auto-map to bridges), handle_emergency. Event log + request tracking — _Claude_
- [x] 2026-06-06 — **Outreach agent** `backend/app/outreach.py` — MockLLM + BedrockLLM adapters. Empathetic impact messages, thank-you with stats, clock nudge, reply interpretation (EN/HI/TE), failure learning log — _Claude_
- [x] 2026-06-06 — **Supply integration** `backend/app/supply.py` — reads optimizer blood_stock (44,675 rows) + blood_banks (3,863) + mobilization_plan. Patient map data: nearby compatible banks, regional supply, donor counts — _Claude_
- [x] 2026-06-06 — **Agent + supply routers** — 12 new endpoints (agent/*, supply/*). Total API: 31 endpoints, all tested — _Claude_
- [x] 2026-06-06 — #5 FastAPI routers — `patients.py` (list/detail/build-bridge/heal), `donors.py` (list/detail/clock/emergency-rank/register), `admin.py` (dashboard/churn-alerts/bridges). All 11 endpoints smoke-tested — _Claude_
- [x] 2026-06-06 — #7 `backend/app/matching.py` — 4-factor ranking (blood compat + eligibility + ML + geo), emergency mode, human-readable reasons. Smoke-tested on real data — _Claude_
- [x] 2026-06-06 — #8 `backend/app/bridge.py` — Auto-Bridge Builder (8→1), self-heal, integrity score (Full/At-risk/Broken), predictive bridge-break alarm, coverage calendar. Smoke-tested — _Claude_
- [x] 2026-06-06 — #4 Shared backend modules — `geo.py` (haversine) + `compat.py` (ABO+Rh normalize + compatibility matrix, handles 16 messy blood group strings) + `eligibility.py` (90-day window). All smoke-tested — _Claude_
- [x] 2026-06-06 — #3 `backend/app/store.py` — loads `clean.csv`, splits 84 patients / 4446 donors, attaches churn_risk + responsiveness from pkls, synth consent. Smoke-tested — _Claude_

### ✅ Done
- [x] 2026-06-06 — **#4 ML notebook** `notebooks/train_models.py` → `models/{churn,responsiveness}_model.pkl` + `metrics.json`. Caught + killed ROC=1.000 leakage. Honest CV: **churn 0.968 ROC / 0.714 PR / 0.94 recall**, responsiveness 0.865 (proxy). Artifact load+score smoke-tested — _Claude_
- [x] 2026-06-06 — Read all hackathon docs (problem, AWS guide, dataset, criteria) — _Claude_
- [x] 2026-06-06 — Reviewed live Blood Warriors site for gaps/opportunities — _Claude_
- [x] 2026-06-06 — Cloned repo, inspected structure — _Claude_
- [x] 2026-06-06 — Wrote `docs/DESIGN.md` (architecture, ML spec, cost plan, timeline) — _Claude_
- [x] 2026-06-06 — Re-checked critique (medical honesty, scope) vs DESIGN.md → already covered — _Claude_
- [x] 2026-06-06 — Mapped BW gaps → automation table; donor/patient POV needs — _Claude_
- [x] 2026-06-06 — Locked scope + build order; role-routed UI decided — _Claude_
- [x] 2026-06-06 — Scaffolded repo (backend/ notebooks/ scripts/ infra/ data/); Python venv + all deps installed — _Claude_
- [x] 2026-06-06 — FastAPI skeleton boots (`/`, `/health`) + Lambda handler (Mangum) wired — _Claude_
- [x] 2026-06-06 — `scripts/clean_data.py` → `data/clean.csv` (7033 rows, ML targets derived) — _Claude_
- [x] 2026-06-06 — Read Problem Statement.pdf; design validated 1:1 vs required capabilities + official stack — _Claude_
- [x] 2026-06-06 — Verified BW live site features (WebFetch + search); differentiator confirmed — _Claude_

---

## Decisions log
- **2026-06-06** — **Architecture locked: full React + AWS web app, 100% serverless.** Stack =
  Amplify + Lambda/API Gateway (Mangum) + DynamoDB + Bedrock **Haiku** + S3 + SES + Step
  Functions. Verified <$10 under the $40 cap (cost is service-choice, not app-vs-HTML). BANNED
  (bill while idle): EC2, RDS/Aurora, OpenSearch, Kinesis, SageMaker endpoint, NAT GW, WAF. ML
  served by loading `.pkl` *inside* Lambda = $0. **Cognito real login** (role claim → patient/
  donor/admin dashboard). **Local-first dev** (React Vite + FastAPI on localhost = $0), AWS
  deploy last so demo runs even if AWS slips. **Build order: Patient view end-to-end FIRST**,
  then clone Donor, then Admin. 22 phase-ordered tasks created (see TaskList).
- **2026-06-06** — Mapped our automations 1:1 to the 8 required capabilities (Problem Statement
  pg 4) — all covered. New automations to fold in: predictive bridge-break alarm (proactive
  self-heal), no-show buffer (2nd use of responsiveness model), fatigue/contact throttle.
- **2026-06-06** — **ML leakage fix (Models A & B).** First run gave ROC-AUC **1.000** = leakage,
  not success. Two leak types removed: (1) direct — `user_donation_active_status`,
  `inactive_trigger_comment`, `role_status`, `status`; (2) **circular/definitional** — churn
  recency cols (`days_since_last_donation`, `days_to_next_eligible`, `cycle_of_donations`) restate
  the Inactive label, and donation-count/`donor_type` tautologically define `target_willing`.
  Final feature sets: **churn** = donor_type + eligibility + blood_group + gender + donations +
  calls + freq + calls_to_donations_ratio (CV ROC 0.968); **responsiveness** = eligibility +
  blood_group + gender + total_calls + freq + days_since_last_contact (CV ROC 0.865, framed as
  proxy). Reported via 5-fold CV, not a single split. Headline = churn only.
- **2026-06-06** — Direction: build the **full platform thin + 2 deep AI spikes** (ML matching
  + autonomous agent), not one narrow slice.
- **2026-06-06** — Stack: React (Amplify) · FastAPI on Lambda+API Gateway · DynamoDB · Bedrock
  Claude Haiku · sklearn via SageMaker notebook · Step Functions outreach. Serverless-first
  to stay well under $40.
- **2026-06-06** — Outreach channel: **simulated in-app WhatsApp/SMS + real email via SES**
  (no paid Twilio/WhatsApp for the demo).
- **2026-06-06** — Skipping Glue/Kinesis/Redshift/Athena/EKS/Fargate (overkill for 7k rows);
  keep as "scale path" talking point.
- **2026-06-06** — Differentiator sharpened: BW already has voice chatbot + carrier dashboard,
  so we win on the **autonomous 3-agent coordination + self-learning** (Triage / Outreach /
  Escalation+Learning), not on "a chatbot."
- **2026-06-06** — Medical honesty rule: thalassemia is lifelong → **no cure progress bars /
  gamification**. Patient view = honest ops status only.
- **2026-06-06** — Phenotype/HLA compatibility = **scale-path only** (no hospital EMR API in
  India). We match on ABO+Rh + geo + ML.
- **2026-06-06** — **Read actual Problem Statement.pdf.** Design maps 1:1 to all 8 required
  capabilities (pg 4). Authorized AWS list (pg 6) + official Recommended Stack (pg 7) confirm
  React + FastAPI + SageMaker + Bedrock + Step Functions/Lambda/API GW = exact match.
- **2026-06-06** — **Stack deviation (deliberate):** official deck recommends deploy on **EC2 +
  CloudWatch**; we use **Amplify + Lambda (serverless)** — both authorized, ours ≈ $0 idle to
  protect the $40 cap. Call this out on the slide as a cost choice.
- **2026-06-06** — Budget is **soft** ($30 warn, $40 second warn, asked to downgrade), not a
  hard kill. Schedule: kick-off 11:00 D1 · CP1 16:00 · CP2 09:00 D2 · **submit 11:00 D2**.
- **2026-06-06** — **Verified BW live site.** Their AI chatbot (REAN Foundation) = WhatsApp
  scheduling + reminders only. No ML targeting / autonomous loop / failure-learning → confirms
  our differentiator. WhatsApp is their real channel (our simulated-WhatsApp demo is realistic).
  Carrier screening already exists → correctly cut.

## Daily log (newest first)
### 2026-06-07
- **✅ Donor↔Patient Connection System (Blood Warriors Community Hub flagship, Feature 1) — backend built** — `/community/*` endpoints (requests, requests/{id}, matches, connections, respond, cancel, messages). Writable in-memory `community_store.py` (blood requests / connection handshakes / private messages) behind a DynamoDB-ready function seam. Mutual-accept handshake: patient creates blood request → sees compatible donors (blood-compat + eligibility annotation + distance) → sends connection → donor accepts → private chat opens. Privacy guard enforced in store: messaging only on accepted connections, only the two participants; read history survives cancel. Typed store exceptions mapped to HTTP (404/403/409/400). All 4 smoke tests pass (test_community_store, test_connections_endpoint, test_chatbot, test_chat_endpoint). Next: Community Feed (own spec→plan cycle). — _Claude_
- **✅ React frontend built + bug-fixed** — Full production React 19 + Vite 8 + Tailwind v4 UI. Role-routed (admin/donor/patient) without auth. 10 components: LandingPage, AdminDashboard, BridgesPage, AgentsPage, SupplyPage, DonorPortal, PatientPortal, Navbar, StatusBadge, api.js (14 API functions). Fixed 6 data-shape bugs: StatusBadge case normalization, bridge_health at_risk/at-risk dual key, division-by-zero guard, donor_count vs size field, case-insensitive integrity colors, dead code removal from api.js. Vite proxy to :8000 backend. Pushed to main. — _Claude_
- **🔧 SupplyPage rewrite** — Rewrote to use getSupplyOverview + getChurnAlerts + getUrgentAlerts. Tabbed UI (supply/alerts), national KPIs, shortage cards (critical/low), churn risk table, urgent transfusion list. Still needs build verification. — _Claude_
- **⚠️ Known issues:** Backend admin.py has unresolved merge conflict markers (Swaroop's code). Backend main.py missing agent router import. Not touching teammate's files per agreement. — _Claude_
- **✅ Wellness suggestions added to chatbot** — new `wellness` intent + `_wellness` handler in `services/chatbot.py`. Curated cited CSV (`data/wellness_suggestions.csv`, 14 rows) covers diet / hydration & daily habits / emotional wellbeing sourced from authoritative orgs (TIF, Cooley's Anemia Foundation, NHS, NHS Give Blood, Blood Warriors) — not Reddit, no model fine-tuning. Patient-vs-donor audience filtering guards the iron-overload trap: patient role gets an iron caution in `grounded_facts.caution`, donor gets `caution: null`. Always-on "not medical advice — check with your hematologist" disclaimer enforced in code. All 6 chatbot smoke tests pass (test_voice, test_knowledge, test_wellness, test_outreach_chat, test_chatbot, test_chat_endpoint). — _Claude_
- **✅ Website chatbot built** — intent-router + 5 grounded handlers (personal_eligibility, bridge_status, stock_lookup, general_faq, fallback), multilingual EN/HI/TE, mock-first ($0) with Bedrock switchable, shared empathy/voice layer, curated cite-able FAQ (`services/knowledge.py`). Grounded only on Dataset.csv + scraped e-RaktKosh data; read-only; role-gated (no data leaks); no fabricated stats. All 5 chatbot smoke tests pass; `POST /chat` live and returning correct `intent`, `grounded_facts`, and `sources`. Also fixed: app boot wiring (real supply router registered). — _Claude_
- **Next:** Part B — harden autonomous outreach loop (real-reply endpoint, follow-ups, fatigue cadence, closed learning loop, register agent router). See `docs/superpowers/specs/2026-06-07-chatbot-and-outreach-design.md`. — _Claude_

### 2026-06-06 (continued)
- **✅ COMPLETED: Backend Route Refactoring to Production Grade** — Reorganized all 5 router domains from mixed-concern structure to **RBAC-ready architecture**. Split public portals (patients/, donors/) from admin management (/admin/*). Fixed path ambiguities (POST /donors/rank/emergency → /donors/rank-emergency). Expanded admin.py with full CRUD for donors/patients/bridges. Added pagination, type-safe schemas (Pydantic), comprehensive error handling. Created API_ROUTES.md (500-line reference), REFACTORING_CHANGELOG.md, VERIFICATION_REPORT.md. All 44 routes verified, no syntax errors, FastAPI app initializes cleanly. **Status: Ready for auth middleware + integration tests.** — _Claude_

### 2026-06-06
- **Built autonomous 3-agent orchestrator** — full triage→outreach→escalate→learn cycle. Handles: transfusion due (auto-build bridge + contact donors), new donor registration (auto-find compatible patients + welcome), emergency (fast rank + outreach). Event log + failure learning feedback loop.
- **Built outreach agent** — dual adapter (MockLLM for $0 dev, BedrockLLM for prod). Composes empathetic messages with donor impact stats, interprets free-text replies in EN/HI/TE, sends thank-you with leaderboard link + next eligibility, proactive clock nudge. Failure learning: tracks accept rate + decline reasons → feeds back into agent prompts.
- **Built supply integration** — bridges Layer 1 optimizer into Layer 2. Reads real e-RaktKosh data (44,675 stock rows, 3,863 banks). Patient map: 96 compatible banks within 50km of Hyderabad for O+, 8,736 units in Telangana. Mobilization queue reads the seam CSV.
- **31 total API endpoints** — all tested. New: agent/* (transfusion-due, new-donor, emergency, events, learning, requests, outcomes) + supply/* (banks, regional, patient-map, mobilization).
- **Built FastAPI routers** — 3 router files (patients/donors/admin), 11 endpoints total. All pass integration test via TestClient. Includes: bridge build+heal, donation clock, emergency ranking, donor registration (dynamic pool growth), admin dashboard aggregation, churn alerts with fatigue-aware cadence actions (contact-now/wait/appreciate/DND).
- **Built matching.py** — 4-factor donor ranking engine (blood compat hard filter + 90-day eligibility hard filter + ML scores + geo proximity). Emergency mode for ad-hoc requests. Human-readable reasons per donor.
- **Built bridge.py** — Auto-Bridge Builder flagship. 8→1 bridge formation with coverage calendar, integrity scoring (Full/At-risk/Broken), self-heal (auto-replace churned donors), predictive bridge-break alarm (flags when ≥2 donors show high churn), no-show risk detection.
- **Built shared modules** — geo.py (haversine), compat.py (ABO+Rh compatibility matrix, normalizes 16 messy blood group strings including A1/A2/A1B/A2B/Bombay), eligibility.py (90-day donation window). All smoke-tested against real clean.csv data.
- **Built #4 ML notebook** (`notebooks/train_models.py`). First pass scored ROC-AUC 1.000 on
  BOTH models → stopped, treated as leakage red flag (not a win). Diagnosed: churn recency cols
  *define* the Inactive label (circular), and `target_willing`=ever-donated is tautological with
  donation-count/donor_type features. Rebuilt with principled feature sets + 5-fold CV. Honest
  numbers: churn 0.968 ROC / 0.94 Inactive-recall (strong, real); responsiveness 0.865 (proxy,
  caveated). Saved `models/{churn,responsiveness}_model.pkl` + `metrics.json`; smoke-tested the
  artifact load+score path the RankDonors Lambda will use.
- Brainstormed direction with Claude; chose ThalNet full-platform approach.
- Design doc + this tracker created. Pending team approval to start building.
- Refined idea after competitive/medical review: adopted 3-agent framing, dropped
  cure-framing, moved phenotype compat to scale-path. Design doc updated.
- Hackathon live. Re-validated pasted critique against DESIGN.md — already covered.
- Built BW-gap → automation table; donor & patient POV needs. Locked scope + build order.
- Decided role-routed UI (Patient/Donor/Admin). Claude to start ML notebook next.
- Swaroop: keep PROGRESS.md updated every chat going forward.
- Read real Problem Statement.pdf → design maps 1:1 to all 8 required capabilities + official
  stack. Noted deliberate serverless deviation from recommended EC2.
- Verified live BW site (WebFetch+search): chatbot = WhatsApp/REAN, scheduling+reminders only.
- Reconciled DESIGN.md: corrected BW chatbot description, status → building, added deviation note.
- Deep BW audit (about/impact/REAN): their data/dashboard is all PREVENTION (carrier screening,
  3445 tests, 7.3% carriers). Donor-ops side = no automation/dashboard/prediction → wide open.
- **Verified 8→1 Blood Bridge is REAL** (BW's own model: 8–10 donors/patient, every 15–20 days,
  58 patients/579 volunteers). Manual-pain real (Problem Statement pg 2); churn real (in dataset).
  HPLC-silo + antigen-tracking = unverified hypotheses → questions for BW insider.
- **Wrote `docs/CONTEXT.md`** — self-contained handoff to start a fresh chat clean.
- **Pushed all to `main`** (fast-forward 30736f7..4430e9b); main == branch, full picture.
- **Merged Vijetha's `optimizer/` + `project/` into `scaffold-and-design`** (was a stuck/empty
  merge w/ MERGE_HEAD; aborted + clean re-merge — disjoint files, no real conflict). Backed up
  DESIGN.md first; session edits intact.
- **Unified direction = 2-layer system** (Supply Command Center → seam mobilization_plan →
  ThalNet coordination). Folded into DESIGN.md §2/§5/§14. Dropped our duplicate "resilience
  heatmap" (Vijetha's dashboard.html already is it). Real national e-RaktKosh data now available.
- Folded paste's new medical context into DESIGN.md: alloimmunization-aware antigen ranking
  (Kell/Duffy/Kidd/MNS, synthetic for demo), HPLC→donor pipeline, 90-day eligibility, budget tactics.
- Reviewed 12-idea bank vs data reality. Folded winners into DESIGN.md:
  **Auto-Bridge Builder + Self-Healing = flagship** (8→1 bridge automation, eligibility-stagger,
  integrity score); Personal Donation Clock (donor); Fatigue-aware cadence (Model B → action);
  India Resilience Heatmap (admin); Carrier Cascade (stretch). Added rank-don't-filter + growth
  mode principle. Reframed Model A → "donor responsiveness score" (honest). Skipped graph/
  marketplace/DLV (data too thin / scope risk) → scale-path slide.
- **Dataset audit (EDA).** Verdict: useful w/ caveats. Model B (churn) = strong/trainable
  (Inactive 682/7033; real signal by donor_type 22%/7%/0.15%, eligibility 18%/9%). Model A
  (willingness) = WEAK — no true "contacted→donated" outcome → reframe as "donor responsiveness
  score" (proxy), be transparent. Fix clean script: drop dead cols `role_status`,`status`;
  EXCLUDE leakage col `inactive_trigger_comment` from churn features. Missingness high
  (gender 59%, blood_group 27%+16 messy cats, donations 76%). Geo coarse (132 unique pts).
  Only 84 patients / 80 bridges → synthesize request scenarios for demo.

---

## How to update this file
1. Move your task from **To do** → **In progress** → **Done** (add date + your name).
2. Add a one-line note in the **Daily log**.
3. Record any non-obvious choice in the **Decisions log**.
4. Keep the **Who's doing what** table current so we don't collide.
