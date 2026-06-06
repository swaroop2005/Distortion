"""Persistence layer: CSV snapshots, duplicate detection, and checkpointing.

Design:
  * ``blood_stock_long.csv`` accumulates timestamped *snapshots* (append-only) so
    history builds up for forecasting. Within a single snapshot we drop exact
    duplicate rows via ``record_hash``.
  * ``blood_banks.csv`` is a dimension table upserted by ``blood_bank_id``
    (first_seen preserved, last_seen refreshed).
  * ``checkpoint.json`` tracks the active run and which states are already done so
    an interrupted run can resume without refetching.
"""

from __future__ import annotations

import csv
import json
import os
from pathlib import Path
from typing import Any, Iterable

from .config import Settings
from .logger import get_logger
from .parser import LONG_COLUMNS, REGISTRY_COLUMNS

log = get_logger("storage")


# --------------------------------------------------------------------------- #
# Long-format snapshot writer (append-only, dedup within snapshot)
# --------------------------------------------------------------------------- #
class LongStore:
    """Append-only writer for the long-format stock CSV."""

    def __init__(self, path: Path):
        self.path = path
        self._seen_hashes: set[str] = set()
        self._rows_written = 0
        self._dupes_skipped = 0

    def _ensure_header(self) -> None:
        if not self.path.exists() or self.path.stat().st_size == 0:
            with open(self.path, "w", newline="", encoding="utf-8") as fh:
                csv.DictWriter(fh, fieldnames=LONG_COLUMNS).writeheader()

    def append(self, rows: Iterable[dict[str, Any]]) -> int:
        """Append rows, skipping exact duplicates seen earlier in this run."""
        self._ensure_header()
        written = 0
        with open(self.path, "a", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=LONG_COLUMNS, extrasaction="ignore")
            for row in rows:
                h = row.get("record_hash")
                if h in self._seen_hashes:
                    self._dupes_skipped += 1
                    continue
                self._seen_hashes.add(h)
                writer.writerow(row)
                written += 1
        self._rows_written += written
        return written

    @property
    def stats(self) -> dict[str, int]:
        return {"rows_written": self._rows_written, "dupes_skipped": self._dupes_skipped}


# --------------------------------------------------------------------------- #
# Bank registry (upsert by blood_bank_id)
# --------------------------------------------------------------------------- #
class RegistryStore:
    """Upserting writer for the per-bank dimension CSV."""

    def __init__(self, path: Path):
        self.path = path
        self._banks: dict[str, dict[str, Any]] = {}
        self._load_existing()

    def _load_existing(self) -> None:
        if self.path.exists() and self.path.stat().st_size > 0:
            with open(self.path, newline="", encoding="utf-8") as fh:
                for row in csv.DictReader(fh):
                    bid = row.get("blood_bank_id")
                    if bid:
                        self._banks[bid] = row
            log.info("loaded %d existing banks from registry", len(self._banks))

    def upsert(self, rows: Iterable[dict[str, Any]]) -> None:
        for row in rows:
            bid = str(row.get("blood_bank_id"))
            if not bid:
                continue
            existing = self._banks.get(bid)
            if existing:
                # preserve original first_seen; refresh everything else
                row["first_seen"] = existing.get("first_seen", row["first_seen"])
            self._banks[bid] = row

    def flush(self) -> None:
        """Write the full registry atomically."""
        tmp = self.path.with_suffix(".tmp")
        with open(tmp, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=REGISTRY_COLUMNS, extrasaction="ignore")
            writer.writeheader()
            for row in self._banks.values():
                writer.writerow(row)
        os.replace(tmp, self.path)
        log.info("wrote registry (%d banks) -> %s", len(self._banks), self.path)


# --------------------------------------------------------------------------- #
# Checkpoint (resume-from-interruption)
# --------------------------------------------------------------------------- #
class Checkpoint:
    """JSON checkpoint tracking the active run and completed states."""

    def __init__(self, path: Path):
        self.path = path
        self.run_id: str | None = None
        self.completed_states: set[str] = set()

    def load(self) -> None:
        if self.path.exists():
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self.run_id = data.get("run_id")
            self.completed_states = set(data.get("completed_states", []))
            log.info(
                "resumed checkpoint run_id=%s, %d states already done",
                self.run_id, len(self.completed_states),
            )

    def start_run(self, run_id: str, *, resume: bool) -> None:
        """Begin (or continue) a run. ``resume=False`` clears prior progress."""
        if resume and self.path.exists():
            self.load()
        if not resume or self.run_id is None:
            self.run_id = run_id
            self.completed_states = set()
        self._save()

    def mark_done(self, state_code: int | str) -> None:
        self.completed_states.add(str(state_code))
        self._save()

    def is_done(self, state_code: int | str) -> bool:
        return str(state_code) in self.completed_states

    def _save(self) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps(
                {"run_id": self.run_id, "completed_states": sorted(self.completed_states)},
                indent=2,
            ),
            encoding="utf-8",
        )
        os.replace(tmp, self.path)

    def clear(self) -> None:
        self.run_id = None
        self.completed_states = set()
        if self.path.exists():
            self.path.unlink()


def open_stores(settings: Settings) -> tuple[LongStore, RegistryStore, Checkpoint]:
    """Convenience factory wiring all three stores to configured paths."""
    settings.ensure_dirs()
    return (
        LongStore(settings.long_csv),
        RegistryStore(settings.registry_csv),
        Checkpoint(settings.checkpoint_path),
    )
