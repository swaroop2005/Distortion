"""Demand forecast from patient transfusion schedules.

Each Bridge patient needs ``quantity_required`` units of their blood group every
``frequency_in_days``, with the next transfusion anchored at
``expected_next_transfusion_date``. Because the provided dataset's dates predate
the run date, we model demand as a **rolling recurrence**: advance each schedule
forward to its next occurrence on/after the as-of date, then count occurrences
inside the horizon window. This matches the lifelong-recurring reality and is
robust to stale anchor dates.

Geography: the dataset has lat/long but no district names, so each patient is
assigned to the nearest Telangana district centroid (the demo region).
"""

from __future__ import annotations

import csv
import math
from collections import defaultdict
from datetime import date, datetime, timedelta

from .config import DEMAND_CSV, UNKNOWN_GROUP, Settings, normalize_group
from .geo import TELANGANA_CENTROIDS, haversine_km

# Telangana bounding box (lat_min, lat_max, lng_min, lng_max) for region filtering.
TG_BBOX = (15.8, 19.95, 77.2, 81.4)


def _parse_date(s: str) -> date | None:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _as_of(settings: Settings) -> date:
    return _parse_date(settings.as_of) or date.today()


def in_telangana(lat: float, lng: float) -> bool:
    la0, la1, lo0, lo1 = TG_BBOX
    return la0 <= lat <= la1 and lo0 <= lng <= lo1


def nearest_district(lat: float, lng: float) -> str:
    """Nearest Telangana district centroid to a point."""
    return min(TELANGANA_CENTROIDS, key=lambda d: haversine_km((lat, lng), TELANGANA_CENTROIDS[d]))


def occurrences_in_window(anchor: date, freq: int, as_of: date, horizon: int) -> int:
    """Count transfusion occurrences within [as_of, as_of+horizon].

    Rolls a recurring schedule forward from ``anchor`` so stale anchor dates still
    produce valid future occurrences. ``freq <= 0`` is treated as a single event.
    """
    end = as_of + timedelta(days=horizon)
    if freq <= 0:
        return 1 if as_of <= anchor <= end else 0
    if anchor < as_of:
        steps = math.ceil((as_of - anchor).days / freq)
        first = anchor + timedelta(days=steps * freq)
    else:
        first = anchor
    if first > end:
        return 0
    return (end - first).days // freq + 1


def build_demand(settings: Settings) -> dict:
    """Forecast demand for the configured region.

    Returns a dict with per-(district, group) and per-group (state rollup) demand:
    ``{'region', 'as_of', 'horizon_days', 'by_district_group', 'by_group'}`` where
    each value is ``{'units': float, 'daily': float, 'patients': int}``.
    """
    as_of = _as_of(settings)
    horizon = settings.horizon_days

    by_dg: dict[tuple[str, str], dict] = defaultdict(lambda: {"units": 0.0, "daily": 0.0, "patients": 0})
    by_g: dict[str, dict] = defaultdict(lambda: {"units": 0.0, "daily": 0.0, "patients": 0})

    with open(DEMAND_CSV, newline="", encoding="utf-8", errors="replace") as fh:
        for row in csv.DictReader(fh):
            qty_raw = (row.get("quantity_required") or "").strip()
            if not qty_raw:
                continue  # not a demand-bearing (patient) record
            group = normalize_group(row.get("blood_group"))
            if group == UNKNOWN_GROUP:
                continue
            try:
                qty = float(qty_raw)
                freq = int(float((row.get("frequency_in_days") or "0").strip() or 0))
                lat = float(row["latitude"]); lng = float(row["longitude"])
            except (ValueError, KeyError):
                continue
            if not in_telangana(lat, lng):
                continue  # demo region only; demand data is TG-centric

            anchor = _parse_date(row.get("expected_next_transfusion_date"))
            if anchor is None:
                continue
            occ = occurrences_in_window(anchor, freq, as_of, horizon)
            scale = settings.demand_scale
            units = occ * qty * scale
            daily = ((qty / freq) if freq > 0 else 0.0) * scale
            district = nearest_district(lat, lng)

            for bucket, key in ((by_dg, (district, group)), (by_g, group)):
                bucket[key]["units"] += units
                bucket[key]["daily"] += daily
                bucket[key]["patients"] += 1

    return {
        "region": settings.region,
        "as_of": as_of.isoformat(),
        "horizon_days": horizon,
        "by_district_group": dict(by_dg),
        "by_group": dict(by_g),
    }
