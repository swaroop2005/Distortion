# Blend Hackathon — Private Engineering DEVLOG

> PRIVATE — gitignored, do NOT push. Running chronological log of the Blood Warriors
> build: decisions, architecture, design choices, errors hit, and how we resolved them.
> Swaroop's copy; friend keeps a parallel copy — reconcile later. Append-only.

---

## 2026-06-06

### Session start — context gathering
- **What:** Picked the project back up. Repo was scaffolding only (PDFs + `Dataset.csv` + README, single "Initial commit").
- **Read the brief** (`Problem Statement.pdf`): Blood Warriors wants an autonomous, AI-powered blood-support network connecting voluntary donors with Thalassemia patients. Required capabilities: unified AI layer, automated outreach/follow-ups/escalations, response tracking, real-time event reaction, conversational interactions *with memory*, self-improvement via failure learning, admin dashboards, consent-aware/compliant data use.
- **Inspected the dataset:** `Dataset.csv`, ~7,034 rows. Columns: `user_id, bridge_id, role, role_status, bridge_status, blood_group, gender, latitude, longitude, bridge_gender, bridge_blood_group, quantity_required, last_transfusion_date, expected_next_transfusion_date, registration_date, donor_type, last_contacted_date, last_donation_date, next_eligible_date, donations_till_date, eligibility_status, cycle_of_donations, total_calls, frequency_in_days, status_of_bridge, status, donated_earlier, last_bridge_donation_date, calls_to_donations_ratio, user_donation_active_status, inactive_trigger_comment`.
- **Infra/constraints:** AWS authorized (Bedrock, SageMaker, Lex, Lambda, API Gateway, Step Functions, DynamoDB, RDS/Aurora, S3, Glue, Kinesis, SQS/SNS/SES, Cognito, Amplify). Cost soft-cap ~$30–40 → keep spend low. Recommended stack: React + Python (FastAPI/Flask) + SageMaker + Bedrock.
- **Timeline:** 2-day event; submission day 2 ~11:00 AM, jury 1:00 PM.

### Key framing decision
- **Decision:** The brief describes a full multi-month product. For a 2-person team in ~24h, the strategy is to build ONE compelling end-to-end slice, not a shallow version of everything. Scope direction still being chosen.

### Process / housekeeping decisions
- **Standing rule (user):** Document everything over the next 24h — decisions, architecture, design, errors and their resolutions. This file is that log.
- **Privacy rule (user):** Keep all working notes PRIVATE and OUT of git. Moved devlog from repo root into `private/` and gitignored `private/` + `DEVLOG.md`. Friend keeps a parallel private copy; reconcile later.
- **Direction:** User not yet committed to a demo slice. Next step: I propose 2–3 concrete directions with trade-offs for them to react to (rather than forcing a pick).

### Task pivot — Blood-stock data collection pipeline
- **New goal (user):** Build a production-quality Python pipeline that scrapes the public blood-stock search portal at `https://bloodwarriors.in/blood-stock`, permutes the filter dropdowns, and stores results (table + locations) into clean CSVs for downstream forecasting/optimization/analytics. Modular project layout, retries, throttling, dedup, incremental, checkpoint/resume, structured logging. Exclude personal info.

