"""Bank-to-bank redistribution optimizer (two modes).

Nodes are *individual blood banks* (real stock + registry metadata), so every
recommended transfer names a real source and destination bank with its district,
type, capacity, and the distance between them.

Two modes:
  * **demand**    — cover patient-demand deficits per district (Telangana): surplus
                    banks ship to the hub bank of each deficit district.
  * **rebalance** — bring every bank up to a safety-stock level per blood group
                    (works nationally); below-safety banks pull from surplus banks.

Both reduce to a generic transshipment solved with PuLP/CBC (small instances) or a
deterministic greedy nearest-source fallback (always available; used for large
national instances too).
"""

from __future__ import annotations

import math
from collections import defaultdict

from .config import W_DISTANCE, W_UNMET, Settings
from .geo import bank_distance

# Above this many source×sink pairs we skip the MILP and use greedy (keeps the
# national rebalance fast and avoids a giant solver model).
_MILP_PAIR_LIMIT = 4000


def _transfer(src: dict, dst: dict, group: str, units: int, mode: str) -> dict:
    dist = bank_distance(src, dst)
    return {
        "mode": mode,
        "blood_group": group,
        "units": units,
        "distance_km": dist,
        "from_bank_id": src["id"], "from_bank": src["name"],
        "from_district": src["district"], "from_state": src["state"], "from_type": src["type"],
        "from_capacity": src["total_units"],
        "to_bank_id": dst["id"], "to_bank": dst["name"],
        "to_district": dst["district"], "to_state": dst["state"], "to_type": dst["type"],
        "to_capacity": dst["total_units"],
        "reason": f"{units}u {group}: {src['name']} → {dst['name']} ({dist} km)",
    }


# --------------------------------------------------------------------------- #
# Generic transshipment over bank nodes
# --------------------------------------------------------------------------- #
def _solve_milp(srcs, snks, group, mode):
    try:
        import pulp  # type: ignore
    except ImportError:
        return None
    prob = pulp.LpProblem("redis", pulp.LpMinimize)
    x = {(i, j): pulp.LpVariable(f"x_{i}_{j}", lowBound=0, cat="Integer")
         for i in range(len(srcs)) for j in range(len(snks))}
    unmet = {j: pulp.LpVariable(f"u_{j}", lowBound=0) for j in range(len(snks))}
    prob += (
        W_UNMET * pulp.lpSum(unmet.values())
        + W_DISTANCE * pulp.lpSum(
            x[i, j] * bank_distance(srcs[i][0], snks[j][0])
            for i in range(len(srcs)) for j in range(len(snks)))
    )
    for i, (_b, cap) in enumerate(srcs):
        prob += pulp.lpSum(x[i, j] for j in range(len(snks))) <= int(cap)
    for j, (_b, need) in enumerate(snks):
        prob += pulp.lpSum(x[i, j] for i in range(len(srcs))) + unmet[j] >= need
    prob.solve(pulp.PULP_CBC_CMD(msg=False))
    out = []
    for (i, j), var in x.items():
        u = int(round(var.value() or 0))
        if u > 0:
            out.append(_transfer(srcs[i][0], snks[j][0], group, u, mode))
    return out


def _greedy(srcs, snks, group, mode):
    avail = [[b, int(cap)] for b, cap in srcs]
    transfers = []
    for sink_bank, need in sorted(snks, key=lambda kv: -kv[1]):
        remaining = math.ceil(need)
        for entry in sorted(avail, key=lambda e: bank_distance(e[0], sink_bank)):
            if remaining <= 0:
                break
            move = min(entry[1], remaining)
            if move <= 0:
                continue
            entry[1] -= move
            remaining -= move
            transfers.append(_transfer(entry[0], sink_bank, group, move, mode))
    return transfers


