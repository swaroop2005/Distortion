"""Patient routes — public patient portal, bridge operations, transfusion tracking."""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..services.bridge import build_bridge, get_bridge, heal_bridge, patient_bridges
from ..services.store import get_patient

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/")
def list_patients(limit: int = Query(20, le=100)):
    """List patient transfusion requests (anonymized for privacy).
    
    Note: Full patient listing is admin-only at GET /admin/patients
    """
    # This endpoint returns anonymized data for public view
    return {
        "message": "Patient registry is admin-only. Use GET /{patient_id} for individual queries.",
        "contact": "admin@thalnet.local",
    }


@router.get("/{patient_id}")
def get_patient_detail(patient_id: str):
    """Get patient profile with bridges and transfusion schedule."""
    p = get_patient(patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")
    return {
        "user_id": p["user_id"],
        "blood_group": p.get("blood_group"),
        "latitude": p.get("latitude"),
        "longitude": p.get("longitude"),
        "quantity_required": p.get("quantity_required"),
        "expected_next_transfusion_date": p.get("expected_next_transfusion_date"),
        "bridges": patient_bridges(patient_id),
    }


class BridgeRequest(BaseModel):
    """Request to create a bridge of specified size (donors)."""
    size: int = 8


@router.post("/{patient_id}/bridge")
def create_bridge(patient_id: str, req: BridgeRequest = BridgeRequest()):
    """Create a new Auto-Bridge for patient (8→1, self-healing, staggered)."""
    p = get_patient(patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")
    
    if req.size < 2:
        raise HTTPException(400, "Bridge size must be at least 2 donors")
    if req.size > 20:
        raise HTTPException(400, "Bridge size cannot exceed 20 donors")
    
    result = build_bridge(patient_id, size=req.size)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@router.get("/{patient_id}/bridge/{bridge_id}")
def bridge_detail(patient_id: str, bridge_id: str):
    """Get bridge status, donor schedule, transfusion history."""
    b = get_bridge(bridge_id)
    if not b:
        raise HTTPException(404, "Bridge not found")
    return b


@router.post("/{patient_id}/bridge/{bridge_id}/heal")
def heal_bridge_endpoint(patient_id: str, bridge_id: str):
    """Trigger self-healing on bridge after donor dropout.
    
    - Replaces dropped donor with next-ranked compatible donor
    - Maintains stagger schedule
    - Logs integrity check
    """
    result = heal_bridge(bridge_id)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result