### Site discovery findings (2026-06-06)
- **Framework:** `bloodwarriors.in` is a **Next.js** app (CloudFront in front). The `/blood-stock` page is client-rendered; filter `<select>`s are server-rendered but **results load via client-side `fetch`** → JS-driven, but we found the underlying JSON API so **no Playwright needed**.
- **Backend:** Data is served by **internal Next.js API routes** that proxy **e-RaktKosh** (India's national govt blood portal). Storage/assets use Supabase (`db.bloodwarriors.in`), not relevant to stock data.
- **Two JSON endpoints discovered (reverse-engineered from JS chunk `d332e550df12de68.js`):**
  1. `GET /api/public/eraktkosh/states` → `{ data: { states: [{name, code}] } }` — **35 states** (confirmed). No auth.
  2. `GET /api/public/eraktkosh/blood-availability?stateCode=<code>&withStockOnly=true[&bloodGroup=<bg>][&component=<c>][&district=<d>][&type=<t>]` → `{ data: { fromCache, count, maxEntryAgeDays, availableDistricts:[...], filters, banks:[...] } }`. No auth.
- **Filter fields + values (from server-rendered HTML):**
  - State: 35, from `/states` (code+name).
  - District/city: dependent on state; comes back as `availableDistricts` from a stateCode-only availability call.
  - Blood group (11): `all`, A+Ve, A-Ve, B+Ve, B-Ve, O+Ve, O-Ve, AB+Ve, AB-Ve, Oh+VE, Oh-VE.
  - Component (10): `All`, Whole Blood, Packed Red Blood Cells, Fresh Frozen Plasma, Single Donor Platelet, Random Donor Platelets, Platelet Concentrate, Plasma, Cryoprecipitate, Cryo Poor Plasma.
  - Hospital type (5): `all`, Govt., Private, Charitable/Vol, Red Cross.
- **Bank result schema (confirmed via stateCode=35):** `id, name, address, district, contact, phones, emails, type, lastUpdated, isOnline, stock{component:{bloodGroup:units}}, totalUnits`.
  - **No latitude/longitude in the API.** The map geocodes from `address` client-side. Lat/long would require a separate geocoding step (optional).
  - **PII present:** `contact`, `phones`, `emails` (institutional blood-bank contacts) — per user's "exclude personal info" rule, these will be DROPPED from output.
- **robots.txt (IMPORTANT):** `https://bloodwarriors.in/robots.txt` has `Disallow: /api/`. **Both data endpoints live under `/api/`**, so a strictly robots-compliant crawler would not hit them. Flagged to user for decision (it's the host org's own portal + public, non-personal, no-auth data sourced from govt e-RaktKosh). Awaiting user call before any bulk collection.
- **Decision pending:** robots.txt posture + lat/long geocoding yes/no + enumeration scope. Confirmation probes so far = 3 tiny GETs total (1 page, 1 /states, 1 /blood-availability).

### Design approved + pipeline built (2026-06-06)
- **User decisions:** robots → proceed (polite + host-org authorized); geocoding → skip; PII → keep institutional bank phones/emails. Design approved ("Yes"). Spec at `private/specs/2026-06-06-blood-stock-pipeline-design.md`.
- **Validation probe:** confirmed `count == len(banks)` for states 28/21/10 → no pagination; one state call returns the full matrix. State 28 ~13s uncached → set 60s timeout.
- **Built `project/` package** (committable; `data/` + `logs/` gitignored): `config.py, utils.py (throttled retrying HTTP client + hash), logger.py (rotating file + console), parser.py (flatten nested stock → long rows + registry rows), discover_filters.py (states + districts → filters.json), storage.py (LongStore append+dedup, RegistryStore upsert, Checkpoint resume), collect_data.py (orchestrator + CLI), requirements.txt, README.md`.
- **Key implementation choices:**
  - Runtime depends only on `requests` + stdlib; `tqdm` optional (no-op fallback); pandas/bs4/lxml listed for downstream only. Avoided Playwright (clean JSON API).
  - Collection = one request per state; the "permutation of fields" is expanded in OUTPUT rows (bank × component × blood_group), not in requests — avoids hammering the slow govt backend.
  - Incremental = append timestamped SNAPSHOTS (time series for forecasting); dedup is within-run via SHA1 `record_hash`; registry upserts first_seen/last_seen.
- **Env note (not an error, a constraint):** `pip install` blocked by PEP 668 (externally-managed). Fine — pipeline runs on `requests` alone. README documents venv install for full deps.
- **Smoke test (states 35 + 21):** discover_filters wrote 35 states; collect produced 458 long rows + 57 registry banks; CSV schema/quoting correct (addresses with commas quoted). Resume test: rerun without `--fresh` → "0 pending" (skips done states). Fresh re-run of state 35 → appended +17 rows, 3 distinct snapshot timestamps, registry stayed deduped at 57. All 7 modules import cleanly.
- **State:** pipeline complete & verified. `data/` reset to clean (only `filters.json` kept). Not yet committed (waiting on user; pipeline code is committable, notes/data are gitignored).

### Full national collection run (2026-06-06 13:23–13:25)
- **Command:** `python3 -m project.collect_data --fresh` (run-20260606T075303Z).
- **Result:** 35/35 states OK, 0 failed, **3,863 banks**, **44,675 stock rows**, ~2.5 min. Outputs: `data/blood_stock_long.csv` (15 MB), `data/blood_banks.csv` (1.2 MB). All upstream calls `fromCache=False` (live e-RaktKosh). Retry/backoff never needed (no failures).
- **Quick analytics:** total units nationwide = 1,070,867. By hospital type: Govt 365,085 / Private 357,135 / Charitable 327,504 / Red Cross 21,143. Scarcest common group: O-Ve (26,122). Biggest states: UP (535 banks/6,336 rows), Maharashtra (377/4,781), Tamil Nadu (299/4,304), Karnataka (250/3,281).
- **Error/gotcha + fix:** initial verification used `wc -l` / `cut -d,` which reported bogus numbers (44,853 rows, "49 states") because addresses contain embedded commas/newlines inside quoted CSV fields — naive shell tools don't respect CSV quoting. Re-verified with Python `csv.DictReader`: true counts = 44,675 rows / 35 states / 3,863 banks, matching the run log exactly. Lesson: always validate CSV with a real parser, not line/field splitting.

### Decision reversal — publish to GitHub (2026-06-06)
- **User decision:** Reverse the earlier "keep notes private/out of git" rule. Push EVERYTHING to the team's GitHub repo `git@github.com:swaroop2005/Distortion.git` (private, branch `main`), **including the devlog and the 16 MB collected data CSVs**. From now on the DEVLOG is committed/pushed as part of normal commits.
- **Why it's OK:** repo is private (confirmed) → robots/authorization notes and institutional blood-bank contact fields are not publicly exposed.
- **gitignore change:** now only `logs/` is ignored; `private/` (devlog + specs) and `data/` (CSVs) are tracked. Note: folder is still literally named `private/` — offered to rename to `docs/` if preferred.
- **Note:** `gh` CLI not installed; pushing over the existing SSH remote.
- **Push outcome:** first push rejected (non-fast-forward) — teammate had pushed 2 commits adding `docs/DESIGN.md` + `PROGRESS.md` (a "ThalNet" sub-project: 3-agent framing, medical honesty, phenotype-as-scale-path). No path collisions with our `project/`/`data/`/`private/`, so `git rebase origin/main` was clean. Pushed: `05c919b..6222c62 main`. **Workflow going forward: commit + push the DEVLOG with each work increment.**
- **Teammate context noted:** parallel track is "ThalNet" (design + progress doc on `main`). Worth reconciling our blood-stock pipeline with their design later.

### Supply-chain optimizer built (2026-06-06)
- **What:** New `optimizer/` package (stdlib-only core + optional PuLP) implementing the approved A+B design: demand forecast → supply load → gap/coverage → redistribution MILP → donor mobilization. Modules: `config, geo, demand, supply, gap, redistribution, mobilization, report, run` + requirements + README. On branch `swaroop/dev`.
- **Decision — stdlib over pandas:** env can't `pip install` (PEP 668), and I wanted to actually verify the engine. Implemented data stages with stdlib `csv`/`datetime`/`math`; PuLP is an optional import with a deterministic **greedy fallback**, so the full pipeline runs + was tested here, and the exact MILP activates once `pip install pulp` in a venv. (Spec said pandas; deviated for testability/zero-dep robustness.)
- **Decision — rolling-recurrence demand:** dataset's `expected_next_transfusion_date` values are 2025 (env "today" = 2026-06-06). Modeled demand by advancing each schedule forward by `frequency_in_days` to the next occurrence ≥ as-of, then counting occurrences in the horizon. Handles stale anchors + matches lifelong-recurring reality.
- **Geography handling:** gap at state level (Telangana); redistribution at district level using a hardcoded 33-district Telangana centroid table (pulled from the scraped supply) + haversine, tiered proxy fallback; mobilization at point level via donor lat/long.
- **FINDING (important, surfaced to user):** at baseline sample demand (786 patients), Telangana supply comfortably covers 30-day demand → 48–1019 days coverage, 1 transfer, 0 mobilization. The engine *correctly* reports health, but it's a flat demo. Root cause: dataset is a tiny sample of BW's ~100k real patients.
  - **Fix:** added `--demand-scale` knob (scales demand units + daily rate; supply untouched) — methodologically honest projection toward the real patient base / surge modeling.
  - **Verified at scale 30:** AB- CRITICAL (1.6 days), 4 groups LOW; redistribution = **198 transfers / 4,362 units**; mobilization = **4,212 donors** by group (the ThalNet hand-off). Full optimization story now demonstrable.
- **Outputs:** `data/optimizer/{shortage_report,transfer_plan,mobilization_plan}.csv` + printed command-center summary. All 9 modules import + run clean.
- **AWS scale-path documented** in README per the new "flag AWS" rule (EventBridge+Lambda scheduled scrape→S3, Athena history, DynamoDB latest plan, Bedrock plain-language briefings, Step Functions+SES/SNS = ThalNet seam, QuickSight/Amplify dashboard).

### Visual dashboard built (2026-06-06)
- **What:** `optimizer/dashboard.py` generates a single self-contained `data/optimizer/dashboard.html` (36K) with data embedded as JSON — no server/build/CORS. Chart.js + Leaflet via CDN.
- **Collision check first (user ask):** scanned all `.md` + remote branches. Found new teammate branch `origin/scaffold-and-design` building `backend/` (FastAPI) + `scripts/clean_data.py` + `data/clean.csv`. To avoid collision, kept the dashboard inside `optimizer/` (no top-level `frontend/`/`dashboard/` that could clash with ThalNet's planned React UI).
- **Design:** branded command center (Blood Warriors navy/red). KPI cards (critical groups, first-shortage days, units to redistribute, donors to mobilize, banks), days-of-supply bar chart per group, interactive Telangana district map (shortfall heat + transfer flow lines + donor density, circle size ∝ demand), redistribution table, mobilization bar chart (ThalNet hand-off). **Scenario selector** (baseline/10×/30×) precomputed + embedded; defaults to 10× so it looks immediately useful while baseline stays honest.
- **Verified:** generates clean; `__DATA__` replaced; embedded JSON parses for all 3 scenarios; brace/paren/bracket balance OK (no node in env to full-lint). Baseline 0 crit, moderate 1 low/3355 donors, surge 1 crit/4 low/4212 donors.
- **View:** open the HTML in a browser / IDE live-preview; host on S3/Amplify. Committed to `swaroop/dev`.

### Bank-level optimizer + both CSVs (2026-06-06)
- **Why:** user noted `blood_banks.csv` was unused and `blood_stock_long.csv` was only used aggregated to district. Reworked the optimizer to reason about **individual banks**.
- **New `banks.py`:** joins `blood_banks.csv` (registry: name, address, district, type, total capacity, contacts, online) with per-bank red-cell stock from `blood_stock_long.csv` → bank nodes with coords (Telangana centroids).
- **Rewrote `redistribution.py` to bank→bank**, two modes (user chose **both**):
  - `demand` (Telangana): surplus banks ship to the hub (largest) bank of each deficit district; residual → mobilization.
  - `rebalance` (national): bring every bank to `--safety-stock` per group; below-safety banks pull from nearby surplus; leftovers → `under_safety.csv`.
  - Generic transshipment: PuLP MILP for small instances, greedy fallback (and forced greedy when source×sink pairs > 4000 to keep national fast).
  - Every transfer now carries from/to **bank name, district, type, capacity, distance_km** (user asked for these, like the map).
- **Wired:** `config` (mode, safety_stock), `run` (`--mode`, `--safety-stock`), `report` (bank-level transfer cols + under_safety.csv), `geo.bank_distance`. `dashboard.py` updated to render bank-level transfers (name/district/type/capacity) and use the new API.
- **Smoke tests:** demand@scale10 → 558 bank→bank moves (real names: Apollo, Indian Red Cross…), 3,355 donors. rebalance national → 7,183 moves/27,830 units; 5,957 bank×group still below safety = honest finding (national safety stock > available surplus). Dashboard regenerated + JSON/JS validated.
- **Known modeling note:** demand-mode funnels most transfers to Apollo (Hyderabad) because Hyderabad dominates both demand and is its district's largest hub bank. Acceptable for demo; could spread across multiple receiving banks later.

### Bank reserve floor — never drain a bank (2026-06-06)
- **Why (user):** a source bank must keep enough for its own patients; don't empty any single bank to help another.
- **Change:** added `Settings.min_reserve` (default 3) + `--min-reserve`. Demand-mode source cap = `min(district-surplus share, stock − min_reserve)` so a bank never gives below its floor even when its district has no local demand (previously ratio=1 could drain a bank to 0). Rebalance-mode source floor = `max(safety_stock, min_reserve)`.
- **Verified invariant:** across reserve=0/3/10 at demand-scale 30, **0 source banks left below reserve**; units moved scale down sensibly (4357 → 2877 → 1413) as reserve rises. Confirms banks retain their reserve and the knob behaves monotonically.
- **Side effect (correct):** with a reserve, less surplus is available → more residual demand → more donor mobilization. Conservative + honest.

### Dashboard: added India national scope (2026-06-06)
- **Why (user):** "I still only see it by Telangana." The scraped supply is national but the dashboard only showed Telangana.
- **Honest constraint surfaced:** demand data (`Dataset.csv`) is ~95% Telangana, and we only have district centroids for TG. So national can only honestly show **supply + rebalance**, not demand-driven shortages. User agreed: add an India scope (supply + rebalance), keep TG for demand. National marker = size by units in stock (their pick).
- **Changes:** added `STATE_CENTROIDS` (35 states) to `geo.py`; added `from_state`/`to_state` to transfer records; rewrote `dashboard.py` with a **scope toggle** (India / Telangana) embedding both datasets. India view = national KPIs, supply-by-group chart, state-level Leaflet map (markers ∝ units, inter-state rebalance flow lines), top rebalance transfers (bank names + states), top states by units. Telangana view unchanged (demand scenarios).
- **Verified:** India = 35 states, 3,670 red-cell banks, 225,386 units, 7,183 rebalance transfers, 5,957 bank×group below safety; top state UP (35,262 u). JS balanced; html 53 KB. Served live on localhost:8765 for the user to view.

### Repo review + AWS guide read + clarifications (2026-06-06)
- **Read the full 28-page AWS guide.** Key clarifications:
  - **Bedrock is NOT blocked by the $40 guest account.** It just needs a one-time enable:
    Bedrock console (us-east-1) → **Model access → Modify → tick Claude 3 Haiku → request**
    (instant for most). Then code can `InvokeModel`. Use **Haiku** (~10× cheaper than Sonnet).
  - **Set an AWS Budgets alarm to $40 first** (Billing → Budgets, §14.1) — emails at 80%/100%.
  - End-of-event: terminate EC2, delete RDS/EKS/NAT/S3-big, confirm spend ~0 (§14.3).
- **Full repo state:** `main` = scraper (`project/`) + bank-level optimizer + India/TG dashboard
  (Layer 1, DONE) + teammate's `backend/` FastAPI skeleton + `scripts/clean_data.py` +
  `data/clean.csv`. Layer 2 (ML, agents, UI, deploy) mostly TODO. **Seam (mobilization_plan →
  Triage) not wired yet** — that's the main integration gap.
- **Next WORK items (no AWS needed first):** (1) **Triage/seam engine** — mobilization_plan +
  donors + scores → ranked reasoned shortlist (input to Outreach); (2) **ML models** on
  clean.csv (Model B churn strong; Model A "responsiveness" proxy — be honest); (3) **FastAPI
  over real data** (serve shortages/transfers/mobilization). Then (console): enable Bedrock
  Haiku + budget alarm, install aws CLI + node/npm, then Outreach agent → Step Functions →
  React UI → deploy.
- **Env note:** node/npm + aws CLI not installed on the machine → UI + deploy blocked until then.
- (Personal handoff snapshot kept locally in gitignored `private/SESSION_CONTEXT.md`.)

### Supply-chain API — full backend wired to real data (2026-06-06)

**Motivation:** Backend had a full donor/patient/bridge stack but ZERO connection to
the real supply data (blood_stock_long.csv, blood_banks.csv) or the optimizer outputs.
The three missing user-facing signals: "how urgently is my blood group needed?",
"which nearby banks have stock?", "which donors should be contacted?". This session
wired all three.

**Problem found on startup — store.py killed all donor/patient routes:**
`store.py` calls `joblib.load(models/churn_model.pkl)` on first request. Two failure modes:
(a) model file missing → FileNotFoundError; (b) pkl saved with sklearn 1.5.0, env now
running sklearn 1.9.0 → `AttributeError: _RemainderColsList` during unpickling.
Either way: 500 on every `/admin/dashboard`, `/donors/`, `/patients/` call.
**Fix:** wrapped `joblib.load` in try/except + added `os.path.exists` guard in `_score()`.
Falls back to `default=0.5` for both churn_risk and responsiveness — API stays live, ML
scores become neutral until the models are retrained with the current sklearn version.
**Why acceptable:** neutral scores still allow proximity + eligibility ranking in `matching.py`;
the ML layer improves ranking but isn't load-bearing for the demo.

**optimizer refresh:**
Re-ran `python -m optimizer.run --mode both --demand-scale 30 --safety-stock 8 --min-reserve 3`.
This replaces the baseline (all-OK, 4-donor) outputs with realistic ones:
- AB- **CRITICAL** (1.6 days coverage) · AB+/O+/B+/O- **LOW** (3.9–7.0 days)
- 4345 donors to mobilize across 8 blood groups
- 312 bank→bank demand transfers (2877 units) + 7183 national safety-stock moves
These files (`data/optimizer/*.csv`) are now the live source-of-truth for the API.

**New file: `backend/app/supply_store.py`**
Pure-stdlib CSV reader (no pandas dependency) with lru_cache. Key design choices:
- **e-RaktKosh normalisation:** blood groups in blood_stock_long.csv come in two
  formats: `"A+Ve"` (old style) and `"A +ve"` (new style, space before sign) plus
  uppercase variants `"Oh+VE"`. A single map keyed on `.lower()` handles all variants
  → canonical "A+", "O-", "Bombay" etc., matching compat.py.
- **Geo proximity without per-bank lat/lon:** the e-RaktKosh API returns no
  coordinates for banks. Solved via district centroid lookup: when a caller passes
  `(lat, lon)`, `nearest_districts()` finds the top-N closest Telangana district
  centroids (imported from `optimizer.geo`) and filters banks to those districts,
  sorted nearest-first. Falls back to state-level for non-TG queries via `STATE_CENTROIDS`.
- **Aggregation:** banks_with_stock aggregates available_units per (bank_id × blood_group ×
  component_type), joining the bank registry for phone/email, and annotates each result
  with `approx_km_from_query` when a geo query is active.
- `national_kpis()` is a single-call snapshot (3863 banks, 1,070,867 units, 35 states,
  critical/low groups, donors to mobilize) used by the admin dashboard header.

**New file: `backend/app/routers/supply.py`** — 8 endpoints:
| Route | What it serves |
|---|---|
| `GET /supply/kpis` | National snapshot (banks, units, critical groups, mobilization count) |
| `GET /supply/summary` | Stock by blood group + component, filterable by state/district |
| `GET /supply/banks` | Banks with stock — geo query (lat/lon auto-resolves to nearest districts) or explicit district/state filter |
| `GET /supply/demand-forecast` | Urgency per blood group from optimizer shortage report |
| `GET /supply/shortage` | Full shortage breakdown (critical / low / ok) |
| `GET /supply/mobilization` | Ranked donor list for outreach (Layer 1 → Layer 2 seam) |
| `GET /supply/transfers` | Bank-to-bank transfer plan from optimizer |
| `GET /supply/under-safety` | Banks still below safety floor after rebalancing |

**Updated `backend/app/routers/admin.py`:**
- `GET /admin/dashboard` now includes a `supply` sub-object (national KPIs) so the
  admin single-call gets both the donor/patient/bridge picture AND the blood supply
  snapshot — Layer 1 + Layer 2 in one payload.
- New `GET /admin/supply-overview`: full shortage breakdown + recommendation string
  ("URGENT: X groups critically low…" / "All groups adequately stocked").

**Updated `backend/app/main.py`:** registered supply router; version bumped to 0.2.0.

**Deps installed (break-system-packages — local dev only):**
`fastapi==0.136.3 uvicorn==0.49.0 pydantic==2.13.4 pandas==3.0.3 numpy==2.4.6
scikit-learn==1.9.0 joblib==1.5.3 mangum==0.21.0 boto3==1.43.24`
Note: existing pkl models were saved with sklearn 1.5.0 — need retraining. graceful fallback active.

**Verified live:**
```
GET /supply/kpis         → 3863 banks, 1,070,867 units, 35 states, critical: [AB-]
GET /supply/demand-forecast → AB- CRITICAL 1.6d · AB+/O+/B+/O- LOW 3.9–7.0d
GET /supply/banks?lat=17.385&lon=78.486&blood_group=O%2B → 5 banks, nearest ~19.8km
GET /supply/mobilization?blood_group=AB- → 32 donors, ranked by proximity
GET /admin/dashboard     → donors:4446 patients:84 supply.critical:[AB-] donors_to_mobilize:4345
GET /admin/supply-overview → CRITICAL:1 LOW:4 + action recommendation string
```

**Total registered routes (24):**
`/ /health` + 4 patient + 5 donor + 4 admin + 8 supply

**AWS path for this layer (next steps):**
- S3: upload blood_stock_long.csv, blood_banks.csv, Dataset.csv → s3://thalnet-data/
- supply_store.py data load: swap `open(STOCK_CSV)` for `boto3.client('s3').get_object()`
  with same lru_cache wrapper; add EventBridge rule to re-run scraper daily and update S3
- Lambda: zip backend/ + requirements, `mangum.Mangum(app)` already wired as handler
- API Gateway (HTTP API): route `$default` → Lambda → instant HTTPS endpoint
- DynamoDB: `donors` table (PK=user_id) for fast single-record lookup in matching.py
  (current in-memory load of 7k-row CSV is fine at hackathon scale, matters at 100k+)

## 2026-06-07

### Website chatbot — shipped (merged to main, `feb660e`)
- **What:** role-aware, read-only, multilingual (EN/HI/TE) chatbot served by `POST /chat`. Intent-router + 5 grounded handlers (`personal_eligibility`, `bridge_status`, `stock_lookup`, `general_faq`, `fallback`). Mock-first ($0, offline); Bedrock Haiku switchable.
- **Architecture (Approach C):** handler deterministically fetches ONLY real data (store/eligibility/bridge/supply_store/curated FAQ) → builds `grounded_facts` → LLM only *phrases* it. The LLM never sees raw data and never invents numbers. New files: `services/chatbot.py`, `services/voice.py` (shared empathy layer: tone guide + exemplars, no fine-tuning/no cure language), `services/knowledge.py` (curated cite-able FAQ), `routers/chat.py`.
- **Adapters extended:** added `classify_intent` + `compose_chat_reply` to both MockLLM and BedrockLLM in `outreach.py` (purely additive).
- **Also fixed a real boot bug:** `main.py` referenced an empty `routers/supply.py`; wired the real `supply_routes` router so the app boots (was crashing on import).
- **Process:** brainstorm → spec → plan → subagent-driven build with two-stage review per task. Review caught/fixed: AB+→B+ blood-group mis-extraction, inactive donors inflating bridge counts, NaN-latitude guard, substring FAQ false-positives, dishonest faq-miss intent label.
- **Tests:** 5 smoke modules (`test_voice/knowledge/outreach_chat/chatbot/chat_endpoint`), all green.

### Wellness suggestions — shipped (merged to main, `6dcbba4`)
- **What:** new `wellness` chatbot intent giving role-aware, source-cited, NON-prescriptive suggestions (diet / hydration & daily habits / emotional wellbeing).
- **Safety-first design:** I pushed back on the original "scrape Reddit + train the model on health advice" idea — for thalassemia that's genuinely dangerous (the classic iron trap: iron-rich food is good donor-recovery advice but HARMFUL for transfusion-dependent patients due to iron overload). Reframed to: curated CSV from authoritative sources (TIF, Cooley's Anemia Foundation, NHS, Blood Warriors), NO Reddit medical content, NO fine-tuning (doesn't fit Bedrock-Haiku/<$10/no-SageMaker stack anyway).
- **How it's safe:** `data/wellness_suggestions.csv` (14 rows) + `services/wellness.py` filter by audience (patient↔donor never cross — the iron guard); `caution_flag` surfaces the iron-overload note first for patients; every wellness reply ends with an always-on, code-enforced "not medical advice — check with your hematologist" disclaimer.
- **Review caught:** cache-poisoning risk (return copies), Bedrock classify prompt missing the `wellness` label (would've disabled wellness on real Haiku), and emotional-distress vocab missing from intent keywords (whole topic unreachable on the default mock backend) — all fixed.
- **Tests:** added `test_wellness`; full suite (6 modules) green.

### Next (queued)
- **Community Hub** (vision): donor↔patient connection system (mutual-accept → private chat), community feed (LinkedIn+Reddit style, upvotes/urgent boost), discussion threads (nested replies, best-answer, search, AI summaries), grounded AI assistant.
- **ML/agent deepening:** Triage = Bridge Suitability Score (weighted ranking MVP, no labels); Failure-Learning = Donor Failure Risk score + churn prediction + self-heal trigger. Feature columns mapped to the real `Dataset.csv` schema (eligibility/reliability/bridge-history/geo/compatibility).
- Existing Part B (outreach hardening) spec still open: `docs/superpowers/specs/2026-06-07-chatbot-and-outreach-design.md`.

<!-- next entries below -->
