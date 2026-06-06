"""Transform raw API JSON into clean, flat records.

The availability endpoint returns each bank with a nested stock matrix:

    bank["stock"] = { "<component>": { "<blood_group>": <units>, ... }, ... }

:func:`flatten_bank` expands that matrix into one row per
(bank x component x blood_group) — the full cross-product the analytics layer
wants — and :func:`bank_registry_row` produces the per-bank dimension record.
"""

from __future__ import annotations

from typing import Any

from .utils import record_hash

# Long-format column order (also the CSV header order).
LONG_COLUMNS = [
    "search_timestamp", "state_code", "state_name", "district",
    "blood_bank_id", "blood_bank_name", "address", "hospital_type",
    "is_online", "stock_last_updated",
    "component_type", "blood_group", "available_units", "bank_total_units",
    "phones", "emails", "record_hash",
]

REGISTRY_COLUMNS = [
    "blood_bank_id", "blood_bank_name", "address", "district",
    "state_name", "state_code", "hospital_type", "phones", "emails",
    "bank_total_units", "is_online", "stock_last_updated",
    "first_seen", "last_seen",
]


def _join(values: Any) -> str:
    """Join a list field (phones/emails) into a single '; '-delimited string."""
    if isinstance(values, list):
        return "; ".join(str(v) for v in values if v not in (None, ""))
    return "" if values is None else str(values)


def flatten_bank(
    bank: dict[str, Any],
    *,
    state_code: int | str,
    state_name: str,
    search_timestamp: str,
) -> list[dict[str, Any]]:
    """Expand one bank's nested stock matrix into long-format rows.

    A bank with no positive stock entries yields zero rows (nothing to record in
    the long table); its existence is still captured by :func:`bank_registry_row`.
    """
    rows: list[dict[str, Any]] = []
    bank_id = bank.get("id")
    name = bank.get("name")
    address = bank.get("address")
    district = bank.get("district")
    hospital_type = bank.get("type")
    is_online = bank.get("isOnline")
    last_updated = bank.get("lastUpdated")
    total_units = bank.get("totalUnits")
    phones = _join(bank.get("phones"))
    emails = _join(bank.get("emails"))

    stock = bank.get("stock") or {}
    for component, groups in stock.items():
        if not isinstance(groups, dict):
            continue
        for blood_group, units in groups.items():
            rows.append({
                "search_timestamp": search_timestamp,
                "state_code": state_code,
                "state_name": state_name,
                "district": district,
                "blood_bank_id": bank_id,
                "blood_bank_name": name,
                "address": address,
                "hospital_type": hospital_type,
                "is_online": is_online,
                "stock_last_updated": last_updated,
                "component_type": component,
                "blood_group": blood_group,
                "available_units": units,
                "bank_total_units": total_units,
                "phones": phones,
                "emails": emails,
                "record_hash": record_hash(
                    bank_id, component, blood_group, last_updated, units
                ),
            })
    return rows


def bank_registry_row(
    bank: dict[str, Any],
    *,
    state_code: int | str,
    state_name: str,
    seen_timestamp: str,
) -> dict[str, Any]:
    """Produce a per-bank dimension record (no stock matrix)."""
    return {
        "blood_bank_id": bank.get("id"),
        "blood_bank_name": bank.get("name"),
        "address": bank.get("address"),
        "district": bank.get("district"),
        "state_name": state_name,
        "state_code": state_code,
        "hospital_type": bank.get("type"),
        "phones": _join(bank.get("phones")),
        "emails": _join(bank.get("emails")),
        "bank_total_units": bank.get("totalUnits"),
        "is_online": bank.get("isOnline"),
        "stock_last_updated": bank.get("lastUpdated"),
        "first_seen": seen_timestamp,
        "last_seen": seen_timestamp,
    }


def parse_availability(
    payload: dict[str, Any],
    *,
    state_code: int | str,
    state_name: str,
    search_timestamp: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    """Parse a full availability response.

    Returns ``(long_rows, registry_rows, meta)`` where ``meta`` carries
    response-level fields (count, fromCache, availableDistricts, ...).
    """
    data = payload.get("data", {}) or {}
    banks = data.get("banks", []) or []

    long_rows: list[dict[str, Any]] = []
    registry_rows: list[dict[str, Any]] = []
    for bank in banks:
        long_rows.extend(flatten_bank(
            bank, state_code=state_code, state_name=state_name,
            search_timestamp=search_timestamp,
        ))
        registry_rows.append(bank_registry_row(
            bank, state_code=state_code, state_name=state_name,
            seen_timestamp=search_timestamp,
        ))

    meta = {
        "count": data.get("count"),
        "from_cache": data.get("fromCache"),
        "max_entry_age_days": data.get("maxEntryAgeDays"),
        "available_districts": data.get("availableDistricts", []) or [],
    }
    return long_rows, registry_rows, meta
