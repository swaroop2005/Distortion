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

<!-- next entries below -->
