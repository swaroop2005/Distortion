# Donor↔Patient Connection System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend for the Blood Warriors Community Hub flagship: a patient creates a blood request, sees compatible donors, sends a connection to chosen donor(s); the donor accepts; a private message thread opens — all enforced by a writable store with a mutual-accept privacy guard.

**Architecture:** A new writable in-memory store (`community_store.py`) owns three tables (requests, connections, messages) behind a function seam that swaps to DynamoDB later. Validation + a small typed-exception set live in the store; a thin `/community/*` router maps those exceptions to HTTP codes. Profiles and matching reuse existing `store.py`, `compat`, `eligibility`, `geo`. No ML ranking, no frontend, no auth (ids trusted from body/query).

**Tech Stack:** Python 3.9 (env 3.14), FastAPI, Pydantic, stdlib. Tests are `assert`-based smoke scripts run with `.venv/bin/python -m backend.tests.<module>`.

**Spec:** `docs/superpowers/specs/2026-06-07-donor-patient-connections-design.md`.

**Minor correction vs spec §5:** the match record omits the `city` field — donors have no city string in the dataset, and `distance_km` already conveys proximity. Match record = `{donor_id, blood_group, distance_km, eligible, days_until_eligible}`.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/app/services/community_store.py` | NEW — typed errors, 3 in-memory tables, `_reset`, requests / matching / connections / messages functions |
| `backend/app/routers/connections.py` | NEW — `/community/*` endpoints; Pydantic bodies; exception→HTTP mapping |
| `backend/app/main.py` | EDIT — register the connections router |
| `backend/tests/test_community_store.py` | NEW — state-machine, privacy, ownership, matching tests (built up across Tasks 1–4) |
| `backend/tests/test_connections_endpoint.py` | NEW — TestClient flow + error-mapping tests |

All new code uses `from __future__ import annotations`.

---

## Task 1: Store skeleton + blood requests

**Files:**
- Create: `backend/app/services/community_store.py`
- Test: `backend/tests/test_community_store.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_community_store.py`:

```python
"""State-machine, privacy, ownership and matching tests for the community store."""
from backend.app.services import community_store as cs
from backend.app.services.store import all_patients


def _a_patient():
    return all_patients()[0]


def test_create_and_get_request():
    cs._reset()
    p = _a_patient()
    req = cs.create_request(p["user_id"], p["blood_group"], "Hyderabad", 2, "2026-06-09")
    assert req["status"] == "open"
    assert req["patient_id"] == str(p["user_id"])
    assert cs.get_request(req["request_id"]) == req
    assert cs.list_requests(p["user_id"]) == [req]


def test_create_request_unknown_patient():
    cs._reset()
    try:
        cs.create_request("NOPE-404", "O+", "Hyderabad", 1, "2026-06-09")
        assert False, "expected NotFound"
    except cs.NotFound:
        pass


if __name__ == "__main__":
    test_create_and_get_request()
    test_create_request_unknown_patient()
    print("test_community_store OK")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_community_store`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.app.services.community_store'`

- [ ] **Step 3: Write the store skeleton + requests**

Create `backend/app/services/community_store.py`:

```python
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
from datetime import datetime
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
def create_request(patient_id, blood_group, city, units_required, need_by) -> dict:
    """Create a patient's open blood request."""
    if not get_patient(patient_id):
        raise NotFound(f"patient {patient_id} not found")
    bg = normalize_blood_group(blood_group)
    if not bg:
        raise BadState(f"invalid blood group: {blood_group}")
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_community_store`
Expected: `test_community_store OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/community_store.py backend/tests/test_community_store.py
git commit -m "feat(connections): community store skeleton + blood requests"
```

---

## Task 2: Compatible-donor matching

**Files:**
- Modify: `backend/app/services/community_store.py`
- Test: `backend/tests/test_community_store.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_community_store.py` (add the calls in `__main__` before the print):

```python
def test_find_matches_all_compatible():
    cs._reset()
    p = _a_patient()
    req = cs.create_request(p["user_id"], p["blood_group"], "Hyderabad", 2, "2026-06-09")
    matches = cs.find_matches(req["request_id"], limit=20)
    assert matches, "expected at least one compatible donor"
    from backend.app.services.store import get_donor
    from backend.app.utils.compat import can_donate
    for m in matches:
        d = get_donor(m["donor_id"])
        assert can_donate(d["blood_group"], req["blood_group"])  # every match is compatible
        assert "distance_km" in m and "eligible" in m and "days_until_eligible" in m


def test_find_matches_eligible_first_then_nearest():
    cs._reset()
    p = _a_patient()
    req = cs.create_request(p["user_id"], p["blood_group"], "Hyderabad", 2, "2026-06-09")
    matches = cs.find_matches(req["request_id"], limit=50)
    # eligible donors must all come before ineligible ones
    seen_ineligible = False
    for m in matches:
        if not m["eligible"]:
            seen_ineligible = True
        elif seen_ineligible:
            assert False, "an eligible donor appeared after an ineligible one"


def test_find_matches_unknown_request():
    cs._reset()
    try:
        cs.find_matches("NOPE")
        assert False, "expected NotFound"
    except cs.NotFound:
        pass
```

Add to `__main__`:
```python
    test_find_matches_all_compatible()
    test_find_matches_eligible_first_then_nearest()
    test_find_matches_unknown_request()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_community_store`
Expected: FAIL — `AttributeError: module 'backend.app.services.community_store' has no attribute 'find_matches'`

- [ ] **Step 3: Add `find_matches`**

In `backend/app/services/community_store.py`, add after `list_requests`:

```python
# ── Matching (simple + honest: compatible, annotated, distance-sorted; no ML) ─
def _distance_km(donor: dict, patient: Optional[dict]) -> Optional[float]:
    if not patient:
        return None
    km = donor_patient_km(donor, patient)
    if km is None or (isinstance(km, float) and math.isnan(km)):
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_community_store`
Expected: `test_community_store OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/community_store.py backend/tests/test_community_store.py
git commit -m "feat(connections): compatible-donor matching (no ML ranking)"
```

---

## Task 3: Connection handshake

**Files:**
- Modify: `backend/app/services/community_store.py`
- Test: `backend/tests/test_community_store.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_community_store.py` (helper + tests; add calls in `__main__`):

```python
def _request_and_compatible_donor():
    """Create a request and return (request, a real compatible donor_id)."""
    cs._reset()
    p = _a_patient()
    req = cs.create_request(p["user_id"], p["blood_group"], "Hyderabad", 2, "2026-06-09")
    donor_id = cs.find_matches(req["request_id"], limit=1)[0]["donor_id"]
    return req, donor_id


def test_send_connection_pending():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    assert conn["status"] == "pending"
    assert conn["donor_id"] == donor_id


def test_send_connection_wrong_patient_forbidden():
    req, donor_id = _request_and_compatible_donor()
    try:
        cs.send_connection(req["request_id"], "SOMEONE-ELSE", donor_id)
        assert False, "expected Forbidden"
    except cs.Forbidden:
        pass


def test_send_connection_incompatible_donor_badstate():
    req, donor_id = _request_and_compatible_donor()
    compatible = {m["donor_id"] for m in cs.find_matches(req["request_id"], limit=10000)}
    from backend.app.services.store import all_donors
    incompatible = next(str(d["user_id"]) for d in all_donors()
                        if str(d["user_id"]) not in compatible)
    try:
        cs.send_connection(req["request_id"], req["patient_id"], incompatible)
        assert False, "expected BadState"
    except cs.BadState:
        pass


def test_send_connection_duplicate_conflict():
    req, donor_id = _request_and_compatible_donor()
    cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    try:
        cs.send_connection(req["request_id"], req["patient_id"], donor_id)
        assert False, "expected Conflict"
    except cs.Conflict:
        pass


def test_donor_accepts():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    out = cs.respond_connection(conn["connection_id"], donor_id, "accept")
    assert out["status"] == "accepted"
    assert out["responded_at"]


def test_wrong_donor_cannot_respond():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    try:
        cs.respond_connection(conn["connection_id"], "OTHER-DONOR", "accept")
        assert False, "expected Forbidden"
    except cs.Forbidden:
        pass


def test_patient_cancels():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    out = cs.cancel_connection(conn["connection_id"], req["patient_id"])
    assert out["status"] == "cancelled"


def test_list_connections_by_role():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    assert conn in cs.list_connections(req["patient_id"], "patient")
    assert conn in cs.list_connections(donor_id, "donor")
```

Add to `__main__`:
```python
    test_send_connection_pending()
    test_send_connection_wrong_patient_forbidden()
    test_send_connection_incompatible_donor_badstate()
    test_send_connection_duplicate_conflict()
    test_donor_accepts()
    test_wrong_donor_cannot_respond()
    test_patient_cancels()
    test_list_connections_by_role()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_community_store`
Expected: FAIL — `AttributeError: ... has no attribute 'send_connection'`

- [ ] **Step 3: Add the connection functions**

In `backend/app/services/community_store.py`, add after `find_matches`:

```python
# ── Connection handshake ──────────────────────────────────────────────────
def send_connection(request_id, patient_id, donor_id) -> dict:
    """Patient sends a connection request to a blood-compatible donor."""
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
    did = str(donor_id)
    for c in _connections.values():
        if (c["request_id"] == request_id and c["donor_id"] == did
                and c["status"] in ("pending", "accepted")):
            raise Conflict("already connected to this donor for this request")
    cid = _new_id()
    conn = {
        "connection_id": cid,
        "request_id": request_id,
        "patient_id": str(patient_id),
        "donor_id": did,
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_community_store`
Expected: `test_community_store OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/community_store.py backend/tests/test_community_store.py
git commit -m "feat(connections): mutual-accept handshake (send/respond/cancel/list)"
```

---

## Task 4: Private messages (the privacy guard)

**Files:**
- Modify: `backend/app/services/community_store.py`
- Test: `backend/tests/test_community_store.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_community_store.py` (add calls in `__main__`):

```python
def _accepted_connection():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    cs.respond_connection(conn["connection_id"], donor_id, "accept")
    return req, donor_id, conn


def test_message_roundtrip_after_accept():
    req, donor_id, conn = _accepted_connection()
    cid = conn["connection_id"]
    cs.add_message(cid, req["patient_id"], "Hello, thank you for connecting!")
    cs.add_message(cid, donor_id, "Happy to help.")
    thread = cs.get_thread(cid, req["patient_id"])
    assert [m["sender_role"] for m in thread] == ["patient", "donor"]
    assert thread[0]["text"] == "Hello, thank you for connecting!"


def test_message_before_accept_blocked():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)  # pending
    try:
        cs.add_message(conn["connection_id"], req["patient_id"], "hi")
        assert False, "expected BadState"
    except cs.BadState:
        pass


def test_message_after_decline_blocked():
    req, donor_id = _request_and_compatible_donor()
    conn = cs.send_connection(req["request_id"], req["patient_id"], donor_id)
    cs.respond_connection(conn["connection_id"], donor_id, "decline")
    try:
        cs.add_message(conn["connection_id"], req["patient_id"], "hi")
        assert False, "expected BadState"
    except cs.BadState:
        pass


def test_non_participant_cannot_message_or_read():
    req, donor_id, conn = _accepted_connection()
    cid = conn["connection_id"]
    try:
        cs.add_message(cid, "STRANGER", "let me in")
        assert False, "expected Forbidden"
    except cs.Forbidden:
        pass
    try:
        cs.get_thread(cid, "STRANGER")
        assert False, "expected Forbidden"
    except cs.Forbidden:
        pass
```

The file already has ONE `if __name__ == "__main__":` block from earlier tasks. Do NOT add a second one — add these four calls to that EXISTING block, before its `print(...)` line:
```python
    test_message_roundtrip_after_accept()
    test_message_before_accept_blocked()
    test_message_after_decline_blocked()
    test_non_participant_cannot_message_or_read()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_community_store`
Expected: FAIL — `AttributeError: ... has no attribute 'add_message'`

- [ ] **Step 3: Add the message functions**

In `backend/app/services/community_store.py`, add after `list_connections`:

```python
# ── Private messages (only on accepted connections, only participants) ──────
def add_message(connection_id, sender_id, text) -> dict:
    """Append a message. Requires an accepted connection and a participant sender."""
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
    """Return the ordered message thread. Only the two participants may read it."""
    conn = _connections.get(connection_id)
    if not conn:
        raise NotFound(f"connection {connection_id} not found")
    if str(requester_id) not in (conn["patient_id"], conn["donor_id"]):
        raise Forbidden("not a participant in this conversation")
    return list(_messages.get(connection_id, []))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_community_store`
Expected: `test_community_store OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/community_store.py backend/tests/test_community_store.py
git commit -m "feat(connections): private messages with accepted-only + participant guard"
```

---

## Task 5: `/community/*` endpoints

**Files:**
- Create: `backend/app/routers/connections.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_connections_endpoint.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_connections_endpoint.py`:

```python
"""Endpoint flow + error-mapping tests for the connection system."""
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services import community_store as cs
from backend.app.services.store import all_patients

client = TestClient(app)


def _patient():
    return all_patients()[0]


def test_full_flow():
    cs._reset()
    p = _patient()
    # create request
    r = client.post("/community/requests", json={
        "patient_id": p["user_id"], "blood_group": p["blood_group"],
        "city": "Hyderabad", "units_required": 2, "need_by": "2026-06-09"})
    assert r.status_code == 201
    rid = r.json()["request_id"]
    # matches
    m = client.get(f"/community/requests/{rid}/matches")
    assert m.status_code == 200
    donor_id = m.json()["matches"][0]["donor_id"]
    # send connection
    c = client.post("/community/connections", json={
        "request_id": rid, "patient_id": p["user_id"], "donor_id": donor_id})
    assert c.status_code == 201
    cid = c.json()["connection_id"]
    assert c.json()["status"] == "pending"
    # donor accepts
    a = client.post(f"/community/connections/{cid}/respond",
                    json={"donor_id": donor_id, "action": "accept"})
    assert a.status_code == 200 and a.json()["status"] == "accepted"
    # message
    msg = client.post(f"/community/connections/{cid}/messages",
                      json={"sender_id": p["user_id"], "text": "Thank you!"})
    assert msg.status_code == 201
    # read thread as participant
    t = client.get(f"/community/connections/{cid}/messages", params={"user_id": p["user_id"]})
    assert t.status_code == 200 and len(t.json()["messages"]) == 1


def test_message_before_accept_400():
    cs._reset()
    p = _patient()
    rid = client.post("/community/requests", json={
        "patient_id": p["user_id"], "blood_group": p["blood_group"],
        "city": "Hyderabad", "units_required": 1, "need_by": "2026-06-09"}).json()["request_id"]
    donor_id = client.get(f"/community/requests/{rid}/matches").json()["matches"][0]["donor_id"]
    cid = client.post("/community/connections", json={
        "request_id": rid, "patient_id": p["user_id"], "donor_id": donor_id}).json()["connection_id"]
    r = client.post(f"/community/connections/{cid}/messages",
                    json={"sender_id": p["user_id"], "text": "too early"})
    assert r.status_code == 400


def test_non_participant_read_403():
    cs._reset()
    p = _patient()
    rid = client.post("/community/requests", json={
        "patient_id": p["user_id"], "blood_group": p["blood_group"],
        "city": "Hyderabad", "units_required": 1, "need_by": "2026-06-09"}).json()["request_id"]
    donor_id = client.get(f"/community/requests/{rid}/matches").json()["matches"][0]["donor_id"]
    cid = client.post("/community/connections", json={
        "request_id": rid, "patient_id": p["user_id"], "donor_id": donor_id}).json()["connection_id"]
    client.post(f"/community/connections/{cid}/respond",
                json={"donor_id": donor_id, "action": "accept"})
    r = client.get(f"/community/connections/{cid}/messages", params={"user_id": "STRANGER"})
    assert r.status_code == 403


def test_unknown_request_404():
    cs._reset()
    assert client.get("/community/requests/NOPE/matches").status_code == 404


if __name__ == "__main__":
    test_full_flow()
    test_message_before_accept_400()
    test_non_participant_read_403()
    test_unknown_request_404()
    print("test_connections_endpoint OK")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m backend.tests.test_connections_endpoint`
Expected: FAIL — POST/GET to `/community/*` return 404 (router not registered), so `status_code == 201` fails.

- [ ] **Step 3: Create the router**

Create `backend/app/routers/connections.py`:

```python
"""Blood Warriors Community Hub — donor<->patient connection endpoints.

Thin handlers over community_store. ids are trusted from the body/query for now
(RBAC middleware later); the store enforces ownership/participation. Store
exceptions are mapped to HTTP codes by _guard.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services import community_store as cs

router = APIRouter(prefix="/community", tags=["community"])

_HTTP = {cs.NotFound: 404, cs.Forbidden: 403, cs.Conflict: 409, cs.BadState: 400}


def _guard(fn, *args, **kwargs):
    """Call a store function, mapping its typed exceptions to HTTPException."""
    try:
        return fn(*args, **kwargs)
    except tuple(_HTTP) as e:
        raise HTTPException(_HTTP[type(e)], str(e))


class RequestIn(BaseModel):
    patient_id: str
    blood_group: str
    city: str
    units_required: int
    need_by: str


@router.post("/requests", status_code=201)
def create_request(body: RequestIn):
    return _guard(cs.create_request, body.patient_id, body.blood_group,
                  body.city, body.units_required, body.need_by)


@router.get("/requests/{request_id}")
def get_request(request_id: str):
    req = cs.get_request(request_id)
    if not req:
        raise HTTPException(404, "request not found")
    return req


@router.get("/requests/{request_id}/matches")
def matches(request_id: str, limit: int = 20):
    return {"request_id": request_id, "matches": _guard(cs.find_matches, request_id, limit)}


class ConnectIn(BaseModel):
    request_id: str
    patient_id: str
    donor_id: str


@router.post("/connections", status_code=201)
def send_connection(body: ConnectIn):
    return _guard(cs.send_connection, body.request_id, body.patient_id, body.donor_id)


class RespondIn(BaseModel):
    donor_id: str
    action: Literal["accept", "decline"]


@router.post("/connections/{connection_id}/respond")
def respond(connection_id: str, body: RespondIn):
    return _guard(cs.respond_connection, connection_id, body.donor_id, body.action)


class CancelIn(BaseModel):
    patient_id: str


@router.post("/connections/{connection_id}/cancel")
def cancel(connection_id: str, body: CancelIn):
    return _guard(cs.cancel_connection, connection_id, body.patient_id)


@router.get("/connections")
def list_connections(user_id: str, role: Literal["patient", "donor"]):
    return {"connections": cs.list_connections(user_id, role)}


class MessageIn(BaseModel):
    sender_id: str
    text: str


@router.post("/connections/{connection_id}/messages", status_code=201)
def post_message(connection_id: str, body: MessageIn):
    return _guard(cs.add_message, connection_id, body.sender_id, body.text)


@router.get("/connections/{connection_id}/messages")
def get_messages(connection_id: str, user_id: str):
    return {"messages": _guard(cs.get_thread, connection_id, user_id)}
```

- [ ] **Step 4: Register the router in main.py**

In `backend/app/main.py`, update the router import line
(`from .routers import admin, chat, donors, patients, supply_routes`) to include `connections`:

```python
from .routers import admin, chat, connections, donors, patients, supply_routes
```

Add this line in the "Public portals" section (after `app.include_router(chat.router)`):

```python
app.include_router(connections.router)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `.venv/bin/python -m backend.tests.test_connections_endpoint`
Expected: `test_connections_endpoint OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/connections.py backend/app/main.py backend/tests/test_connections_endpoint.py
git commit -m "feat(connections): /community/* endpoints + router wiring"
```

---

## Task 6: Full smoke run + docs

**Files:**
- Modify: `PROGRESS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full backend smoke suite**

Run (from `/home/swaroop/Blend`):
```bash
.venv/bin/python -m backend.tests.test_community_store && \
.venv/bin/python -m backend.tests.test_connections_endpoint && \
.venv/bin/python -m backend.tests.test_chatbot && \
.venv/bin/python -m backend.tests.test_chat_endpoint
```
Expected: four `... OK` lines, no traceback. (A scikit-learn `InconsistentVersionWarning` is harmless.) If any FAILS, STOP and report BLOCKED — do not edit docs.

- [ ] **Step 2: Verify the app boots with the new routes**

Run: `.venv/bin/python -c "from backend.app.main import app; paths={r.path for r in app.routes}; print('community routes:', sorted(p for p in paths if p.startswith('/community')))"`
Expected: prints the `/community/...` paths (requests, matches, connections, respond, cancel, messages), no traceback.

- [ ] **Step 3: Update PROGRESS.md**

READ it first to match the format. Add a dated entry (2026-06-07) noting: Donor↔Patient Connection System (Community Hub flagship) backend built — `/community/*` endpoints; writable in-memory `community_store.py` (requests / connections / messages) with a DynamoDB-ready function seam; mutual-accept handshake (patient sends → donor accepts → private chat opens); privacy guard (messaging only on accepted connections, only participants); simple compatible-donor matching (no ML ranking yet); all smoke tests pass. Next: Community Feed (its own spec).

- [ ] **Step 4: Update CLAUDE.md**

READ it first. In the `## Files` code block under `backend/app/`, add:
```
backend/app/services/community_store.py  writable store: blood requests, connections, messages (DynamoDB-ready seam)
backend/app/routers/connections.py        /community/* donor<->patient connection endpoints
```
Do not make other edits.

- [ ] **Step 5: Commit**

```bash
git add PROGRESS.md CLAUDE.md
git commit -m "docs: record donor-patient connection system"
```

---

## Self-Review notes (for the implementer)
- **Writable store, not cached:** `community_store.py` uses plain module dicts (NOT `lru_cache` like `store.py`) — the state is mutable. `_reset()` is test-only.
- **Privacy is enforced in the store:** messaging requires `status=="accepted"` AND a participant sender; reads require a participant. The router never bypasses these — keep it that way.
- **Compatibility is a hard rule; eligibility is informational.** `send_connection` rejects incompatible donors (`BadState`); `find_matches` annotates eligibility but never filters on it.
- **No ML ranking** in `find_matches` (deliberate, per spec). Don't add churn/responsiveness scoring here.
- **Match record omits `city`** (donors have no city string; `distance_km` conveys proximity) — a deliberate correction to spec §5.
- Tests reset state with `cs._reset()` and use a real patient + a real compatible donor (via `find_matches`) so they exercise the actual dataset.
```
