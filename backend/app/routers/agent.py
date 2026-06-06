"""Agent + orchestration routes — the autonomous loop API."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..orchestrator import (
    all_requests,
    get_events,
    get_request,
    handle_emergency,
    handle_new_donor,
    handle_transfusion_due,
)
from ..outreach import failure_summary, get_outcomes

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/transfusion-due/{patient_id}")
def trigger_transfusion(patient_id: str):
    """Full autonomous cycle: triage → outreach → escalate → learn."""
    result = handle_transfusion_due(patient_id)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@router.post("/new-donor/{donor_id}")
def trigger_new_donor(donor_id: str):
    """Donor registers → find patients → map to bridges → welcome msg."""
    result = handle_new_donor(donor_id)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


class EmergencyRequest(BaseModel):
    blood_group: str
    latitude: float
    longitude: float


@router.post("/emergency")
def trigger_emergency(req: EmergencyRequest):
    """Ad-hoc emergency → fast rank → outreach."""
    result = handle_emergency(req.blood_group, req.latitude, req.longitude)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@router.get("/requests")
def list_requests():
    return {"requests": all_requests()}


@router.get("/requests/{request_id}")
def request_detail(request_id: str):
    r = get_request(request_id)
    if not r:
        raise HTTPException(404, "Request not found")
    return r


@router.get("/events")
def event_log(limit: int = 50):
    return {"events": get_events(limit)}


@router.get("/outcomes")
def outcomes(request_id: str = None):
    return {"outcomes": get_outcomes(request_id)}


@router.get("/learning")
def learning():
    """Failure learning summary — what worked, what didn't."""
    return failure_summary()


@router.get("/review/{request_id}")
def review_request(request_id: str):
    """Full review of an outreach cycle — see what worked and what didn't."""
    req = get_request(request_id)
    if not req:
        raise HTTPException(404, "Request not found")
    outcomes = get_outcomes(request_id)
    by_label = {}
    for o in outcomes:
        lbl = o.get("label", "unknown")
        by_label[lbl] = by_label.get(lbl, 0) + 1

    total = len(outcomes)
    accepted = by_label.get("accept", 0)
    return {
        "request_id": request_id,
        "request": req,
        "total_contacted": total,
        "breakdown": by_label,
        "accept_rate": round(accepted / total, 2) if total else 0,
        "quality": (
            "Excellent" if accepted / max(total, 1) >= 0.5
            else "Good" if accepted / max(total, 1) >= 0.3
            else "Needs improvement" if accepted > 0
            else "Failed — escalation needed"
        ),
        "outcomes": outcomes,
        "learning": failure_summary(),
    }
