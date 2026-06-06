"""Supply-side data store — blood_stock_long.csv + blood_banks.csv + optimizer outputs.

Loaded once at import time (lru_cache). Provides filtered query helpers for the
supply router. Blood-group strings from e-RaktKosh ("A+Ve", "O -ve", "Oh+VE")
are normalised to the same canonical form used by compat.py ("A+", "O+", "Bombay").

Proximity helpers use district/state centroids from optimizer.geo (no per-bank
geocoding, since the e-RaktKosh API does not return lat/lon). When the caller
passes a (lat, lon), we find the nearest district centroid and expand the search
to that district + its neighbours.
"""
from __future__ import annotations

import csv
import functools
import math
import os
import sys
from typing import Optional

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STOCK_CSV = os.path.join(HERE, "data", "blood_stock_long.csv")
BANKS_CSV = os.path.join(HERE, "data", "blood_banks.csv")
SHORTAGE_CSV = os.path.join(HERE, "data", "optimizer", "shortage_report.csv")
MOBILIZATION_CSV = os.path.join(HERE, "data", "optimizer", "mobilization_plan.csv")
TRANSFER_CSV = os.path.join(HERE, "data", "optimizer", "transfer_plan.csv")
UNDER_SAFETY_CSV = os.path.join(HERE, "data", "optimizer", "under_safety.csv")

# ──────────────────────────────────────────────
# Blood group normalisation (e-RaktKosh → canonical)
# ──────────────────────────────────────────────
_EK_MAP: dict[str, str] = {
    "a+ve": "A+",  "a-ve": "A-",
    "a +ve": "A+", "a -ve": "A-",
    "b+ve": "B+",  "b-ve": "B-",
    "b +ve": "B+", "b -ve": "B-",
    "o+ve": "O+",  "o-ve": "O-",
    "o +ve": "O+", "o -ve": "O-",
    "ab+ve": "AB+",  "ab-ve": "AB-",
    "ab +ve": "AB+", "ab -ve": "AB-",
    "oh+ve": "Bombay",  "oh-ve": "Bombay",
    "oh +ve": "Bombay", "oh -ve": "Bombay",
    "oh+ve": "Bombay",  "oh-ve": "Bombay",
}

# Status thresholds (days of coverage)
STATUS_CRITICAL = 7
STATUS_LOW = 21


def norm_bg(raw: Optional[str]) -> Optional[str]:
    """Normalise e-RaktKosh blood group string → canonical ("A+", "O-", etc.)."""
    if not raw:
        return None
    return _EK_MAP.get(raw.strip().lower())


# ──────────────────────────────────────────────
# Geo helpers — district / state centroids
# ──────────────────────────────────────────────
def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def _load_centroids() -> tuple[dict[str, tuple], dict[str, tuple]]:
    """Import from optimizer package, falling back to empty dicts."""
    try:
        sys.path.insert(0, HERE)
        from optimizer.geo import TELANGANA_CENTROIDS, STATE_CENTROIDS  # type: ignore
        return TELANGANA_CENTROIDS, STATE_CENTROIDS
    except ImportError:
        return {}, {}


_DISTRICT_CENTROIDS, _STATE_CENTROIDS = _load_centroids()


def nearest_districts(lat: float, lon: float, top_n: int = 3) -> list[str]:
    """Return the N nearest known district names to (lat, lon), sorted closest-first."""
    if not _DISTRICT_CENTROIDS:
        return []
    distances = [
        (d, _haversine_km((lat, lon), c))
        for d, c in _DISTRICT_CENTROIDS.items()
    ]
    distances.sort(key=lambda x: x[1])
    return [d for d, _ in distances[:top_n]]


def nearest_state(lat: float, lon: float) -> Optional[str]:
    """Return the state whose centroid is closest to (lat, lon)."""
    if not _STATE_CENTROIDS:
        return None
    distances = [
        (s, _haversine_km((lat, lon), c))
        for s, c in _STATE_CENTROIDS.items()
    ]
    return min(distances, key=lambda x: x[1])[0]


def district_to_state(district: str) -> Optional[str]:
    """Best-effort reverse lookup: district name → state name via stock data."""
    rows = _load_stock()
    for r in rows:
        if r.get("district", "").lower() == district.lower():
            return r.get("state_name")
    return None


