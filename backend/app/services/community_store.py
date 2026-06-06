"""Writable in-memory store for the Blood Warriors Community Hub connection system.

Owns the mutable state the read-only profile store (store.py) does not: blood
requests, patient<->donor connection handshakes, and private messages. All access
goes through the functions here — that function boundary is the seam that swaps to
DynamoDB later.

Connection state machine:
    pending --donor accept--> accepted   (private chat unlocks)
            --donor decline-> declined   (terminal)
    pending/accepted --patient cancel--> cancelled  (terminal)

Run smoke test:  .venv/bin/python -m backend.tests.test_community_store
"""
from __future__ import annotations

import math
import uuid
from datetime import date, datetime
from typing import Optional

from ..utils.compat import can_donate, normalize_blood_group
from ..utils.eligibility import days_until_eligible, is_eligible
from ..utils.geo import donor_patient_km
from .store import all_donors, get_donor, get_patient


# ── Typed errors (the router maps these to HTTP codes) ───────────────────
class NotFound(Exception):
    """Resource does not exist → 404."""


class Forbidden(Exception):
    """Actor does not own / is not a participant in the resource → 403."""


class Conflict(Exception):
    """Duplicate / conflicting state → 409."""


class BadState(Exception):
    """Invalid input or illegal state transition → 400."""


# ── In-memory tables (→ DynamoDB later) ──────────────────────────────────
_requests: dict[str, dict] = {}
_connections: dict[str, dict] = {}
_messages: dict[str, list] = {}


def _reset() -> None:
    """Clear all state. TEST ONLY."""
    _requests.clear()
    _connections.clear()
    _messages.clear()


def _now() -> str:
    return datetime.utcnow().isoformat()


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


# ── Blood requests ────────────────────────────────────────────────────────
def create_request(patient_id: str, blood_group: str, city: str,
                   units_required: int, need_by: str) -> dict:
    """Create a patient's open blood request. need_by is an ISO date string."""
    if not get_patient(patient_id):
        raise NotFound(f"patient {patient_id} not found")
    bg = normalize_blood_group(blood_group)
    if not bg:
        raise BadState(f"invalid blood group: {blood_group}")
    try:
        date.fromisoformat(str(need_by))
    except (ValueError, TypeError):
        raise BadState(f"need_by must be an ISO date (YYYY-MM-DD), got: {need_by!r}")
    rid = _new_id()
    req = {
        "request_id": rid,
        "patient_id": str(patient_id),
        "blood_group": bg,
        "city": city,
        "units_required": int(units_required),
        "need_by": need_by,
        "status": "open",
        "created": _now(),
    }
    _requests[rid] = req
    return req


def get_request(request_id) -> Optional[dict]:
    return _requests.get(request_id)


def list_requests(patient_id=None) -> list[dict]:
    if patient_id is None:
        return list(_requests.values())
    pid = str(patient_id)
    return [r for r in _requests.values() if r["patient_id"] == pid]
