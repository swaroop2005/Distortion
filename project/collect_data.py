"""Orchestrator: collect blood-stock inventory across states into CSV snapshots.

Pipeline per run:
  1. resolve the target states (all 35, or a CLI subset)
  2. for each not-yet-done state: fetch availability -> parse -> store
  3. checkpoint after each state so the run is resumable
  4. flush the bank registry and report a summary

Usage:
  python -m project.collect_data                 # all states, resume if interrupted
  python -m project.collect_data --states 28,21  # just these state codes
  python -m project.collect_data --all-banks     # include zero-stock banks
  python -m project.collect_data --fresh         # ignore prior checkpoint
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from typing import Any

from . import config
from .config import Settings
from .discover_filters import fetch_states
from .logger import configure_logging, get_logger
from .parser import parse_availability
from .storage import Checkpoint, LongStore, RegistryStore, open_stores
from .utils import HttpClient, HttpError

try:
    from tqdm import tqdm
except ImportError:  # tqdm is optional; degrade to a no-op wrapper
    def tqdm(iterable, **_kwargs):  # type: ignore
        return iterable

log = get_logger("collect")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def resolve_states(
    client: HttpClient, settings: Settings, only: list[str] | None
) -> list[dict[str, Any]]:
    """Return the list of states to collect, optionally filtered to ``only`` codes."""
    states = fetch_states(client, settings)
    if only:
        wanted = {str(c).strip() for c in only}
        states = [s for s in states if str(s.get("code")) in wanted]
        log.info("filtered to %d requested states", len(states))
    return states


def collect_state(
    client: HttpClient,
    settings: Settings,
    state: dict[str, Any],
    long_store: LongStore,
    registry: RegistryStore,
) -> dict[str, Any]:
    """Fetch + parse + store one state. Returns per-state stats."""
    code, name = state.get("code"), state.get("name")
    url = settings.base_url + config.AVAILABILITY_ENDPOINT
    params = {
        "stateCode": code,
        "withStockOnly": "true" if settings.with_stock_only else "false",
    }
    timestamp = _utc_now_iso()
    payload = client.get_json(url, params=params)
    long_rows, registry_rows, meta = parse_availability(
        payload, state_code=code, state_name=name, search_timestamp=timestamp,
    )
    written = long_store.append(long_rows)
    registry.upsert(registry_rows)

    log.info(
        "%s (%s): %d banks, %d stock rows (+%d new), %d districts, fromCache=%s",
        name, code, meta.get("count"), len(long_rows), written,
        len(meta.get("available_districts", [])), meta.get("from_cache"),
    )
    return {"banks": meta.get("count") or 0, "rows": written}


def run(settings: Settings, *, only_states: list[str] | None, fresh: bool) -> dict[str, int]:
    """Execute a full collection run; returns aggregate stats."""
    settings.ensure_dirs()
    long_store, registry, checkpoint = open_stores(settings)

    run_id = datetime.now(timezone.utc).strftime("run-%Y%m%dT%H%M%SZ")
    if fresh:
        checkpoint.clear()
    checkpoint.start_run(run_id, resume=not fresh)
    log.info("starting %s (with_stock_only=%s)", checkpoint.run_id, settings.with_stock_only)

    client = HttpClient(settings)
    totals = {"states_done": 0, "states_failed": 0, "banks": 0, "rows": 0}
    try:
        states = resolve_states(client, settings, only_states)
        pending = [s for s in states if not checkpoint.is_done(s.get("code"))]
        log.info("%d states pending (%d already done)", len(pending), len(states) - len(pending))

        for state in tqdm(pending, desc="states", unit="state"):
            code = state.get("code")
            try:
                stats = collect_state(client, settings, state, long_store, registry)
                totals["banks"] += stats["banks"]
                totals["rows"] += stats["rows"]
                totals["states_done"] += 1
                checkpoint.mark_done(code)
            except HttpError as exc:
                totals["states_failed"] += 1
                log.error("state %s failed permanently, will retry next run: %s", code, exc)
    finally:
        registry.flush()
        client.close()

    log.info(
        "DONE: %d states ok, %d failed | %d banks | %d new stock rows | dupes skipped=%d",
        totals["states_done"], totals["states_failed"], totals["banks"],
        totals["rows"], long_store.stats["dupes_skipped"],
    )
    log.info("outputs: %s | %s", settings.long_csv, settings.registry_csv)
    return totals


def build_settings(args: argparse.Namespace) -> Settings:
    s = Settings()
    if args.throttle is not None:
        s.throttle_seconds = args.throttle
    if args.out_dir:
        from pathlib import Path
        s.data_dir = Path(args.out_dir)
    s.with_stock_only = not args.all_banks
    return s


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Collect blood-stock inventory into CSVs.")
    parser.add_argument("--states", help="comma-separated state codes (default: all)")
    parser.add_argument("--all-banks", action="store_true",
                        help="include banks with zero stock (withStockOnly=false)")
    parser.add_argument("--fresh", action="store_true",
                        help="ignore any existing checkpoint and start a new run")
    parser.add_argument("--throttle", type=float, default=None,
                        help="seconds between requests (default: %.1f)" % config.THROTTLE_SECONDS)
    parser.add_argument("--out-dir", default=None, help="output directory (default: data/)")
    args = parser.parse_args(argv)

    settings = build_settings(args)
    settings.ensure_dirs()
    configure_logging(settings.log_dir)

    only = args.states.split(",") if args.states else None
    run(settings, only_states=only, fresh=args.fresh)


if __name__ == "__main__":
    main()
