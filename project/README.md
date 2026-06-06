# Blood-Stock Data Collection Pipeline

A production-quality Python pipeline that collects **publicly available blood-bank
inventory** from the Blood Warriors portal (<https://bloodwarriors.in/blood-stock>)
and exports clean CSVs for downstream **forecasting, optimization, and analytics**.

The portal is a Next.js front-end that proxies India's national **e-RaktKosh**
blood inventory system. Search results are served by two public, no-auth JSON
endpoints, so this pipeline talks to those directly — **no HTML scraping or
headless browser required.**

---

## How the site works (discovery summary)

| Question | Finding |
|---|---|
| GET / POST / AJAX / GraphQL? | Client-side **AJAX `fetch` to JSON API routes** (GET) |
| Endpoints | `GET /api/public/eraktkosh/states`, `GET /api/public/eraktkosh/blood-availability` |
| Parameters | `stateCode` (req), `withStockOnly`, `bloodGroup`, `component`, `district`, `type` |
| Auth | None (public) |
| Server- or client-rendered? | Data is JSON, rendered client-side into a table + map |
| Pagination | None — one `stateCode` call returns **all** banks with the full stock matrix |

### Searchable filter fields

* **State** — 35 values (live from `/states`)
* **District / city** — per-state (returned as `availableDistricts`)
* **Blood group** — A+Ve, A-Ve, B+Ve, B-Ve, O+Ve, O-Ve, AB+Ve, AB-Ve, Oh+VE, Oh-VE
* **Component** — Whole Blood, Packed Red Blood Cells, Fresh Frozen Plasma, Single
  Donor Platelet, Random Donor Platelets, Platelet Concentrate, Plasma,
  Cryoprecipitate, Cryo Poor Plasma
* **Hospital type** — Govt., Private, Charitable/Vol, Red Cross

### Why we don't permute every dropdown

A single `blood-availability?stateCode=<code>` response already contains every
bank in that state **with its complete component × blood-group stock matrix**.
Permuting all dropdowns (35 states × ~27 districts × 10 groups × 9 components ×
4 types) would mean hundreds of thousands of **redundant** requests against a slow
government backend. Instead we make **one request per state (~35 total)** and
expand the nested stock matrix into the full cross-product **in the output rows**.
(An optional verification of explicit filter combos can be added later.)

---

## Project structure

```
project/
├── config.py            # endpoints, throttle/retry, scope, paths, filter catalogs
├── discover_filters.py  # enumerate states + districts -> filters.json
├── collect_data.py      # orchestrator (CLI): loop states -> fetch -> parse -> store
├── parser.py            # bank JSON -> flat long rows (expand stock matrix)
├── storage.py           # CSV writers, dedup, snapshot append, checkpoint/resume
├── logger.py            # structured logging (console + rotating file)
├── utils.py             # throttled, retrying HTTP client + hashing
├── requirements.txt
└── README.md
```

Outputs are written to `../data/` and logs to `../logs/` (both git-ignored).

---

## Installation

```bash
# from the repository root
python3 -m venv .venv && source .venv/bin/activate
pip install -r project/requirements.txt
```

> **Note:** the runtime only needs `requests` (+ Python stdlib). `pandas`,
> `beautifulsoup4`, and `lxml` are included for downstream analysis convenience;
> `tqdm` is optional (progress bar) and degrades gracefully if absent.
> `playwright` is **not** needed for this target (a clean JSON API exists).

---

## Usage

```bash
# Enumerate all filter values -> data/filters.json
python -m project.discover_filters

# Collect ALL states (resumes automatically if interrupted)
python -m project.collect_data

# Collect specific states by code
python -m project.collect_data --states 28,21,10

# Include banks with zero stock (registry completeness)
python -m project.collect_data --all-banks

# Start a brand-new snapshot, ignoring any prior checkpoint
python -m project.collect_data --fresh

# Be extra gentle (3s between requests)
python -m project.collect_data --throttle 3.0
```

### Resume / incremental behaviour

* Each run appends a **timestamped snapshot** to `blood_stock_long.csv` — history
  accumulates, which is exactly what time-series forecasting needs.
* A JSON **checkpoint** records the active run and completed states; an interrupted
  run resumes from where it stopped (skipping done states). Use `--fresh` to begin
  a new snapshot.
* `blood_banks.csv` is **upserted** by bank id (`first_seen` preserved,
  `last_seen` refreshed).

---

## Data schema

### `blood_stock_long.csv` — primary, one row per (bank × component × blood group)

| Column | Description |
|---|---|
| `search_timestamp` | UTC ISO time the snapshot was collected |
| `state_code` / `state_name` | e-RaktKosh state code / name |
| `district` | Bank district |
| `blood_bank_id` | e-RaktKosh bank id |
| `blood_bank_name` | Bank name |
| `address` | Full postal address |
| `hospital_type` | Govt. / Private / Charitable/Vol / Red Cross |
| `is_online` | Whether the bank reports online |
| `stock_last_updated` | When the bank last updated its stock |
| `component_type` | Blood component (e.g. Whole Blood) |
| `blood_group` | Blood group (e.g. O+Ve) |
| `available_units` | Units available for this component+group |
| `bank_total_units` | Bank's total units across all components |
| `phones` / `emails` | Institutional blood-bank contact (public) |
| `record_hash` | SHA1 used for duplicate detection |

### `blood_banks.csv` — dimension/registry, one row per bank

`blood_bank_id, blood_bank_name, address, district, state_name, state_code,
hospital_type, phones, emails, bank_total_units, is_online, stock_last_updated,
first_seen, last_seen`

### `filters.json` — enumerated filter catalog

States (code+name), per-state districts, and the static blood-group / component /
hospital-type value lists.

---

## Compliance: robots.txt, rate limiting, terms of use

**Read this before running.**

* **robots.txt** — `https://bloodwarriors.in/robots.txt` contains `Disallow: /api/`,
  and both data endpoints live under `/api/`. A strict crawler would not fetch them.
  This pipeline is operated **under authorization from the host organization**
  (Blood Warriors, which provides this portal to hackathon participants) for the
  specific purpose of collecting public, non-personal inventory data. It does **not**
  touch any other disallowed path. If you are not operating under that
  authorization, do not run it against this host.
* **Rate limiting** — no published limit. The client self-limits to ~1 request every
  1.5 s (+ jitter) and backs off exponentially on `429`/`5xx`. Keep `--throttle`
  conservative, prefer off-peak hours, and stop if the host signals distress.
* **Terms of use / data sensitivity** — only **public, non-personal** blood-stock
  inventory is collected. The data ultimately originates from the government
  e-RaktKosh portal. No patient data exists in this source. The only contact fields
  are **institutional** blood-bank desk phone/email (kept as inventory contacts).
  Do not use the data to contact individuals; use it for aggregate analytics,
  forecasting, and optimization.

---

## Downstream use

`blood_stock_long.csv` is tidy/long-format and loads directly into pandas:

```python
import pandas as pd
df = pd.read_csv("data/blood_stock_long.csv", parse_dates=["search_timestamp"])
# e.g. units by state over time, per component
pivot = df.pivot_table(index="search_timestamp", columns="state_name",
                       values="available_units", aggfunc="sum")
```

Running on a schedule (e.g. daily cron) builds a time series suitable for demand
forecasting and supply optimization.
