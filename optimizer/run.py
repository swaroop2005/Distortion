"""CLI orchestrator: demand → supply → gap → redistribute → mobilize → report.

Usage:
  python -m optimizer.run                         # Telangana, 30-day horizon
  python -m optimizer.run --horizon-days 14
  python -m optimizer.run --region Telangana --greedy
  python -m optimizer.run --allow-substitution    # enable O-/compatible donors
"""

from __future__ import annotations

import argparse

from .config import Settings
from .demand import build_demand
from .gap import compute_group_gaps
from .mobilization import build_mobilization_plan
from .redistribution import optimize_redistribution
from .report import print_summary, write_outputs
from .supply import build_supply


def run(settings: Settings) -> dict:
    """Execute the full pipeline; returns a dict of results and output paths."""
    settings.ensure_dirs()

    demand = build_demand(settings)
    supply = build_supply(settings)
    gaps = compute_group_gaps(demand, supply)
    transfers, residual = optimize_redistribution(demand, supply, settings)
    mobilization = build_mobilization_plan(residual, settings)

    paths = write_outputs(settings.out_dir, gaps, transfers, mobilization)
    print_summary(demand, supply, gaps, transfers, mobilization, paths)
    return {
        "demand": demand, "supply": supply, "gaps": gaps,
        "transfers": transfers, "mobilization": mobilization, "paths": paths,
    }


def build_settings(args: argparse.Namespace) -> Settings:
    s = Settings()
    s.horizon_days = args.horizon_days
    s.as_of = args.as_of
    s.region = args.region
    s.demand_scale = args.demand_scale
    s.use_solver = not args.greedy
    s.allow_substitution = args.allow_substitution
    return s


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Blood supply-chain optimization engine.")
    p.add_argument("--horizon-days", type=int, default=30, help="forecast window (default 30)")
    p.add_argument("--as-of", default=None, help="reference date YYYY-MM-DD (default: today)")
    p.add_argument("--region", default="Telangana", help="state to optimize (default Telangana)")
    p.add_argument("--demand-scale", type=float, default=1.0,
                   help="scale sample demand toward the real patient base (default 1.0)")
    p.add_argument("--greedy", action="store_true", help="force greedy optimizer (skip PuLP MILP)")
    p.add_argument("--allow-substitution", action="store_true",
                   help="allow O-/ABO-compatible donor substitution")
    args = p.parse_args(argv)
    run(build_settings(args))


if __name__ == "__main__":
    main()
