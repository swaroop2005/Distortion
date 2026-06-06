"""CLI orchestrator: demand → supply → gap → bank-level redistribute → mobilize.

Usage:
  python -m optimizer.run                          # demand mode, Telangana, 30 days
  python -m optimizer.run --mode rebalance         # national safety-stock rebalance
  python -m optimizer.run --mode both              # both
  python -m optimizer.run --demand-scale 30        # model the real patient load
  python -m optimizer.run --safety-stock 10        # rebalance target per bank/group
  python -m optimizer.run --greedy                 # skip the MILP solver
"""

from __future__ import annotations

import argparse

from .banks import load_banks
from .config import Settings
from .demand import build_demand
from .gap import compute_group_gaps
from .mobilization import build_mobilization_plan
from .redistribution import redistribute_demand, redistribute_rebalance
from .report import print_summary, write_outputs
from .supply import build_supply


def run(settings: Settings) -> dict:
    """Execute the full pipeline; returns results and output paths."""
    settings.ensure_dirs()

    demand = build_demand(settings)
    supply = build_supply(settings)                 # district/group aggregate (coverage view)
    gaps = compute_group_gaps(demand, supply)

    transfers: list[dict] = []
    residual: dict = {}
    under_safety: list[dict] = []

    if settings.mode in ("demand", "both"):
        region_banks = load_banks(settings, national=False)
        t, residual = redistribute_demand(region_banks, demand, settings)
        transfers.extend(t)
    if settings.mode in ("rebalance", "both"):
        national_banks = load_banks(settings, national=True)
        t, under_safety = redistribute_rebalance(national_banks, settings)
        transfers.extend(t)

    mobilization = build_mobilization_plan(residual, settings)

    paths = write_outputs(settings.out_dir, gaps, transfers, mobilization, under_safety)
    print_summary(demand, supply, gaps, transfers, mobilization, paths, under_safety)
    return {
        "demand": demand, "supply": supply, "gaps": gaps, "transfers": transfers,
        "mobilization": mobilization, "under_safety": under_safety, "paths": paths,
    }


def build_settings(args: argparse.Namespace) -> Settings:
    s = Settings()
    s.horizon_days = args.horizon_days
    s.as_of = args.as_of
    s.region = args.region
    s.demand_scale = args.demand_scale
    s.mode = args.mode
    s.safety_stock = args.safety_stock
    s.min_reserve = args.min_reserve
    s.use_solver = not args.greedy
    s.allow_substitution = args.allow_substitution
    return s


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Blood supply-chain optimization engine.")
    p.add_argument("--mode", choices=["demand", "rebalance", "both"], default="demand",
                   help="demand-driven (TG) / national safety-stock rebalance / both")
    p.add_argument("--horizon-days", type=int, default=30, help="forecast window (default 30)")
    p.add_argument("--as-of", default=None, help="reference date YYYY-MM-DD (default: today)")
    p.add_argument("--region", default="Telangana", help="state for demand mode (default Telangana)")
    p.add_argument("--demand-scale", type=float, default=1.0,
                   help="scale sample demand toward the real patient base (default 1.0)")
    p.add_argument("--safety-stock", type=int, default=8,
                   help="rebalance target units per bank per group (default 8)")
    p.add_argument("--min-reserve", type=int, default=3,
                   help="units a source bank always keeps per group, never drained (default 3)")
    p.add_argument("--greedy", action="store_true", help="force greedy optimizer (skip PuLP MILP)")
    p.add_argument("--allow-substitution", action="store_true",
                   help="allow O-/ABO-compatible donor substitution")
    args = p.parse_args(argv)
    run(build_settings(args))


if __name__ == "__main__":
    main()
