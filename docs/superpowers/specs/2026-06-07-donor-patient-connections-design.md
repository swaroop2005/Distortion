# ThalNet — Donor↔Patient Connection System — Design

**Date:** 2026-06-07
**Author:** Swaroop + Claude
**Status:** Approved design, pending spec review
**Part of:** Blood Warriors Community Hub (Feature 1 — flagship). The Community Feed is a
separate later spec→plan→build cycle.

---

## 0. Goal & framing

Replace the slow manual loop (patient needs blood → volunteer searches → volunteer calls donors →
patient waits) with a self-serve connection workflow:

```
Patient creates request → sees compatible donors → sends connection request to chosen donor(s)
→ donor accepts → private conversation opens → trust → donation
```

The differentiator over "match found" platforms: the workflow **continues past the match into a
private conversation**, which increases conversion.

### Scope decisions (settled during brainstorming)
- **Backend API first.** Endpoints + persistent state + tests now; React UI is a separate later
  effort (same as the shipped chatbot, which has no UI yet). Local-first, AWS-deploy last.
- **Writable in-memory store with a DynamoDB-ready seam.** New mutable state lives behind plain
  functions in `community_store.py`; the function boundary is what swaps to DynamoDB later
  (the pattern `store.py` already established). $0, demo-ready.
- **Handshake model:** patient creates a blood request, sees the compatible-donor list, and sends a
  connection request to chosen donor(s). Creating/sending = the patient's side; the **donor
  accepts** to complete it. On acceptance the private chat opens.
- **Identity:** `patient_id`/`donor_id`/`user_id` are trusted from the request body/query (no auth
  middleware yet — RBAC later). Every mutating call verifies the actor owns the resource.
- **No AI ranking yet** (explicit user instruction): matching is a simple, honest compatible-donor
  finder (blood-compatible + eligibility annotation + distance), no ML scoring surfaced.
- **Profiles reuse** `store.get_patient` / `get_donor` (84 patients / 4446 donors already loaded).
  No new profile model.

---

## 1. Architecture & files

| File | Responsibility |
|---|---|
| `backend/app/services/community_store.py` | NEW — writable in-memory store (requests, connections, messages) + the function seam + validation + typed exceptions |
| `backend/app/routers/connections.py` | NEW — `/community/*` endpoints; thin handlers mapping store exceptions → HTTP codes |
| `backend/app/main.py` | EDIT — register the connections router |
| `backend/tests/test_community_store.py` | NEW — state-machine, privacy, ownership, matching tests |
| `backend/tests/test_connections_endpoint.py` | NEW — TestClient flow + error-mapping tests |

Reuse: `store.get_patient/get_donor/all_donors` (profiles), `utils/compat.can_donate` +
`normalize_blood_group` (compatibility), `utils/eligibility.is_eligible` +
`days_until_eligible` (eligibility annotation), `utils/geo.donor_patient_km` (distance).

All new code uses `from __future__ import annotations`. Endpoint group prefix `/community` so the
Hub stays cohesive (Feed adds `/community/feed` later).

---

## 2. State model & state machine

Three in-memory tables in `community_store.py`, each a dict keyed by id (→ DynamoDB tables later):

**`requests`** — a patient's blood request
```
{request_id, patient_id, blood_group, city, units_required, need_by,
 status: "open" | "fulfilled" | "cancelled", created}
```

**`connections`** — one per (request, donor) handshake
```
{connection_id, request_id, patient_id, donor_id,
 status: "pending" | "accepted" | "declined" | "cancelled",
 created, responded_at}
```

**`messages`** — keyed by connection_id → ordered list of
```
{sender_id, sender_role: "patient" | "donor", text, ts}
```

**State machine (per connection):**
```
  patient sends connection (donor must be blood-compatible)
            │
            ▼
        [pending] ──donor declines──▶ [declined]   (terminal)
            │
      donor accepts
            │
            ▼
        [accepted] ◀── private messaging unlocked here
            │
   patient cancels (any pre-terminal state)
            ▼
        [cancelled]   (terminal)
```

**Rules (enforced in the store, not the router):**
- A patient may send a connection only for **their own** request, to a **blood-compatible** donor,
  and **not twice** to the same donor on the same request (dedupe → Conflict).
- Only the **target donor** can accept/decline; only the **owning patient** can cancel; respond
  only valid while `pending`.
- **Messaging requires `status == "accepted"`** and the sender must be one of the two participants.
  `get_thread` requires the requester be a participant. This is the privacy guarantee.
- Eligibility is **informational** (annotated on matches), not a hard block on connecting.
  Compatibility **is** a hard rule.

---

## 3. `community_store.py` function API

Pure functions over the three tables; validation + typed exceptions live here. A `_reset()` helper
clears all three tables (test isolation only).

**Typed exceptions:** `NotFound`, `Forbidden`, `Conflict`, `BadState` (small `Exception`
subclasses). The router maps them to 404 / 403 / 409 / 400.

**Requests**
```python
create_request(patient_id, blood_group, city, units_required, need_by) -> dict
    # NotFound if patient missing; normalizes blood_group; status="open"
get_request(request_id) -> dict | None
list_requests(patient_id=None) -> list[dict]
find_matches(request_id, limit=20) -> list[dict]
    # NotFound if request missing. For each blood-compatible donor (compat.can_donate):
    #   {donor_id, blood_group, distance_km, eligible, days_until_eligible, city}
    # distance from the patient's own profile lat/lon (store) to the donor's lat/lon (geo).
    # sort: eligible desc, then distance_km asc. NO ML scores. limit cap.
```

