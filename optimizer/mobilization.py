"""Donor mobilization plan (the "A" half / ThalNet hand-off).

For each residual deficit that redistribution could not cover, select the minimum
set of eligible, compatible donors nearest the deficit district. Each mobilized
donor contributes one red-cell unit. The resulting list is shaped to be consumed
by the teammate's ThalNet outreach agent.
"""

from __future__ import annotations

import csv
import math
from datetime import date, datetime, timedelta

from .config import DEMAND_CSV, RED_CELL_COMPAT, UNKNOWN_GROUP, Settings, normalize_group
from .geo import TELANGANA_CENTROIDS, point_distance_km

_DONOR_ROLES = {"Emergency Donor", "Bridge Donor", "Volunteer", "One-Time Donor"}


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


def load_donor_pool(settings: Settings) -> list[dict]:
    """Load eligible donors with usable coordinates and a known blood group.

    Eligible = ``eligibility_status == 'eligible'`` OR ``next_eligible_date`` falls
    within the horizon window.
    """
    as_of = _as_of(settings)
    window_end = as_of + timedelta(days=settings.horizon_days)
    donors: list[dict] = []
    with open(DEMAND_CSV, newline="", encoding="utf-8", errors="replace") as fh:
        for row in csv.DictReader(fh):
            if row.get("role") not in _DONOR_ROLES:
                continue
            group = normalize_group(row.get("blood_group"))
            if group == UNKNOWN_GROUP:
                continue
            elig = (row.get("eligibility_status") or "").strip().lower()
            next_elig = _parse_date(row.get("next_eligible_date"))
            eligible = elig == "eligible" or (next_elig is not None and next_elig <= window_end)
            if not eligible:
                continue
            try:
                lat = float(row["latitude"]); lng = float(row["longitude"])
            except (ValueError, KeyError):
                continue
            donors.append({
                "donor_id": row.get("user_id"),
                "group": group,
                "lat": lat,
                "lng": lng,
                "eligibility": elig or "next-window",
                "next_eligible_date": row.get("next_eligible_date") or "",
            })
    return donors


def _compatible_groups(recipient: str, allow_substitution: bool) -> set[str]:
    if allow_substitution:
        return set(RED_CELL_COMPAT.get(recipient, [recipient]))
    return {recipient}


def build_mobilization_plan(residual: dict, settings: Settings) -> list[dict]:
    """Assign nearest eligible compatible donors to cover residual deficits.

    ``residual[(district, group)] = units`` from redistribution. Each donor is used
    at most once across all deficits (greedy nearest-first, largest deficit first).
    """
    if not residual:
        return []
    pool = load_donor_pool(settings)
    used: set[str] = set()
    plan: list[dict] = []

    # cover the biggest residual deficits first
    for (district, group), need in sorted(residual.items(), key=lambda kv: -kv[1]):
        if district not in TELANGANA_CENTROIDS:
            continue
        needed = math.ceil(need)
        compat = _compatible_groups(group, settings.allow_substitution)
        # rank candidate donors by distance to the deficit district
        candidates = sorted(
            (d for d in pool if d["group"] in compat and d["donor_id"] not in used),
            key=lambda d: point_distance_km(d["lat"], d["lng"], district),
        )
        for rank, donor in enumerate(candidates[:needed], start=1):
            used.add(donor["donor_id"])
            plan.append({
                "region": settings.region,
                "district": district,
                "blood_group": group,
                "donor_id": donor["donor_id"],
                "donor_group": donor["group"],
                "distance_km": point_distance_km(donor["lat"], donor["lng"], district),
                "eligibility": donor["eligibility"],
                "next_eligible_date": donor["next_eligible_date"],
                "rank": rank,
                "units_contributed": 1,
            })
    return plan
