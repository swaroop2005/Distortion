"""Inter-district redistribution optimizer (the supply-chain "B" half).

For each blood group, districts with surplus red-cell units ship to districts with
a deficit so as to minimize unmet demand first, then transport distance. Solved as
an integer transshipment problem with PuLP/CBC when available, with a deterministic
greedy nearest-surplus fallback otherwise (so the engine always produces a plan).
"""

from __future__ import annotations

import math
from collections import defaultdict

from .config import W_DISTANCE, W_UNMET, Settings
from .geo import district_distance


def _surplus_deficit(demand: dict, supply: dict, group: str) -> tuple[dict, dict]:
    """Per-district surplus (givers) and deficit (receivers) for one group."""
    districts = {d for (d, g) in supply["by_district_group"] if g == group}
    districts |= {d for (d, g) in demand["by_district_group"] if g == group}
    surplus: dict[str, float] = {}
    deficit: dict[str, float] = {}
    for d in districts:
        s = supply["by_district_group"].get((d, group), 0)
        dem = demand["by_district_group"].get((d, group), {"units": 0.0})["units"]
        net = s - dem
        if net > 0:
            surplus[d] = net
        elif net < 0:
            deficit[d] = -net
    return surplus, deficit


def _solve_milp(surplus: dict, deficit: dict, group: str) -> list[dict] | None:
    """Exact integer transshipment via PuLP; returns None if PuLP is unavailable."""
    try:
        import pulp  # type: ignore
    except ImportError:
        return None

    prob = pulp.LpProblem(f"redistribute_{group}", pulp.LpMinimize)
    srcs, sinks = list(surplus), list(deficit)
    x = {
        (i, j): pulp.LpVariable(f"x_{i}_{j}".replace(" ", "_"), lowBound=0, cat="Integer")
        for i in srcs for j in sinks
    }
    unmet = {
        j: pulp.LpVariable(f"u_{j}".replace(" ", "_"), lowBound=0) for j in sinks
    }
    # objective: heavily penalize unmet demand, then transport distance
    prob += (
        W_UNMET * pulp.lpSum(unmet.values())
        + W_DISTANCE * pulp.lpSum(x[i, j] * district_distance(i, j) for i in srcs for j in sinks)
    )
    for i in srcs:  # cannot ship more than the surplus
        prob += pulp.lpSum(x[i, j] for j in sinks) <= math.floor(surplus[i])
    for j in sinks:  # received + unmet meets the deficit
        prob += pulp.lpSum(x[i, j] for i in srcs) + unmet[j] >= deficit[j]
    prob.solve(pulp.PULP_CBC_CMD(msg=False))

    transfers: list[dict] = []
    for (i, j), var in x.items():
        units = int(round(var.value() or 0))
        if units > 0:
            transfers.append(_transfer(i, j, group, units))
    return transfers


def _greedy(surplus: dict, deficit: dict, group: str) -> list[dict]:
    """Greedy fallback: each deficit pulls from its nearest surpluses first."""
    avail = {k: math.floor(v) for k, v in surplus.items()}
    transfers: list[dict] = []
    # satisfy the largest deficits first for a stable, sensible plan
    for sink, need in sorted(deficit.items(), key=lambda kv: -kv[1]):
        remaining = math.ceil(need)
        for src in sorted(avail, key=lambda s: district_distance(s, sink)):
            if remaining <= 0:
                break
            move = min(avail[src], remaining)
            if move <= 0:
                continue
            avail[src] -= move
            remaining -= move
            transfers.append(_transfer(src, sink, group, move))
    return transfers


def _transfer(src: str, sink: str, group: str, units: int) -> dict:
    dist = district_distance(src, sink)
    return {
        "from_district": src,
        "to_district": sink,
        "blood_group": group,
        "units": units,
        "distance_km": dist,
        "reason": f"{units}u {group} surplus→deficit, {dist} km",
    }


def optimize_redistribution(demand: dict, supply: dict, settings: Settings) -> tuple[list[dict], dict]:
    """Run redistribution across all groups.

    Returns ``(transfers, residual)`` where ``residual[(district, group)]`` is the
    deficit still unmet after transfers — the input to donor mobilization.
    """
    transfers: list[dict] = []
    residual: dict[tuple[str, str], float] = {}

    groups = {g for (_d, g) in demand["by_district_group"]}
    for group in sorted(groups):
        surplus, deficit = _surplus_deficit(demand, supply, group)
        if not deficit:
            continue
        plan = None
        if settings.use_solver:
            plan = _solve_milp(surplus, deficit, group)
        if plan is None:  # solver off or unavailable
            plan = _greedy(surplus, deficit, group)
        transfers.extend(plan)

        # residual = deficit minus what was shipped in
        received: dict[str, int] = defaultdict(int)
        for t in plan:
            received[t["to_district"]] += t["units"]
        for sink, need in deficit.items():
            short = need - received.get(sink, 0)
            if short > 0.5:
                residual[(sink, group)] = round(short, 1)

    return transfers, residual
