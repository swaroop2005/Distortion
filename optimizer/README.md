# Blood Supply-Chain Optimization Engine

Predicts blood **shortages** and optimizes the **response** — inter-bank
redistribution plus donor mobilization — for the Blood Warriors network.

It joins our two data assets:

* **Supply** — `data/blood_stock_long.csv`, the live national blood-bank inventory
  scraped by the `project/` pipeline.
* **Demand** — `Dataset.csv`, the provided donor/patient dataset (Bridge patients'
  recurring transfusion schedules + the donor pool).

It is the **supply/inventory** counterpart to the teammate's **ThalNet** (donor
matching + autonomous outreach). The mobilization plan this engine emits is shaped
to be ThalNet's outreach input.

---

## What it does (4 stages)

1. **Demand forecast** (`demand.py`) — each Bridge patient needs `quantity_required`
   units of their blood group every `frequency_in_days`. Demand is modeled as a
   **rolling recurrence** (the schedule is advanced to its next occurrence on/after
   the as-of date), so it is robust to stale anchor dates and reflects the
   lifelong-recurring reality. Patients are placed at their nearest district by
   lat/long.
2. **Supply load** (`supply.py`) — aggregates **red-cell** components (Whole Blood +
   Packed Red Blood Cells — the thalassemia need) per district & blood group.
3. **Gap & coverage** (`gap.py`) — per blood group: `days_of_coverage = supply /
   daily_demand`, classified **CRITICAL** (<3d) / **LOW** (<7d) / **OK**.
4. **Optimize**
   * **Redistribution** (`redistribution.py`) — integer transshipment: surplus
     districts ship to deficit districts, minimizing unmet demand then transport
     distance. Solved with **PuLP/CBC** when installed, else a deterministic
     **greedy** fallback.
   * **Mobilization** (`mobilization.py`) — residual deficits → the nearest eligible,
     compatible donors needed to close the gap (the **ThalNet hand-off**).

---

## Install & run

```bash
# from the repo root
python3 -m venv .venv && source .venv/bin/activate
pip install -r optimizer/requirements.txt        # optional: enables the exact MILP

python -m optimizer.run                           # Telangana, 30-day horizon
python -m optimizer.run --horizon-days 14
python -m optimizer.run --demand-scale 30         # model the real patient load
python -m optimizer.run --greedy                  # skip the MILP solver
python -m optimizer.run --allow-substitution      # allow O-/ABO-compatible donors

# Build the visual command-center dashboard (self-contained HTML)
python -m optimizer.dashboard                     # -> data/optimizer/dashboard.html
```

### Dashboard

`python -m optimizer.dashboard` runs the pipeline across three demand scenarios
(baseline / 10× / 30×) and writes a **single self-contained `dashboard.html`** with
all data embedded — no server, no build step, no CORS. Open it in any browser, or
drop it on **S3 / Amplify** for Blood Warriors to host. It shows KPI cards, a
days-of-supply chart per blood group, an interactive Telangana district map
(shortfall heat + transfer flows + donor density), the redistribution table, and
the donor-mobilization plan, with a **scenario selector** to explore baseline vs.
surge. Uses Chart.js + Leaflet via CDN (internet needed to render).

> The engine runs on the **Python standard library alone**. `pulp` is optional
> (enables the exact optimizer; without it the greedy fallback is used). `pandas`
> is only for your own analysis of the outputs.

### `--demand-scale` (why it exists)

`Dataset.csv` is a **786-patient sample** of Blood Warriors' real ~100,000-patient
population, so at scale `1.0` statewide supply comfortably covers demand and the
engine (correctly) reports healthy coverage. `--demand-scale` projects the sample
toward a realistic patient load (and models surges), which is where the
optimization becomes meaningful. It scales demand units and the daily rate; supply
is untouched.

---

## Outputs (`data/optimizer/`)

| File | One row per | Key columns |
|---|---|---|
| `shortage_report.csv` | blood group | supply_units, horizon_demand, daily_demand, days_of_coverage, status, shortfall_units |
| `transfer_plan.csv` | recommended transfer | from_district, to_district, blood_group, units, distance_km, reason |
| `mobilization_plan.csv` | donor to recruit | region, district, blood_group, donor_id, distance_km, eligibility, rank, units_contributed |

A command-center summary is also printed to the console.

---

## Assumptions & honest scoping

* **Region = Telangana.** The provided demand data is Hyderabad/Telangana-centric;
  scraped supply is national (Telangana included), so the demand↔supply join is
  honest there. The code is region-agnostic and generalizes as more demand data
  arrives (`--region`).
* **Geography.** Banks have district names but no coordinates; patients have
  coordinates but no district. Gap is computed at state level; redistribution uses
  Telangana district centroids (approximate) for transport distance; mobilization
  uses donor coordinates directly.
* **Component.** Red cells only (thalassemia need); platelets/plasma are out of the
  core optimization.
* **Compatibility.** Exact blood group by default; `--allow-substitution` enables
  the ABO/Rh red-cell compatibility matrix (O− universal donor, etc.).
* **One donor ≈ one red-cell unit** for mobilization sizing.

---

## AWS scale-path (not built for the hackathon demo)

* **EventBridge + Lambda** run the scraper on a schedule → S3 → automatic daily
  supply snapshots (a real time series for forecasting).
* **S3 + Athena** query historical snapshots; **DynamoDB** holds the latest plan.
* **Bedrock (Claude Haiku)** turns each plan into a plain-language briefing.
* **Step Functions + SES/SNS** execute the mobilization list — the ThalNet seam.
* **QuickSight / Amplify** host the command-center dashboard.
