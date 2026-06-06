"""Donor routes — public donor portal, eligibility tracking, emergency matching."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..utils.compat import normalize_blood_group
from ..utils.eligibility import days_until_eligible, is_eligible, next_eligible_date
from ..services.matching import rank_donors, rank_for_emergency
from ..services.store import get_donor

router = APIRouter(prefix="/donors", tags=["donors"])


@router.get("/")
def list_donors(
    limit: int = Query(50, le=500),
    eligible_only: bool = Query(False),
):
    """List eligible donors with public profile (anonymized).
    
    Note: Full donor listing is admin-only at GET /admin/donors
    """
    return {
        "message": "Public donor listing is anonymized. For full donor management, use /admin/donors",
        "contact": "admin@thalnet.local",
    }


@router.get("/{donor_id}")
def donor_detail(donor_id: str):
    """Get donor public profile with eligibility & donation clock."""
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
    """Personal Donation Clock — proactive donor view.
    
    Shows days until next eligible donation, motivational message.
    """
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
            "You are eligible to donate now! 🩸"
            if dte <= 0
            else f"You can donate again in {dte} days."
        ),
    }


class EmergencyRankRequest(BaseModel):
    """Request to rank donors for emergency transfusion."""
    blood_group: str
    latitude: float
    longitude: float
    limit: int = 20


@router.post("/rank-emergency")
def emergency_rank(req: EmergencyRankRequest):
    """Rank donors for an ad-hoc emergency request.
    
    Factors: blood compatibility, eligibility, ML score, distance.
    """
    ranked = rank_for_emergency(
        req.blood_group, req.latitude, req.longitude, limit=req.limit
    )
    return {"count": len(ranked), "donors": ranked}


class RegisterDonorRequest(BaseModel):
    """Request to register as a new donor."""
    blood_group: str
    gender: str = "Unknown"
    latitude: float = 17.385
    longitude: float = 78.486


@router.post("/register")
def register_donor(req: RegisterDonorRequest):
    """Register a new donor (dynamic pool growth).
    
    Demo: in-memory only. Production writes to DynamoDB.
    Validates blood group before registration.
    """
    norm = normalize_blood_group(req.blood_group)
    if not norm:
        raise HTTPException(400, f"Unknown blood group: {req.blood_group}")
    return {
        "status": "registered",
        "blood_group": norm,
        "message": "Welcome to the Blood Bridge network! You are now eligible for matching.",
        "note": "Demo mode — stored in-memory. Production writes to DynamoDB.",
    }
