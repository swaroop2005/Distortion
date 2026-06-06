"""Gap & coverage analysis: compare demand against supply.

Produces the "command center" view — per blood group at the state level, and per
(district, group) for the optimizer — with a days-of-coverage figure and a
CRITICAL / LOW / OK status.
"""

from __future__ import annotations

from dataclasses import dataclass

from .config import CANONICAL_GROUPS, CRITICAL_DAYS, LOW_DAYS, Settings

_INF = float("inf")


def _status(days: float) -> str:
    if days < CRITICAL_DAYS:
        return "CRITICAL"
    if days < LOW_DAYS:
        return "LOW"
    return "OK"


@dataclass
class GroupGap:
    """State-level gap for one blood group."""

    blood_group: str
    supply_units: int
    horizon_demand: float
    daily_demand: float
    days_of_coverage: float
    status: str
    shortfall_units: float  # demand that supply cannot cover over the horizon

    def as_row(self) -> dict:
        return {
            "blood_group": self.blood_group,
            "supply_units": self.supply_units,
            "horizon_demand": round(self.horizon_demand, 1),
            "daily_demand": round(self.daily_demand, 3),
            "days_of_coverage": (
                "inf" if self.days_of_coverage == _INF else round(self.days_of_coverage, 1)
            ),
            "status": self.status,
            "shortfall_units": round(self.shortfall_units, 1),
        }


def compute_group_gaps(demand: dict, supply: dict) -> list[GroupGap]:
    """State-level gap per blood group, sorted worst-coverage first."""
    gaps: list[GroupGap] = []
    groups = set(demand["by_group"]) | set(supply["by_group"])
    for g in groups:
        d = demand["by_group"].get(g, {"units": 0.0, "daily": 0.0})
        s_units = int(supply["by_group"].get(g, 0))
        daily = d["daily"]
        horizon_demand = d["units"]
        coverage = (s_units / daily) if daily > 0 else _INF
        shortfall = max(0.0, horizon_demand - s_units)
        gaps.append(GroupGap(
            blood_group=g, supply_units=s_units, horizon_demand=horizon_demand,
            daily_demand=daily, days_of_coverage=coverage,
            status=_status(coverage), shortfall_units=shortfall,
        ))
    # worst coverage first; CANONICAL order as tiebreak
    order = {g: i for i, g in enumerate(CANONICAL_GROUPS)}
    gaps.sort(key=lambda x: (x.days_of_coverage, order.get(x.blood_group, 99)))
    return gaps


def district_deficits(demand: dict, supply: dict, group: str) -> dict[str, float]:
    """Per-district shortfall units for one group (demand_units − local supply).

    Only positive deficits are returned — these are the redistribution targets.
    """
    deficits: dict[str, float] = {}
    for (district, g), d in demand["by_district_group"].items():
        if g != group:
            continue
        local_supply = supply["by_district_group"].get((district, group), 0)
        short = d["units"] - local_supply
        if short > 0:
            deficits[district] = round(short, 1)
    return deficits
