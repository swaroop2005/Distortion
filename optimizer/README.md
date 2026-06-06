# Blood Supply-Chain Optimization Engine

Predicts blood **shortages** and optimizes the **response** — inter-bank
redistribution plus donor mobilization — for the Blood Warriors network.

It joins three data assets at **bank granularity**:

* **Supply** — `data/blood_stock_long.csv`, live per-bank inventory scraped by the
  `project/` pipeline (available units by component & blood group).
* **Bank registry** — `data/blood_banks.csv`, used to enrich every bank with its
  name, address, district, type, total capacity, and contacts so each recommended
  transfer names a real source and destination bank.
* **Demand** — `Dataset.csv`, the provided dataset (Bridge patients' recurring
  transfusion schedules + the donor pool).

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
4. **Optimize** — **bank-to-bank** integer transshipment (`redistribution.py`,
   `banks.py`). Every transfer names a real source and destination bank with its
   district, type, capacity, and the distance between them. Two modes:
   * **`demand`** (Telangana) — cover patient-demand deficits per district: surplus
     banks ship to the hub bank of each deficit district.
   * **`rebalance`** (national) — bring every bank up to a safety-stock level per
     blood group; below-safety banks pull from nearby surplus banks. Banks left
     below safety are reported in `under_safety.csv`.
   * **`both`** runs demand (TG) + rebalance (national).
   Solved with **PuLP/CBC** for small instances, else a deterministic **greedy**
   nearest-source fallback (also used for the large national instance).
   A **reserve floor** (`--min-reserve`, default 3) guarantees a source bank is
   never drained below a minimum it keeps per blood group for its own patients.
   * **Mobilization** (`mobilization.py`) — residual demand deficits → the nearest
     eligible, compatible donors needed to close the gap (the **ThalNet hand-off**).

---

## Install & run

```bash
# from the repo root
python3 -m venv .venv && source .venv/bin/activate
pip install -r optimizer/requirements.txt        # optional: enables the exact MILP

python -m optimizer.run                           # demand mode, Telangana, 30 days
python -m optimizer.run --mode rebalance          # national safety-stock rebalance
python -m optimizer.run --mode both               # both modes
python -m optimizer.run --safety-stock 10         # rebalance target per bank/group
python -m optimizer.run --min-reserve 5           # units a source bank always keeps
python -m optimizer.run --demand-scale 30         # model the real patient load
python -m optimizer.run --greedy                  # skip the MILP solver
python -m optimizer.run --allow-substitution      # allow O-/ABO-compatible donors

# Build the visual command-center dashboard (self-contained HTML)
python -m optimizer.dashboard                     # -> data/optimizer/dashboard.html
```

### Dashboard

`python -m optimizer.dashboard` writes a **single self-contained `dashboard.html`**
with all data embedded — no server, no build step, no CORS. Open it in any browser
or host it on **S3 / Amplify**. Uses Chart.js + Leaflet via CDN (internet needed).

It has a **scope toggle**:

* **🇮🇳 India (national)** — supply + safety-stock rebalance across all scraped
  states: KPI cards, national supply by blood group, a **state-level map** (markers
  sized by units in stock + inter-state rebalance flows), the top rebalance
  transfers, and the top states by stock. *Supply/rebalance only — national demand
  data does not exist, so shortage analysis would be fabricated.*
* **📍 Telangana (demand)** — the demand-driven command center: days-of-supply per
  group, a district map (shortfall + bank→bank flows + donor density), the
  bank-level transfer table, and the donor-mobilization plan, with a
  **baseline / 10× / 30×** scenario selector.

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
| `transfer_plan.csv` | recommended bank→bank transfer | mode, blood_group, units, distance_km, from_bank, from_district, from_type, from_capacity, to_bank, to_district, to_type, to_capacity, reason |
| `mobilization_plan.csv` | donor to recruit | region, district, blood_group, donor_id, distance_km, eligibility, rank, units_contributed |
| `under_safety.csv` | bank below safety (rebalance) | bank, district, state, blood_group, short_units |

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
