"""Patient routes — bridge status, request creation, honest ops view."""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..bridge import build_bridge, get_bridge, heal_bridge, patient_bridges
from ..store import all_patients, get_patient

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/")
def list_patients(limit: int = Query(20, le=100)):
    """List patients (admin use). Strips PII for aggregate views."""
    pats = all_patients()[:limit]
    return [
        {
            "user_id": p["user_id"],
            "blood_group": p.get("blood_group"),
            "latitude": p.get("latitude"),
            "longitude": p.get("longitude"),
            "quantity_required": p.get("quantity_required"),
            "expected_next_transfusion_date": p.get("expected_next_transfusion_date"),
        }
        for p in pats
    ]


@router.get("/{patient_id}")
def get_patient_detail(patient_id: str):
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
    size: int = 8


@router.post("/{patient_id}/bridge")
def create_bridge(patient_id: str, req: BridgeRequest = BridgeRequest()):
    p = get_patient(patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")
    result = build_bridge(patient_id, size=req.size)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@router.post("/{patient_id}/bridge/{bridge_id}/heal")
def heal(patient_id: str, bridge_id: str):
    result = heal_bridge(bridge_id)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@router.get("/{patient_id}/bridge/{bridge_id}")
def bridge_detail(patient_id: str, bridge_id: str):
    b = get_bridge(bridge_id)
    if not b:
        raise HTTPException(404, "Bridge not found")
    return b
