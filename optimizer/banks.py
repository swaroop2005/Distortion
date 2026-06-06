"""Bank-level data layer: join the registry with per-bank red-cell stock.

This is what makes the optimizer reason about *individual blood banks* rather than
faceless district totals. It joins:

  * ``blood_banks.csv``      — registry: name, address, district, state, type,
                               total capacity, contacts, online status.
  * ``blood_stock_long.csv`` — per-bank available units by component & blood group.

into a list of bank nodes, each carrying its red-cell stock matrix and (where
known, i.e. Telangana) a district centroid for distance calculations.
"""

from __future__ import annotations

import csv
from collections import defaultdict

from .config import RED_CELL_COMPONENTS, REPO_ROOT, UNKNOWN_GROUP, Settings, normalize_group
from .geo import TELANGANA_CENTROIDS

REGISTRY_CSV = REPO_ROOT / "data" / "blood_banks.csv"


def _to_int(s) -> int:
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return 0


def load_registry() -> dict[str, dict]:
    """Load ``blood_banks.csv`` keyed by bank id."""
    reg: dict[str, dict] = {}
    if not REGISTRY_CSV.exists():
        return reg
    with open(REGISTRY_CSV, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            bid = row.get("blood_bank_id")
            if not bid:
                continue
            reg[bid] = {
                "name": row.get("blood_bank_name") or f"Bank {bid}",
                "address": row.get("address") or "",
                "district": row.get("district") or "",
                "state": row.get("state_name") or "",
                "type": row.get("hospital_type") or "",
                "total_units": _to_int(row.get("bank_total_units")),
                "phones": row.get("phones") or "",
                "emails": row.get("emails") or "",
                "is_online": (row.get("is_online") or "").strip().lower() == "true",
            }
    return reg


def load_banks(settings: Settings, *, national: bool = False) -> list[dict]:
    """Build bank nodes with red-cell stock, enriched from the registry.

    When ``national`` is False, only banks in ``settings.region`` are returned.
    Each bank: ``{id, name, address, district, state, type, total_units, phones,
    emails, is_online, lat, lng, stock: {group: units}}``.
    """
    registry = load_registry()

    stock: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    geo: dict[str, tuple[str, str]] = {}  # bank_id -> (district, state) fallback

    with open(settings.supply_csv, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if not national and row.get("state_name") != settings.region:
                continue
            if row.get("component_type") not in RED_CELL_COMPONENTS:
                continue
            bid = row.get("blood_bank_id")
            if not bid:
                continue
            group = normalize_group(row.get("blood_group"))
            if group == UNKNOWN_GROUP:
                continue
            units = _to_int(row.get("available_units"))
            if units <= 0:
                continue
            stock[bid][group] += units
            geo.setdefault(bid, (row.get("district") or "", row.get("state_name") or ""))

    banks: list[dict] = []
    for bid, groups in stock.items():
        meta = registry.get(bid, {})
        district = meta.get("district") or geo.get(bid, ("", ""))[0]
        state = meta.get("state") or geo.get(bid, ("", ""))[1]
        centroid = TELANGANA_CENTROIDS.get(district)
        banks.append({
            "id": bid,
            "name": meta.get("name") or f"Bank {bid}",
            "address": meta.get("address", ""),
            "district": district,
            "state": state,
            "type": meta.get("type", ""),
            "total_units": meta.get("total_units", sum(groups.values())),
            "phones": meta.get("phones", ""),
            "emails": meta.get("emails", ""),
            "is_online": meta.get("is_online", False),
            "lat": centroid[0] if centroid else None,
            "lng": centroid[1] if centroid else None,
            "stock": dict(groups),
        })
    return banks


def banks_in_district(banks: list[dict], district: str) -> list[dict]:
    return [b for b in banks if b["district"] == district]
