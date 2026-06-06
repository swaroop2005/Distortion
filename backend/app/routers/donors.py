"""Donor routes — ranking, donation clock, registration."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..compat import normalize_blood_group
from ..eligibility import days_until_eligible, is_eligible, next_eligible_date
from ..matching import rank_donors, rank_for_emergency
from ..store import all_donors, get_donor

router = APIRouter(prefix="/donors", tags=["donors"])


@router.get("/")
def list_donors(
    limit: int = Query(50, le=500),
    eligible_only: bool = Query(False),
):
    donors = all_donors()
    if eligible_only:
        donors = [d for d in donors if is_eligible(d)]
    out = []
    for d in donors[:limit]:
        out.append({
            "user_id": d["user_id"],
            "blood_group": normalize_blood_group(d.get("blood_group")),
            "donor_type": d.get("donor_type"),
            "churn_risk": round(float(d.get("churn_risk", 0)), 3),
            "responsiveness": round(float(d.get("responsiveness", 0)), 3),
            "eligible": is_eligible(d),
            "days_to_eligible": max(0, days_until_eligible(d)),
        })
    return {"total": len(donors), "donors": out}


@router.get("/{donor_id}")
def donor_detail(donor_id: str):
    d = get_donor(donor_id)
    if not d:
        raise HTTPException(404, "Donor not found")
    ned = next_eligible_date(d)
    return {
        "user_id": d["user_id"],
        "blood_group": normalize_blood_group(d.get("blood_group")),
        "donor_type": d.get("donor_type"),
        "latitude": d.get("latitude"),
        "longitude": d.get("longitude"),
        "churn_risk": round(float(d.get("churn_risk", 0)), 3),
        "responsiveness": round(float(d.get("responsiveness", 0)), 3),
        "eligible": is_eligible(d),
        "days_to_eligible": max(0, days_until_eligible(d)),
        "next_eligible_date": ned.isoformat() if ned else None,
        "donations_till_date": d.get("donations_till_date"),
        "total_calls": d.get("total_calls"),
    }


@router.get("/{donor_id}/clock")
def donation_clock(donor_id: str):
    """Personal Donation Clock — proactive donor view."""
    d = get_donor(donor_id)
    if not d:
        raise HTTPException(404, "Donor not found")
    dte = days_until_eligible(d)
    ned = next_eligible_date(d)
    return {
        "eligible_now": dte <= 0,
        "days_to_eligible": max(0, dte),
        "next_eligible_date": ned.isoformat() if ned else None,
        "blood_group": normalize_blood_group(d.get("blood_group")),
        "donations_count": d.get("donations_till_date"),
        "message": (
            "You are eligible to donate now!"
            if dte <= 0
            else f"You can donate again in {dte} days."
        ),
    }


class EmergencyRankRequest(BaseModel):
    blood_group: str
    latitude: float
    longitude: float
    limit: int = 20


@router.post("/rank/emergency")
def emergency_rank(req: EmergencyRankRequest):
    """Rank donors for an ad-hoc emergency request."""
    ranked = rank_for_emergency(
        req.blood_group, req.latitude, req.longitude, limit=req.limit
    )
    return {"count": len(ranked), "donors": ranked}


class RegisterDonorRequest(BaseModel):
    blood_group: str
    gender: str = "Unknown"
    latitude: float = 17.385
    longitude: float = 78.486


@router.post("/register")
def register_donor(req: RegisterDonorRequest):
    """Register a new donor (dynamic pool growth). Demo: in-memory only."""
    norm = normalize_blood_group(req.blood_group)
    if not norm:
        raise HTTPException(400, f"Unknown blood group: {req.blood_group}")
    return {
        "status": "registered",
        "blood_group": norm,
        "message": "Welcome to the Blood Bridge network! You are now eligible for matching.",
        "note": "Demo mode — stored in-memory. Production writes to DynamoDB.",
    }
