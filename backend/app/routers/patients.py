"""Patient routes — public patient portal, bridge operations, transfusion tracking."""
from __future__ import annotations

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..services.bridge import build_bridge, get_bridge, heal_bridge, patient_bridges
from ..services.store import get_patient
from .auth import link_phone

router = APIRouter(prefix="/patients", tags=["patients"])

# In-memory registered patient profiles (DynamoDB-ready seam)
_registered_patients: dict = {}  # user_id -> profile


class RegisterPatientRequest(BaseModel):
    phone: str
    name: str
    dob: str
    is_for_self: bool = True
    patient_name: Optional[str] = None
    patient_dob: Optional[str] = None
    relationship: Optional[str] = None
    blood_group: Optional[str] = None
    thalassemia_type: Optional[str] = None
    transfusion_frequency: Optional[str] = None
    last_transfusion: Optional[str] = None
    city: str = ""
    district: str = ""
    hospital: Optional[str] = None
    emergency_name: str = ""
    emergency_phone: str = ""
    emergency_relation: Optional[str] = None
    language: str = "en"
    whatsapp: bool = True


@router.post("/register")
def register_patient(req: RegisterPatientRequest):
    """Register a new patient and link their phone for OTP sign-in."""
    patient_id = f"PT-REG-{uuid.uuid4().hex[:6].upper()}"
    profile = req.dict()
    profile["user_id"] = patient_id
    profile["role"] = "Patient"
    _registered_patients[patient_id] = profile
    link_phone(req.phone, patient_id, "patient")
    return {
        "status": "registered",
        "user_id": patient_id,
        "message": "Your blood bridge is being built. We'll reach out when donors confirm.",
        "note": "Demo mode — stored in-memory. Production writes to DynamoDB.",
    }


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


class RegisterPatientRequest(BaseModel):
    """Request to register as a new patient (caregiver or self)."""
    name: str
    phone: str = ""
    blood_group: str = ""
    thal_type: str = "major"
    language: str = "English"
    latitude: float = 17.385
    longitude: float = 78.486


@router.post("/register")
def register_patient(req: RegisterPatientRequest):
    """Register a new patient into the ThalNet network.

    Demo: in-memory only. Production writes to DynamoDB.
    Returns a synthetic patient ID for the demo session.
    """
    import uuid
    from ..services.compat import normalize_blood_group
    norm_group = normalize_blood_group(req.blood_group) if req.blood_group else "Unknown"
    patient_id = "PT-" + str(uuid.uuid4())[:8].upper()
    return {
        "status": "registered",
        "patient_id": patient_id,
        "blood_group": norm_group,
        "message": "Your blood bridge is being built. We'll contact you when your first donor confirms.",
        "note": "Demo mode — stored in-memory. Production writes to DynamoDB.",
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
