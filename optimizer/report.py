"""Reporting: write plan CSVs and print a command-center summary."""

from __future__ import annotations

import csv
from pathlib import Path

from .gap import GroupGap

SHORTAGE_COLUMNS = [
    "blood_group", "supply_units", "horizon_demand", "daily_demand",
    "days_of_coverage", "status", "shortfall_units",
]
TRANSFER_COLUMNS = ["from_district", "to_district", "blood_group", "units", "distance_km", "reason"]
MOBILIZATION_COLUMNS = [
    "region", "district", "blood_group", "donor_id", "donor_group",
    "distance_km", "eligibility", "next_eligible_date", "rank", "units_contributed",
]


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
) -> dict[str, Path]:
    """Write the three plan CSVs; return their paths."""
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "shortage": out_dir / "shortage_report.csv",
        "transfers": out_dir / "transfer_plan.csv",
        "mobilization": out_dir / "mobilization_plan.csv",
    }
    _write_csv(paths["shortage"], SHORTAGE_COLUMNS, [g.as_row() for g in gaps])
    _write_csv(paths["transfers"], TRANSFER_COLUMNS, transfers)
    _write_csv(paths["mobilization"], MOBILIZATION_COLUMNS, mobilization)
    return paths


def print_summary(
    demand: dict,
    supply: dict,
    gaps: list[GroupGap],
    transfers: list[dict],
    mobilization: list[dict],
    paths: dict[str, Path],
) -> None:
    """Print the human-readable command-center briefing."""
    region = demand["region"]
    print("\n" + "=" * 68)
    print(f"  BLOOD SUPPLY COMMAND CENTER  —  {region}")
    print(f"  as-of {demand['as_of']}  ·  horizon {demand['horizon_days']} days"
          f"  ·  {supply['banks']} banks supplying")
    print("=" * 68)

    print("\n  COVERAGE BY BLOOD GROUP (worst first)")
    print(f"  {'grp':>4} {'supply':>7} {'demand':>7} {'days':>6}  status")
    print("  " + "-" * 40)
    for g in gaps:
        r = g.as_row()
        print(f"  {r['blood_group']:>4} {r['supply_units']:>7} "
              f"{r['horizon_demand']:>7} {str(r['days_of_coverage']):>6}  {r['status']}")

    crit = [g for g in gaps if g.status == "CRITICAL"]
    if crit:
        print(f"\n  ⚠ CRITICAL groups (<3 days cover): "
              f"{', '.join(g.blood_group for g in crit)}")

    units_moved = sum(t["units"] for t in transfers)
    print(f"\n  REDISTRIBUTION PLAN: {len(transfers)} transfers, {units_moved} units moved")
    for t in transfers[:8]:
        print(f"    {t['from_district']} → {t['to_district']}: "
              f"{t['units']}u {t['blood_group']} ({t['distance_km']} km)")
    if len(transfers) > 8:
        print(f"    … and {len(transfers) - 8} more (see {paths['transfers'].name})")

    print(f"\n  DONOR MOBILIZATION (ThalNet hand-off): {len(mobilization)} donors")
    by_group: dict[str, int] = {}
    for m in mobilization:
        by_group[m["blood_group"]] = by_group.get(m["blood_group"], 0) + 1
    for grp, n in sorted(by_group.items(), key=lambda kv: -kv[1]):
        print(f"    {grp}: mobilize {n} donor(s)")

    print(f"\n  outputs written to: {paths['shortage'].parent}")
    print("=" * 68 + "\n")
