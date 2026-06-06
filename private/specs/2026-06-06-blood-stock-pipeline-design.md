# Blood-Stock Data Collection Pipeline — Design Spec

> Date: 2026-06-06 · Project: Blend360 "Blood Warriors" hackathon · PRIVATE (gitignored)
> Status: APPROVED by user (design). Implementation pending.

## 1. Goal
A production-quality, maintainable Python pipeline that collects publicly available blood-stock
inventory from `https://bloodwarriors.in/blood-stock` and exports clean CSVs suitable for
downstream forecasting, optimization, and analytics.

## 2. Discovered architecture (source of truth)
- `bloodwarriors.in` is a **Next.js** app that proxies India's national **e-RaktKosh** blood portal.
- Search results come from **two public, no-auth JSON API routes** (client-side `fetch`):
  1. `GET /api/public/eraktkosh/states`
     → `{ data: { states: [{ name, code }] } }` — 35 states.
  2. `GET /api/public/eraktkosh/blood-availability?stateCode=<code>&withStockOnly=<bool>`
     `[&bloodGroup=<bg>][&component=<c>][&district=<d>][&type=<t>]`
     → `{ data: { fromCache, count, maxEntryAgeDays, availableDistricts:[...], filters, banks:[...] } }`
- **Bank object schema:** `id, name, address, district, contact, phones[], emails[], type,
  lastUpdated, isOnline, stock{ component: { bloodGroup: units } }, totalUnits`.
- **No lat/long** in the API (map geocodes address client-side).
- **Validated:** `count == len(banks)` for states 28/21/10 → **no pagination cap**; one state call
  returns all banks with the full stock matrix. State 28 took ~13s (slow uncached upstream).

### Filter value catalog
- **State (35):** from `/states` (code+name).
- **District:** state-dependent; returned as `availableDistricts` in a stateCode-only call.
- **Blood group (10 + all):** A+Ve, A-Ve, B+Ve, B-Ve, O+Ve, O-Ve, AB+Ve, AB-Ve, Oh+VE, Oh-VE.
- **Component (9 + All):** Whole Blood, Packed Red Blood Cells, Fresh Frozen Plasma,
  Single Donor Platelet, Random Donor Platelets, Platelet Concentrate, Plasma, Cryoprecipitate,
  Cryo Poor Plasma.
- **Hospital type (4 + all):** Govt., Private, Charitable/Vol, Red Cross.

## 3. Collection strategy (key decision)
A single `stateCode` call returns the full component×bloodGroup matrix for every bank, so we do
**one request per state (35 total)** rather than permuting every dropdown (which would be
~hundreds of thousands of redundant requests against a slow govt backend).

The "permutation/combination of fields" the user wants is realized in the **output rows**: each
bank's nested `stock` is flattened to one row per **(bank × component × blood group)** — the full
cross-product, captured completely without abusing the API.

Optional `--verify-filters` mode (off by default): spot-check a handful of explicit filter combos
against the flattened data to prove completeness.

`withStockOnly` is configurable; default `true` (matches the portal's "show available stock" view).
A `false` run captures all registered banks incl. zero-stock (registry completeness).

## 4. Module layout
```
project/                      # committable pipeline code (NOT private)
├── config.py                 # endpoints, UA, throttle/retry, scope, paths, field catalogs
├── discover_filters.py       # fetch /states + per-state availableDistricts -> filters.json
├── collect_data.py           # orchestrator: loop states -> fetch -> parse -> store; checkpoint/resume; progress; CLI
├── parser.py                 # bank JSON -> flat long rows (expand stock matrix); normalize
├── storage.py                # CSV writers (long + registry), dedup, snapshot append, checkpoint I/O
├── logger.py                 # structured logging (console + rotating file)
├── utils.py                  # HTTP session, retry/backoff, throttle, hashing
├── requirements.txt          # requests, pandas, beautifulsoup4, lxml, tqdm
└── README.md                 # install/run, data schema, robots/rate-limit/ToS writeup
```
Playwright NOT needed (clean JSON API found). requirements lists it only as an optional note.

## 5. Data schema
**`blood_stock_long.csv`** (primary; one row per bank×component×blood_group):
`search_timestamp` (UTC ISO), `state_code`, `state_name`, `district`, `blood_bank_id`,
`blood_bank_name`, `address`, `hospital_type`, `is_online`, `stock_last_updated`,
`component_type`, `blood_group`, `available_units`, `bank_total_units`, `phones`, `emails`,
`record_hash`.

**`blood_banks.csv`** (dimension/registry; one row per bank): `blood_bank_id`, `blood_bank_name`,
`address`, `district`, `state_name`, `state_code`, `hospital_type`, `phones`, `emails`,
`bank_total_units`, `is_online`, `stock_last_updated`, `first_seen`, `last_seen`.

PII decision: keep **institutional** blood-bank `phones`/`emails` (public desk contacts). No patient
data exists in this source.

## 6. Reliability behaviors
- **Throttle:** ~1.5s + random jitter between requests (polite; user chose "polite + authorized").
- **Retry:** exponential backoff (e.g. 1s,2s,4s,8s) on 429/5xx/connection/timeout; max 5 tries.
- **Timeout:** 60s/request (state 28 needs it).
- **Dedup:** SHA1 `record_hash` over `(bank_id, component, blood_group, stock_last_updated, units)`;
  drop exact dupes within a snapshot.
- **Incremental = time series:** each run appends a new **timestamped snapshot**; never overwrites,
  so history accumulates for forecasting. Registry CSV upserts (first_seen/last_seen).
- **Checkpoint/resume:** JSON checkpoint records `run_id` + completed state codes; resume skips
  done states. `--fresh` starts a new run.
- **Progress:** tqdm bar + logged `states X/35, banks N, rows M`.
- **Logging:** structured, console + rotating file under `logs/`.

## 7. robots.txt / rate-limit / ToS (documented in README)
- `bloodwarriors.in/robots.txt` has `Disallow: /api/`; both data endpoints are under `/api/`.
- Decision (user): **proceed under host-org authorization** (Blood Warriors is the hackathon host
  and provided this portal), with conservative throttling, a clear User-Agent, and no scraping of
  any disallowed non-data paths. README states this explicitly.
- Rate-limit: no documented limit; we self-limit to ~0.7 req/s. Backoff on 429.
- ToS: public, non-personal inventory data; institutional contacts retained, no patient PII.

## 8. Out of scope (YAGNI)
- Geocoding/lat-long (skipped per user; address retained for later geocoding).
- Database server (CSV only).
- Full dropdown permutation crawl (redundant; see §3).
- Playwright (not needed).

## 9. CLI surface (collect_data.py)
```
python -m project.collect_data [--states 28,21 | --all] [--with-stock-only/--all-banks]
                               [--out-dir data/] [--resume/--fresh] [--throttle 1.5]
                               [--verify-filters]
python -m project.discover_filters --out filters.json
```