**Connections**
```python
send_connection(request_id, patient_id, donor_id) -> dict
    # NotFound (request/donor); Forbidden (request not owned by patient_id);
    # BadState (donor blood-incompatible); Conflict (already connected on this request).
    # status="pending"
respond_connection(connection_id, donor_id, action) -> dict     # action: "accept"|"decline"
    # NotFound; Forbidden (donor_id != target donor); BadState (status != "pending").
    # accept -> "accepted" (+responded_at); decline -> "declined"
cancel_connection(connection_id, patient_id) -> dict
    # NotFound; Forbidden (not owner); BadState (already terminal). -> "cancelled"
get_connection(connection_id) -> dict | None
list_connections(user_id, role) -> list[dict]
    # role=="patient": patient_id==user_id ; role=="donor": donor_id==user_id
```

**Messages**
```python
add_message(connection_id, sender_id, text) -> dict
    # NotFound; BadState (connection not "accepted"); Forbidden (sender not a participant).
    # derives sender_role from which participant; appends {sender_id, sender_role, text, ts}
get_thread(connection_id, requester_id) -> list[dict]
    # NotFound; Forbidden (requester not a participant). returns ordered messages.
```

---

## 4. Endpoints (`routers/connections.py`, prefix `/community`)

Thin handlers; Pydantic models validate bodies; one helper maps store exceptions → HTTP.

```
POST /community/requests
     {patient_id, blood_group, city, units_required, need_by}
     -> 201 request(status:"open")                     | 404 patient unknown

GET  /community/requests/{request_id}                  -> request | 404
GET  /community/requests/{request_id}/matches?limit=20
     -> {request_id, matches:[{donor_id, blood_group, distance_km,
                               eligible, days_until_eligible, city}]}  | 404

POST /community/connections
     {request_id, patient_id, donor_id}                # patient initiates
     -> 201 connection(pending)
        404 request/donor · 403 not patient's request · 400 incompatible · 409 duplicate

POST /community/connections/{connection_id}/respond
     {donor_id, action:"accept"|"decline"}             # donor side
     -> connection(accepted|declined)
        404 · 403 not target donor · 400 not pending

POST /community/connections/{connection_id}/cancel
     {patient_id}                                      -> connection(cancelled)
        404 · 403 not owner · 400 already terminal

GET  /community/connections?user_id=&role=patient|donor
     -> {connections:[...]}

POST /community/connections/{connection_id}/messages
     {sender_id, text}
     -> 201 message
        404 · 400 not accepted · 403 sender not a participant

GET  /community/connections/{connection_id}/messages?user_id=
     -> {messages:[...]}                               | 404 · 403 not a participant
```

**Exception→HTTP map:** `NotFound→404`, `Forbidden→403`, `Conflict→409`, `BadState→400`.
Registered in `main.py`: `app.include_router(connections.router)`.

**`need_by`:** ISO date string (e.g. `"2026-06-09"`), stored/returned as-is. No scheduling logic in
v1 — informational, like the spec's "Within 48 Hours".

---

## 5. Matching (`find_matches`)

Simple and honest; no ML ranking.
- Hard rule: `compat.can_donate(donor.blood_group, request.blood_group)` — incompatible donors never
  appear.
- Distance: the request has a `city` string (stored/displayed), but distance is computed from the
  **patient's own profile lat/lon** (every patient record has coords) to each donor's lat/lon via
  `geo.donor_patient_km`. No city-string geocoding (avoids a dependency).
- Annotate each match with `eligible` (bool) + `days_until_eligible` (clamped ≥0).
- Order: eligible-first, then nearest. Cap at `limit`.
- The list shows **facts** (compatible, distance, eligible-now-or-in-N-days); the patient chooses.
  AI ranking can later slot in here as an optional ordering without changing the contract.

---

## 6. Testing (offline, in-memory, $0)

Run each via `.venv/bin/python -m backend.tests.<module>`. A `community_store._reset()` clears state
between tests.

`test_community_store.py`:
- **Happy path:** create request → `find_matches` returns compatible donors → `send_connection`
  (pending) → `respond_connection("accept")` → `accepted` → `add_message` both directions →
  `get_thread` returns them in order.
- **Decline blocks chat:** decline → `declined`; `add_message` raises `BadState`.
- **Privacy:** `add_message`/`get_thread` by a non-participant → `Forbidden`; messaging a `pending`
  connection → `BadState`.
- **Ownership:** wrong donor cannot `respond` (`Forbidden`); non-owner cannot `cancel` (`Forbidden`).
- **Matching invariants:** every match is blood-compatible; order is eligible-first then nearest;
  an incompatible donor is never returned.
- **Compatibility hard rule:** `send_connection` to an incompatible donor → `BadState`.
- **Dedupe:** sending the same (request, donor) twice → `Conflict`.
- **Real-data sanity:** uses a real patient id + a real compatible donor id from `store`.

`test_connections_endpoint.py` (TestClient):
- Full flow: POST request 201 → GET matches → POST connection 201 pending → POST respond accept →
  POST message 201 → GET messages thread.
- Error mappings: message before accept → 400; non-participant GET messages → 403; duplicate
  connection → 409; unknown request → 404.

**Privacy-promise assertions:** a conversation is reachable **only** through `accepted` and **only**
by the two participants — proven by both store and endpoint tests.

---

## 7. Out of scope (YAGNI / later)
- React frontend (separate effort).
- DynamoDB wiring (in-memory now; the function seam is the swap point).
- Auth/RBAC middleware (trust body/query ids for now).
- AI donor ranking (explicitly deferred).
- `need_by` scheduling/expiry, notifications/SES, real-time chat (polling `GET messages` is fine
  for v1).
- The Community Feed, threads, AI assistant (their own specs).
