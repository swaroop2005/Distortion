"""Supply + patient map routes — Layer 1 data exposed to Layer 2 UI."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..services.supply import (
    mobilization_queue,
    nearby_compatible_banks,
    patient_map_data,
    regional_supply_summary,
)

router = APIRouter(prefix="/supply", tags=["supply"])


@router.get("/banks")
def compatible_banks(
    blood_group: str = Query(..., description="Patient blood group e.g. 'O Positive'"),
    district: str = Query("Hyderabad"),
    max_km: float = Query(200.0),
):
    """Blood banks with compatible stock near a district."""
    return {"banks": nearby_compatible_banks(blood_group, district, max_km)}


@router.get("/regional")
def regional(state: str = Query("Telangana")):
    """Aggregate supply by blood group for a state."""
    return regional_supply_summary(state)


@router.get("/mobilization")
def mobilization():
    """Optimizer's mobilization plan — donors selected to fill gaps."""
    return {"donors": mobilization_queue()}


@router.get("/patient-map")
def patient_map(
    blood_group: str = Query(..., description="Patient blood group"),
    district: str = Query("Hyderabad"),
):
    """All data for the patient map view: nearby donors, banks, stats."""
    return patient_map_data(blood_group, district)