# ──────────────────────────────────────────────
# CSV loaders (cached)
# ──────────────────────────────────────────────
@functools.lru_cache(maxsize=1)
def _load_stock() -> tuple[dict, ...]:
    rows = []
    with open(STOCK_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            bg = norm_bg(row.get("blood_group", ""))
            row["blood_group_canonical"] = bg or row.get("blood_group", "")
            rows.append(row)
    return tuple(rows)


@functools.lru_cache(maxsize=1)
def _load_banks() -> dict:
    banks: dict[str, dict] = {}
    with open(BANKS_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            banks[row["blood_bank_id"]] = row
    return banks


def _read_csv(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ──────────────────────────────────────────────
# Stock query helpers
# ──────────────────────────────────────────────
def _filter_stock(
    state: Optional[str],
    district: Optional[str],
    blood_group: Optional[str],
    component_type: Optional[str],
) -> list[dict]:
    rows = list(_load_stock())
    if state:
        s = state.lower()
        rows = [r for r in rows if r.get("state_name", "").lower() == s]
    if district:
        d = district.lower()
        rows = [r for r in rows if r.get("district", "").lower() == d]
    if blood_group:
        bg = blood_group.upper().strip()
        rows = [r for r in rows if r.get("blood_group_canonical") == bg]
    if component_type:
        ct = component_type.lower()
        rows = [r for r in rows if r.get("component_type", "").lower() == ct]
    return rows


def stock_summary(
    state: Optional[str] = None,
    district: Optional[str] = None,
    blood_group: Optional[str] = None,
    component_type: Optional[str] = None,
) -> dict:
    """Aggregate available blood stock with totals by group + component."""
    rows = _filter_stock(state, district, blood_group, component_type)

    by_group: dict[str, int] = {}
    by_component: dict[str, int] = {}
    bank_ids: set[str] = set()
    by_district: dict[str, int] = {}
    total_units = 0

    for r in rows:
        units = int(r.get("available_units", 0) or 0)
        bg = r.get("blood_group_canonical", "")
        comp = r.get("component_type", "")
        dist = r.get("district", "Unknown")
        bid = r.get("blood_bank_id", "")

        by_group[bg] = by_group.get(bg, 0) + units
        by_component[comp] = by_component.get(comp, 0) + units
        by_district[dist] = by_district.get(dist, 0) + units
        bank_ids.add(bid)
        total_units += units

    # Sort blood groups scarcest-first so admin sees the risks immediately
    bg_list = sorted(by_group.items(), key=lambda x: x[1])
    comp_list = sorted(by_component.items(), key=lambda x: x[1], reverse=True)
    dist_list = sorted(by_district.items(), key=lambda x: x[1], reverse=True)

    return {
        "total_banks": len(bank_ids),
        "total_units": total_units,
        "by_blood_group": [{"blood_group": k, "units": v} for k, v in bg_list],
        "by_component": [{"component": k, "units": v} for k, v in comp_list],
        "top_districts_by_units": [
            {"district": k, "units": v} for k, v in dist_list[:20]
        ],
        "filters_applied": {
            "state": state,
            "district": district,
            "blood_group": blood_group,
            "component_type": component_type,
        },
    }


def banks_with_stock(
    district: Optional[str] = None,
    state: Optional[str] = None,
    blood_group: Optional[str] = None,
    component_type: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_districts: int = 3,
    min_units: int = 1,
    limit: int = 50,
) -> list[dict]:
    """Blood banks that have available stock, enriched with registry contact info.

    When (lat, lon) provided and no district/state filter: auto-resolves to the
    nearest districts, so donors/patients can query "what's near me?".
    """
    # Geo-proximity auto-filter when no explicit district/state given
    resolved_districts: Optional[list[str]] = None
    if lat is not None and lon is not None and not district and not state:
        resolved_districts = nearest_districts(lat, lon, top_n=radius_districts)
        if not resolved_districts:
            state = nearest_state(lat, lon)

    bank_registry = _load_banks()

    # Aggregate across all matching rows → one entry per (bank × blood_group × component)
    agg: dict[str, dict] = {}

    def _process_districts(districts: list[str]) -> None:
        for dist in districts:
            rows = _filter_stock(state=None, district=dist, blood_group=blood_group,
                                 component_type=component_type)
            _add_rows(rows)

    def _add_rows(rows: list[dict]) -> None:
        for r in rows:
            units = int(r.get("available_units", 0) or 0)
            if units < min_units:
                continue
            bg = r.get("blood_group_canonical", "")
            comp = r.get("component_type", "")
            bid = r.get("blood_bank_id", "")
            key = f"{bid}|{bg}|{comp}"
            if key not in agg:
                reg = bank_registry.get(bid, {})
                dist_name = r.get("district", "")
                dist_coords = _DISTRICT_CENTROIDS.get(dist_name)
                dist_km = None
                if lat is not None and lon is not None and dist_coords:
                    dist_km = round(_haversine_km((lat, lon), dist_coords), 1)
                agg[key] = {
                    "bank_id": bid,
                    "name": r.get("blood_bank_name", ""),
                    "district": dist_name,
                    "state": r.get("state_name", ""),
                    "address": r.get("address", ""),
                    "hospital_type": r.get("hospital_type", ""),
                    "blood_group": bg,
                    "component_type": comp,
                    "available_units": units,
                    "bank_total_units": int(r.get("bank_total_units", 0) or 0),
                    "last_updated": r.get("stock_last_updated", ""),
                    "is_online": r.get("is_online", ""),
                    "phones": reg.get("phones") or r.get("phones", ""),
                    "emails": reg.get("emails") or r.get("emails", ""),
                    "approx_km_from_query": dist_km,
                }
            else:
                agg[key]["available_units"] += units

    if resolved_districts:
        _process_districts(resolved_districts)
    else:
        rows = _filter_stock(state, district, blood_group, component_type)
        _add_rows(rows)

    # Sort: if geo query, nearest-first then units desc; otherwise units desc
    result = list(agg.values())
    if lat is not None and lon is not None:
        result.sort(key=lambda x: (x.get("approx_km_from_query") or 9999, -x["available_units"]))
    else:
        result.sort(key=lambda x: -x["available_units"])

    return result[:limit]


# ──────────────────────────────────────────────
# Optimizer output readers
# ──────────────────────────────────────────────
def shortage_report() -> list[dict]:
    """Pre-computed optimizer shortage/coverage report (shortage_report.csv)."""
    return _read_csv(SHORTAGE_CSV)


def mobilization_plan(
    blood_group: Optional[str] = None,
    district: Optional[str] = None,
    limit: int = 200,
) -> list[dict]:
    """Pre-computed donor mobilization list from the optimizer (mobilization_plan.csv)."""
    rows = _read_csv(MOBILIZATION_CSV)
    if blood_group:
        rows = [r for r in rows if r.get("blood_group") == blood_group]
    if district:
        rows = [r for r in rows if r.get("district", "").lower() == district.lower()]
    return rows[:limit]


def transfer_plan(
    blood_group: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    """Pre-computed bank-to-bank transfer plan (transfer_plan.csv)."""
    rows = _read_csv(TRANSFER_CSV)
    if blood_group:
        rows = [r for r in rows if r.get("blood_group") == blood_group]
    return rows[:limit]


def under_safety_banks(
    state: Optional[str] = None,
    blood_group: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    """Banks still below safety stock after rebalancing (under_safety.csv)."""
    rows = _read_csv(UNDER_SAFETY_CSV)
    if state:
        rows = [r for r in rows if r.get("state", "").lower() == state.lower()]
    if blood_group:
        rows = [r for r in rows if r.get("blood_group") == blood_group]
    return rows[:limit]


def national_kpis() -> dict:
    """Single-call KPI snapshot for the admin dashboard header."""
    rows = list(_load_stock())
    total_banks = len({r["blood_bank_id"] for r in rows})
    total_units = sum(int(r.get("available_units", 0) or 0) for r in rows)
    states = len({r.get("state_name") for r in rows})

    shortage = shortage_report()
    critical = [r for r in shortage if r.get("status") == "CRITICAL"]
    low_cov = [r for r in shortage if r.get("status") == "LOW"]

    mob = _read_csv(MOBILIZATION_CSV)
    donors_to_mobilize = len(mob)

    return {
        "total_banks_indexed": total_banks,
        "total_units_nationwide": total_units,
        "states_covered": states,
        "critical_blood_groups": [r["blood_group"] for r in critical],
        "low_coverage_groups": [r["blood_group"] for r in low_cov],
        "donors_to_mobilize": donors_to_mobilize,
        "shortage_report_available": bool(shortage),
    }
