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
        code = next(v for k, v in _HTTP.items() if isinstance(e, k))
        raise HTTPException(code, str(e))


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
