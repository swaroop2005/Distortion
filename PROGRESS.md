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
| **Claude** | UI, scaffolding, glue, keeps DESIGN/PROGRESS reconciled | merged halves; reconciled docs → ML notebook #4 |

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
- [ ] ML notebook #4 — Model A (willingness) + Model B (churn) on `data/clean.csv` — _Claude (next)_

### ✅ Done
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
### 2026-06-06
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
