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


# ── Matching (simple + honest: compatible, annotated, distance-sorted; no ML) ─
def _distance_km(donor: dict, patient: Optional[dict]) -> Optional[float]:
    if not patient:
        return None
    # Ask geo for a NaN sentinel on missing coords so we can report "unknown"
    # (None) rather than a misleading 999 km, and sort such donors truly last.
    km = donor_patient_km(donor, patient, fallback=float("nan"))
    if math.isnan(km):
        return None
    return round(km, 1)


def find_matches(request_id, limit: int = 20) -> list[dict]:
    """Blood-compatible donors for a request, eligible-first then nearest.

    No ML ranking — shows facts (compatible, distance, eligibility) so the
    patient can choose. Compatibility is a hard filter.
    """
    req = _requests.get(request_id)
    if not req:
        raise NotFound(f"request {request_id} not found")
    patient = get_patient(req["patient_id"])
    matches = []
    for d in all_donors():
        if not can_donate(d.get("blood_group"), req["blood_group"]):
            continue
        dte = days_until_eligible(d)
        matches.append({
            "donor_id": str(d.get("user_id", "")),
            "blood_group": normalize_blood_group(d.get("blood_group")),
            "distance_km": _distance_km(d, patient),
            "eligible": is_eligible(d),
            "days_until_eligible": max(0, dte),
        })
    # eligible-first (False sorts before True via `not`), then nearest (None last)
    matches.sort(key=lambda m: (not m["eligible"],
                                m["distance_km"] if m["distance_km"] is not None else 1e9))
    return matches[:limit]


# ── Connection handshake ──────────────────────────────────────────────────
def send_connection(request_id, patient_id, donor_id) -> dict:
    """Patient sends a connection request to a blood-compatible donor."""
    donor_id = str(donor_id)
    req = _requests.get(request_id)
    if not req:
        raise NotFound(f"request {request_id} not found")
    if req["patient_id"] != str(patient_id):
        raise Forbidden("not your request")
    donor = get_donor(donor_id)
    if not donor:
        raise NotFound(f"donor {donor_id} not found")
    if not can_donate(donor.get("blood_group"), req["blood_group"]):
        raise BadState("donor is not blood-compatible with this request")
    for c in _connections.values():
        if (c["request_id"] == request_id and c["donor_id"] == donor_id
                and c["status"] in ("pending", "accepted")):
            raise Conflict("already connected to this donor for this request")
    cid = _new_id()
    conn = {
        "connection_id": cid,
        "request_id": request_id,
        "patient_id": str(patient_id),
        "donor_id": donor_id,
        "status": "pending",
        "created": _now(),
        "responded_at": None,
    }
    _connections[cid] = conn
    return conn


def respond_connection(connection_id, donor_id, action) -> dict:
    """Donor accepts or declines a pending connection."""
    conn = _connections.get(connection_id)
    if not conn:
        raise NotFound(f"connection {connection_id} not found")
    if conn["donor_id"] != str(donor_id):
        raise Forbidden("not the target donor")
    if conn["status"] != "pending":
        raise BadState(f"connection is {conn['status']}, not pending")
    if action == "accept":
        conn["status"] = "accepted"
    elif action == "decline":
        conn["status"] = "declined"
    else:
        raise BadState(f"invalid action: {action}")
    conn["responded_at"] = _now()
    return conn


def cancel_connection(connection_id, patient_id) -> dict:
    """Owning patient cancels a non-terminal connection."""
    conn = _connections.get(connection_id)
    if not conn:
        raise NotFound(f"connection {connection_id} not found")
    if conn["patient_id"] != str(patient_id):
        raise Forbidden("not your connection")
    if conn["status"] in ("declined", "cancelled"):
        raise BadState(f"connection is already {conn['status']}")
    conn["status"] = "cancelled"
    return conn


def get_connection(connection_id) -> Optional[dict]:
    return _connections.get(connection_id)


def list_connections(user_id, role) -> list[dict]:
    uid = str(user_id)
    if role == "patient":
        return [c for c in _connections.values() if c["patient_id"] == uid]
    if role == "donor":
        return [c for c in _connections.values() if c["donor_id"] == uid]
    return []


# ── Private messages (only on accepted connections, only participants) ──────
def add_message(connection_id, sender_id, text) -> dict:
    """Append a message. Requires an accepted connection and a participant sender."""
    if not text or not str(text).strip():
        raise BadState("message text cannot be empty")
    if len(str(text)) > 2000:
        raise BadState("message text exceeds 2000 characters")
    conn = _connections.get(connection_id)
    if not conn:
        raise NotFound(f"connection {connection_id} not found")
    if conn["status"] != "accepted":
        raise BadState("conversation opens only after the connection is accepted")
    sid = str(sender_id)
    if sid == conn["patient_id"]:
        role = "patient"
    elif sid == conn["donor_id"]:
        role = "donor"
    else:
        raise Forbidden("not a participant in this conversation")
    msg = {"sender_id": sid, "sender_role": role, "text": text, "ts": _now()}
    _messages.setdefault(connection_id, []).append(msg)
    return msg


def get_thread(connection_id, requester_id) -> list[dict]:
    """Return the ordered message thread. Only the two participants may read it.

    Read access is by participation only (no status guard): once a conversation
    has happened, the two participants keep access to their own history even if
    the connection is later cancelled/declined. Only *writing* requires "accepted".
    Returns copies so callers can't mutate stored messages.
    """
    conn = _connections.get(connection_id)
    if not conn:
        raise NotFound(f"connection {connection_id} not found")
    if str(requester_id) not in (conn["patient_id"], conn["donor_id"]):
        raise Forbidden("not a participant in this conversation")
    return [dict(m) for m in _messages.get(connection_id, [])]
