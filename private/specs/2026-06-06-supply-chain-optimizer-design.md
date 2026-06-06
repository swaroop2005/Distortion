# Blood Supply-Chain Optimization Engine — Design Spec

> Date: 2026-06-06 · Project: Blend360 "Blood Warriors" hackathon (Team Distortion)
> Branch: `swaroop/dev` · Status: APPROVED (design). Implementation in progress.
> Complements teammate's **ThalNet** (donor matching + autonomous outreach); this owns
> the **supply/inventory** half.

## 1. Goal
Turn our two data assets into a "blood supply command center" that **predicts shortages**
and **optimizes the response** — inter-bank redistribution + donor mobilization — so
coordinators act before a Bridge patient's transfusion is at risk.

Chosen scope (user): **A + B combined** = demand forecast + gap analysis + redistribution
optimization + mobilization plan. Integration with ThalNet: **decided later** — built
standalone, but the mobilization output is shaped to be ThalNet's outreach input.

## 2. Data assets
- **Supply:** `data/blood_stock_long.csv` (our scrape) — per bank: district, state, blood
  group, component, available_units, totalUnits, stock_last_updated. National; 3,863 banks.
  Has district/state **names** but **no coordinates**.
- **Demand:** `Dataset.csv` (provided, 7,033 rows) — 786 Bridge patients carry recurring
  demand (`quantity_required`, `frequency_in_days`, `expected_next_transfusion_date`,
  `blood_group`). Donor pool (~4.4k donors) with `eligibility_status`, `next_eligible_date`,
  lat/long. Geography is **Hyderabad/Telangana-centric** (5,464/7,033 near 17.4,78.5); has
  **lat/long** but **no district names**.

### Geography-join decision (the key constraint)
- **Demand↔Supply gap** computed at **state level** (Telangana) per blood group — both sides
  aggregate cleanly and honestly. National supply shown as context.
- **Redistribution** runs at **district level on the supply side** (banks are nodes);
  distances via a small Telangana district-centroid lookup + tiered proxy fallback
  (same district = 0, same state = 1, cross-state = 2) where centroids are unknown.
- **Mobilization** at **point level** using donor lat/long directly (no district needed).

## 3. Normalization rules
- **Blood group canon:** map `"O Positive"`/`"O+Ve"` → `"O+"`, etc. Canonical set
  {A±, B±, O±, AB±}. Map blanks / "Do not Know" / rare (Bombay, A1/A2 variants) → `UNKNOWN`,
  excluded from optimization (reported separately).
- **Component focus:** thalassemia patients receive **packed red cells** → supply side
  aggregates red-cell components {`Whole Blood`, `Packed Red Blood Cells`}. Platelets/plasma
  reported but out of the core optimization.
- **Compatibility:** default exact-group match. O− as universal red-cell donor modeled as an
  optional substitution edge (noted, behind a flag) so the demo stays explainable.

## 4. Pipeline (4 stages)
1. **Demand forecast** (`demand.py`) — for each Bridge patient, enumerate transfusion dates
   from `expected_next_transfusion_date` stepping by `frequency_in_days` within a horizon
   (default 30 days); each due date contributes `quantity_required` units of their group.
   Aggregate → demand per (region, blood group) and a daily-demand rate.
2. **Supply load** (`supply.py`) — load scraped long CSV, filter red-cell components, sum
   `available_units` per (district, state, blood group); also a state rollup.
3. **Gap & coverage** (`gap.py`) — per region×group: `days_of_coverage = supply / daily_demand`;
   classify CRITICAL (<3d) / LOW (<7d) / OK; compute shortfall units over the horizon.
4. **Optimize:**
   - **Redistribution** (`redistribution.py`) — min-cost transshipment (MILP via **PuLP/CBC**)
     across district nodes: decision vars = units moved bank/district i→j of group g; minimize
     `w1·unmet_demand + w2·transport_distance`; constraints = supply caps, demand satisfaction,
     compatibility. **Greedy nearest-surplus fallback** if no solver present.
   - **Mobilization** (`mobilization.py`) — residual deficit per region×group → select minimum
     eligible donors (`eligibility_status` eligible OR `next_eligible_date` ≤ horizon),
     compatible group, ranked by proximity to deficit centroid; output until gap covered.
     **This list = the ThalNet hand-off artifact.**

## 5. Module layout
```
optimizer/                 # new package on swaroop/dev (reuses data/ from the scraper)
├── config.py              # horizon, weights, normalization maps, compatibility, paths
├── demand.py              # patient schedules -> demand per region/group (+ daily rate)
├── supply.py              # scraped CSV -> red-cell supply per district/state/group
├── gap.py                 # coverage, days-of-supply, shortfall classification
├── geo.py                 # blood-group + region helpers, district centroids, distance
├── redistribution.py      # transshipment MILP (PuLP) + greedy fallback
├── mobilization.py        # residual gap -> ranked eligible-donor list
├── report.py              # printed command-center summary + CSV writers
├── run.py                 # CLI orchestrator
├── requirements.txt       # pandas, pulp
└── README.md              # method, run, schema, assumptions, AWS scale-path
```

## 6. Outputs (to `data/optimizer/`)
- `shortage_report.csv` — region, blood_group, supply_units, horizon_demand, daily_demand,
  days_of_coverage, status, shortfall_units.
- `transfer_plan.csv` — from_district, to_district, blood_group, units, distance, reason.
- `mobilization_plan.csv` — region, blood_group, donor_id, distance_km, eligibility, rank,
  units_contributed (ThalNet hand-off).
- Printed summary: top shortages, total units moved, residual gap, donors to mobilize.

## 7. Tech & reliability
- pandas for data; **PuLP** (bundled CBC) for the MILP; deterministic greedy fallback so
  `run.py` always produces a plan even without a solver.
- Pure functions per stage; each loads/returns DataFrames so stages are independently testable.
- CLI flags: `--horizon-days`, `--region`, `--use-solver/--greedy`, `--allow-substitution`,
  `--out-dir`.

## 8. AWS scale-path (proactively flagged; not built for the demo unless time)
- **EventBridge + Lambda** scheduling the scraper → S3 → automatic daily supply snapshots
  (real time-series for forecasting) instead of local cron.
- **S3 + Athena** to query historical snapshots; **DynamoDB** for the latest plan.
- **Bedrock (Claude Haiku)** to turn each optimization plan into a human-readable briefing
  ("Hyderabad is 2 days from an O− shortfall; move 30 units from Bank A, mobilize 6 donors").
- **Step Functions + SES/SNS** to execute the mobilization list = the ThalNet integration seam.
- **QuickSight / Amplify** for the command-center dashboard.
Kept as a "how this productionizes" slide; local CSV engine is the hackathon deliverable.

## 9. Out of scope (YAGNI)
- Precise geocoding of bank addresses (district-level proxy is enough for the demo).
- Stochastic/ML demand model (deterministic schedule forecast is honest and explainable).
- Platelet/plasma optimization (red cells are the thalassemia need).
- Live ThalNet wiring (decided later; output is shaped for it).
