"""Reporting: write plan CSVs and print a command-center summary."""

from __future__ import annotations

import csv
from pathlib import Path

from .gap import GroupGap

SHORTAGE_COLUMNS = [
    "blood_group", "supply_units", "horizon_demand", "daily_demand",
    "days_of_coverage", "status", "shortfall_units",
]
TRANSFER_COLUMNS = [
    "mode", "blood_group", "units", "distance_km",
    "from_bank", "from_district", "from_type", "from_capacity",
    "to_bank", "to_district", "to_type", "to_capacity", "reason",
]
MOBILIZATION_COLUMNS = [
    "region", "district", "blood_group", "donor_id", "donor_group",
    "distance_km", "eligibility", "next_eligible_date", "rank", "units_contributed",
]
UNDER_SAFETY_COLUMNS = ["bank", "district", "state", "blood_group", "short_units"]


def _write_csv(path: Path, columns: list[str], rows: list[dict]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_outputs(
    out_dir: Path,
    gaps: list[GroupGap],
    transfers: list[dict],
    mobilization: list[dict],
    under_safety: list[dict] | None = None,
) -> dict[str, Path]:
    """Write the plan CSVs; return their paths."""
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "shortage": out_dir / "shortage_report.csv",
        "transfers": out_dir / "transfer_plan.csv",
        "mobilization": out_dir / "mobilization_plan.csv",
        "under_safety": out_dir / "under_safety.csv",
    }
    _write_csv(paths["shortage"], SHORTAGE_COLUMNS, [g.as_row() for g in gaps])
    _write_csv(paths["transfers"], TRANSFER_COLUMNS, transfers)
    _write_csv(paths["mobilization"], MOBILIZATION_COLUMNS, mobilization)
    _write_csv(paths["under_safety"], UNDER_SAFETY_COLUMNS, under_safety or [])
    return paths


def print_summary(
    demand: dict,
    supply: dict,
    gaps: list[GroupGap],
    transfers: list[dict],
    mobilization: list[dict],
    paths: dict[str, Path],
    under_safety: list[dict] | None = None,
) -> None:
    """Print the human-readable command-center briefing."""
    region = demand["region"]
    print("\n" + "=" * 72)
    print(f"  BLOOD SUPPLY COMMAND CENTER  —  {region}")
    print(f"  as-of {demand['as_of']}  ·  horizon {demand['horizon_days']} days"
          f"  ·  {supply['banks']} banks supplying")
    print("=" * 72)

    print("\n  COVERAGE BY BLOOD GROUP (worst first)")
    print(f"  {'grp':>4} {'supply':>7} {'demand':>8} {'days':>7}  status")
    print("  " + "-" * 42)
    for g in gaps:
        r = g.as_row()
        print(f"  {r['blood_group']:>4} {r['supply_units']:>7} "
              f"{r['horizon_demand']:>8} {str(r['days_of_coverage']):>7}  {r['status']}")

    demand_t = [t for t in transfers if t["mode"] == "demand"]
    rebal_t = [t for t in transfers if t["mode"] == "rebalance"]

    if demand_t:
        units = sum(t["units"] for t in demand_t)
        print(f"\n  DEMAND-DRIVEN TRANSFERS: {len(demand_t)} moves, {units} units")
        for t in sorted(demand_t, key=lambda x: -x["units"])[:6]:
            print(f"    {t['from_bank']} ({t['from_district']}) → "
                  f"{t['to_bank']} ({t['to_district']}): {t['units']}u {t['blood_group']}, {t['distance_km']} km")
    if rebal_t:
        units = sum(t["units"] for t in rebal_t)
        print(f"\n  SAFETY-STOCK REBALANCE: {len(rebal_t)} moves, {units} units")
        for t in sorted(rebal_t, key=lambda x: -x["units"])[:6]:
            print(f"    {t['from_bank']} ({t['from_district']}) → "
                  f"{t['to_bank']} ({t['to_district']}): {t['units']}u {t['blood_group']}, {t['distance_km']} km")

    if mobilization:
        by_group: dict[str, int] = {}
        for m in mobilization:
            by_group[m["blood_group"]] = by_group.get(m["blood_group"], 0) + 1
        print(f"\n  DONOR MOBILIZATION (→ ThalNet): {len(mobilization)} donors  "
              f"{ {k: v for k, v in sorted(by_group.items(), key=lambda kv: -kv[1])} }")
    if under_safety:
        print(f"\n  ⚠ {len(under_safety)} bank×group still below safety after rebalance "
              f"(see {paths['under_safety'].name})")

    print(f"\n  outputs written to: {paths['shortage'].parent}")
    print("=" * 72 + "\n")
