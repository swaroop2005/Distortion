"""Discover and enumerate the portal's filter values.

Produces a ``filters.json`` catalog describing every searchable filter field and
its valid values:

  * states           — live from the /states endpoint (authoritative)
  * districts         — per-state, from each state's availableDistricts
  * blood_groups      — static (server-rendered into the page)
  * components        — static
  * hospital_types    — static

Run standalone:  ``python -m project.discover_filters``
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from typing import Any

from . import config
from .config import Settings
from .logger import configure_logging, get_logger
from .utils import HttpClient

log = get_logger("discover")


def fetch_states(client: HttpClient, settings: Settings) -> list[dict[str, Any]]:
    """Return the authoritative list of states as ``[{name, code}, ...]``."""
    url = settings.base_url + config.STATES_ENDPOINT
    payload = client.get_json(url)
    states = (payload.get("data") or {}).get("states") or []
    log.info("discovered %d states", len(states))
    return states


def fetch_state_districts(
    client: HttpClient, settings: Settings, state_code: int | str
) -> list[str]:
    """Return availableDistricts for a state (a stateCode-only availability call)."""
    url = settings.base_url + config.AVAILABILITY_ENDPOINT
    params = {"stateCode": state_code, "withStockOnly": "true"}
    payload = client.get_json(url, params=params)
    data = payload.get("data") or {}
    return data.get("availableDistricts", []) or []


def build_catalog(
    client: HttpClient, settings: Settings, *, include_districts: bool = True
) -> dict[str, Any]:
    """Assemble the full filter catalog."""
    states = fetch_states(client, settings)
    catalog: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": settings.base_url + config.AVAILABILITY_ENDPOINT,
        "states": states,
        "blood_groups": config.BLOOD_GROUPS,
        "components": config.COMPONENTS,
        "hospital_types": config.HOSPITAL_TYPES,
        "districts_by_state": {},
    }

    if include_districts:
        for st in states:
            code, name = st.get("code"), st.get("name")
            try:
                districts = fetch_state_districts(client, settings, code)
            except Exception as exc:  # noqa: BLE001 - record and continue
                log.warning("district fetch failed for %s (%s): %s", name, code, exc)
                districts = []
            catalog["districts_by_state"][str(code)] = {
                "name": name, "districts": districts,
            }
            log.info("  %s (%s): %d districts", name, code, len(districts))

    return catalog


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Discover blood-stock filter values.")
    parser.add_argument("--out", default=None, help="output JSON path (default: data/filters.json)")
    parser.add_argument("--no-districts", action="store_true", help="skip per-state district enumeration")
    args = parser.parse_args(argv)

    settings = Settings()
    settings.ensure_dirs()
    configure_logging(settings.log_dir)

    out_path = args.out or settings.filters_path
    client = HttpClient(settings)
    try:
        catalog = build_catalog(client, settings, include_districts=not args.no_districts)
    finally:
        client.close()

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(catalog, fh, indent=2, ensure_ascii=False)
    log.info("wrote filter catalog -> %s", out_path)


if __name__ == "__main__":
    main()
