"""Supply integration — bridges Layer 1 optimizer data into Layer 2.

Reads:
  - data/blood_stock_long.csv (national e-RaktKosh: 44,675 rows, 3,863 banks)
  - data/blood_banks.csv (bank metadata: district, phones, type)
  - data/optimizer/mobilization_plan.csv (THE SEAM: donors to mobilize)
  - optimizer/geo.py district centroids (banks have no lat/lng)
  - optimizer/config.py normalize_group (stock uses "A+Ve" format)

Exposes:
  - nearby_compatible_banks(blood_group, district) → banks with stock
  - regional_supply_summary(district) → stock by group
  - mobilization_queue() → donors the optimizer selected
"""
from __future__ import annotations

import csv
import functools
import os
from typing import Optional

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STOCK_CSV = os.path.join(HERE, "data", "blood_stock_long.csv")
BANKS_CSV = os.path.join(HERE, "data", "blood_banks.csv")
MOBILIZATION_CSV = os.path.join(HERE, "data", "optimizer", "mobilization_plan.csv")

# Import optimizer's normalize (handles "A+Ve" format)
import sys
sys.path.insert(0, HERE)
from optimizer.config import normalize_group, RED_CELL_COMPAT, RED_CELL_COMPONENTS
from optimizer.geo import TELANGANA_CENTROIDS, haversine_km


@functools.lru_cache(maxsize=1)
def _load_banks() -> dict[str, dict]:
    """bank_id → {name, district, state, type, phones, emails}"""
    banks = {}
    with open(BANKS_CSV, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            banks[row["blood_bank_id"]] = {
                "bank_id": row["blood_bank_id"],
                "name": row["blood_bank_name"],
                "district": row.get("district", ""),
                "state": row.get("state_name", ""),
                "type": row.get("hospital_type", ""),
                "phones": row.get("phones", ""),
                "emails": row.get("emails", ""),
            }
    return banks


@functools.lru_cache(maxsize=1)
def _load_stock() -> list[dict]:
    """Load red-cell stock rows with normalized blood groups."""
    rows = []
    with open(STOCK_CSV, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row.get("component_type") not in RED_CELL_COMPONENTS:
                continue
            group = normalize_group(row.get("blood_group"))
            if group == "UNKNOWN":
                continue
            try:
                units = int(float(row.get("available_units") or 0))
            except ValueError:
                continue
            if units <= 0:
                continue
            rows.append({
                "bank_id": row.get("blood_bank_id", ""),
                "district": row.get("district", ""),
                "state": row.get("state_name", ""),
                "group": group,
                "units": units,
                "component": row.get("component_type", ""),
            })
    return rows


def nearby_compatible_banks(
    patient_group: str,
    patient_district: str,
    max_distance_km: float = 200.0,
    state: str = "Telangana",
) -> list[dict]:
    """Find blood banks with compatible stock near a patient's district.

    Returns banks sorted by distance, with stock counts per compatible group.
    """
    from .compat import normalize_blood_group
    p_norm = normalize_blood_group(patient_group)
    if not p_norm:
        return []

    # Which donor groups can supply this patient
    compat_groups = set(RED_CELL_COMPAT.get(p_norm, [p_norm]))

    stock = _load_stock()
    banks_meta = _load_banks()

    # Aggregate stock per bank for compatible groups
    bank_stock: dict[str, dict] = {}
    for s in stock:
        if s["state"] != state:
            continue
        if s["group"] not in compat_groups:
            continue
        bid = s["bank_id"]
        if bid not in bank_stock:
            bank_stock[bid] = {"total_units": 0, "groups": {}}
        bank_stock[bid]["total_units"] += s["units"]
        bank_stock[bid]["groups"][s["group"]] = (
            bank_stock[bid]["groups"].get(s["group"], 0) + s["units"]
        )

    # Compute distance from patient district to each bank's district
    patient_centroid = TELANGANA_CENTROIDS.get(patient_district)
    results = []
    for bid, stock_info in bank_stock.items():
        meta = banks_meta.get(bid, {})
        bank_district = meta.get("district", "")
        bank_centroid = TELANGANA_CENTROIDS.get(bank_district)

        if patient_centroid and bank_centroid:
            dist = round(haversine_km(patient_centroid, bank_centroid), 1)
        elif bank_district == patient_district:
            dist = 0.0
        else:
            dist = 999.0

        if dist > max_distance_km:
            continue

        results.append({
            "bank_id": bid,
            "name": meta.get("name", ""),
            "district": bank_district,
            "type": meta.get("type", ""),
            "phones": meta.get("phones", ""),
            "distance_km": dist,
            "compatible_units": stock_info["total_units"],
            "stock_by_group": stock_info["groups"],
        })

    results.sort(key=lambda x: x["distance_km"])
    return results


def regional_supply_summary(state: str = "Telangana") -> dict:
    """Aggregate supply by blood group for a state. For patient map view."""
    stock = _load_stock()
    by_group: dict[str, int] = {}
    bank_ids: set[str] = set()

    for s in stock:
        if s["state"] != state:
            continue
        by_group[s["group"]] = by_group.get(s["group"], 0) + s["units"]
        bank_ids.add(s["bank_id"])

    return {
        "state": state,
        "total_units": sum(by_group.values()),
        "active_banks": len(bank_ids),
        "by_group": by_group,
    }


def mobilization_queue() -> list[dict]:
    """Read the optimizer's mobilization plan — donors selected to fill gaps."""
    if not os.path.exists(MOBILIZATION_CSV):
        return []
    rows = []
    with open(MOBILIZATION_CSV, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            rows.append({
                "donor_id": row.get("donor_id", ""),
                "blood_group": row.get("blood_group", ""),
                "donor_group": row.get("donor_group", ""),
                "district": row.get("district", ""),
                "distance_km": float(row.get("distance_km", 0)),
                "eligibility": row.get("eligibility", ""),
                "rank": int(row.get("rank", 0)),
            })
    return rows


def patient_map_data(
    patient_group: str,
    patient_district: str = "Hyderabad",
) -> dict:
    """All data needed for the patient map view."""
    from .store import donors_df, patients_df
    from .compat import normalize_blood_group, compatible_donors_mask
    from .eligibility import is_eligible

    p_norm = normalize_blood_group(patient_group)
    donors = donors_df()
    patients = patients_df()

    # Count active compatible donors in region
    compat_groups = compatible_donors_mask(patient_group)
    compat_donors = donors[
        donors["blood_group"].apply(normalize_blood_group).isin(compat_groups)
    ]
    eligible_compat = sum(1 for _, d in compat_donors.iterrows() if is_eligible(d.to_dict()))

    # Nearby banks with stock
    banks = nearby_compatible_banks(patient_group, patient_district)

    return {
        "patient_blood_group": p_norm,
        "district": patient_district,
        "patients_in_region": len(patients),
        "total_donors_in_region": len(donors),
        "compatible_donors": len(compat_donors),
        "eligible_compatible_donors": eligible_compat,
        "nearby_banks_with_stock": banks[:10],
        "regional_supply": regional_supply_summary(),
    }