def _transship(sources, sinks, group: str, mode: str, use_solver: bool):
    """Solve one group's transshipment; return (transfers, received_by_sink_id)."""
    srcs = [(b, math.floor(c)) for b, c in sources if c >= 1]
    snks = [(b, need) for b, need in sinks if need > 0.5]
    if not srcs or not snks:
        return [], {}
    plan = None
    if use_solver and len(srcs) * len(snks) <= _MILP_PAIR_LIMIT:
        plan = _solve_milp(srcs, snks, group, mode)
    if plan is None:
        plan = _greedy(srcs, snks, group, mode)
    received: dict[str, int] = defaultdict(int)
    for t in plan:
        received[t["to_bank_id"]] += t["units"]
    return plan, received


# --------------------------------------------------------------------------- #
# Mode: demand-driven (per-district patient demand)
# --------------------------------------------------------------------------- #
def _demand_nodes(banks: list[dict], demand: dict, group: str, min_reserve: int):
    by_dist: dict[str, list[dict]] = defaultdict(list)
    for b in banks:
        by_dist[b["district"]].append(b)
    districts = set(by_dist) | {d for (d, g) in demand["by_district_group"] if g == group}

    sources, sinks, direct_residual = [], [], {}
    for dist in districts:
        local = by_dist.get(dist, [])
        supply = sum(b["stock"].get(group, 0) for b in local)
        dem = demand["by_district_group"].get((dist, group), {"units": 0.0})["units"]
        if dem > supply:
            need = dem - supply
            if local:
                hub = max(local, key=lambda b: b["total_units"])
                sinks.append((hub, need))
            else:
                direct_residual[dist] = need  # demand with no local bank to receive
        elif supply > dem and supply > 0:
            ratio = (supply - dem) / supply
            for b in local:
                stock = b["stock"].get(group, 0)
                # give the proportional district surplus, but NEVER drop below the
                # bank's own reserve floor — no bank is drained for someone else.
                cap = min(stock * ratio, max(0.0, stock - min_reserve))
                if cap >= 1:
                    sources.append((b, cap))
    return sources, sinks, direct_residual


def redistribute_demand(banks: list[dict], demand: dict, settings: Settings):
    """Demand-driven bank→bank transfers; residual keyed (district, group)."""
    transfers, residual = [], {}
    groups = {g for (_d, g) in demand["by_district_group"]}
    for group in sorted(groups):
        sources, sinks, direct = _demand_nodes(banks, demand, group, settings.min_reserve)
        for dist, need in direct.items():
            residual[(dist, group)] = round(need, 1)
        plan, received = _transship(sources, sinks, group, "demand", settings.use_solver)
        transfers.extend(plan)
        for hub, need in sinks:
            short = need - received.get(hub["id"], 0)
            if short > 0.5:
                key = (hub["district"], group)
                residual[key] = round(residual.get(key, 0) + short, 1)
    return transfers, residual


# --------------------------------------------------------------------------- #
# Mode: safety-stock rebalance (per-bank target, works nationally)
# --------------------------------------------------------------------------- #
def _rebalance_nodes(banks: list[dict], group: str, safety: int, min_reserve: int):
    floor = max(safety, min_reserve)  # a source never keeps less than the reserve
    sources, sinks = [], []
    for b in banks:
        if group not in b["stock"]:
            continue  # only rebalance among banks that handle this group
        cur = b["stock"][group]
        if cur > floor:
            sources.append((b, cur - floor))
        elif cur < safety:
            sinks.append((b, safety - cur))
    return sources, sinks


def redistribute_rebalance(banks: list[dict], settings: Settings):
    """Bring every bank up to safety stock per group; returns (transfers, under).

    ``under`` lists banks still below safety after rebalancing (no nearby surplus).
    """
    transfers, under = [], []
    groups: set[str] = set()
    for b in banks:
        groups |= set(b["stock"])
    for group in sorted(groups):
        sources, sinks = _rebalance_nodes(banks, group, settings.safety_stock, settings.min_reserve)
        plan, received = _transship(sources, sinks, group, "rebalance", settings.use_solver)
        transfers.extend(plan)
        for b, need in sinks:
            short = need - received.get(b["id"], 0)
            if short > 0.5:
                under.append({"bank": b["name"], "district": b["district"],
                              "state": b["state"], "blood_group": group,
                              "short_units": round(short, 1)})
    return transfers, under
