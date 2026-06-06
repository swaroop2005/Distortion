"""Supply load from the scraped national blood-stock CSV.

Focuses on transfusable red-cell components (the thalassemia need) and aggregates
available units per (district, blood group) within the configured region, plus a
state-level rollup per blood group.
"""

from __future__ import annotations

import csv
from collections import defaultdict

from .config import RED_CELL_COMPONENTS, UNKNOWN_GROUP, Settings, normalize_group


def build_supply(settings: Settings) -> dict:
    """Aggregate red-cell supply for the configured region.

    Returns ``{'region', 'by_district_group', 'by_group', 'banks'}`` where the
    first two map to integer available-unit totals, and ``banks`` counts distinct
    blood banks contributing supply (for reporting).
    """
    by_dg: dict[tuple[str, str], int] = defaultdict(int)
    by_g: dict[str, int] = defaultdict(int)
    banks: set[str] = set()

    with open(settings.supply_csv, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row.get("state_name") != settings.region:
                continue
            if row.get("component_type") not in RED_CELL_COMPONENTS:
                continue
            group = normalize_group(row.get("blood_group"))
            if group == UNKNOWN_GROUP:
                continue
            try:
                units = int(float(row.get("available_units") or 0))
            except ValueError:
                continue
            if units <= 0:
                continue
            district = row.get("district") or "Unknown"
            by_dg[(district, group)] += units
            by_g[group] += units
            if row.get("blood_bank_id"):
                banks.add(row["blood_bank_id"])

    return {
        "region": settings.region,
        "by_district_group": dict(by_dg),
        "by_group": dict(by_g),
        "banks": len(banks),
    }


def district_supply(supply: dict, group: str) -> dict[str, int]:
    """Units available for ``group`` keyed by district (for the optimizer nodes)."""
    return {
        district: units
        for (district, g), units in supply["by_district_group"].items()
        if g == group and units > 0
    }
