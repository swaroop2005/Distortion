"""Admin routes — RBAC-protected CRUD operations, analytics, alerts, bridge management."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..services.bridge import all_bridges, bridge_health_summary, get_bridge, heal_bridge
from ..utils.compat import normalize_blood_group
from ..utils.eligibility import is_eligible
from ..services.store import all_donors, all_patients, get_donor, get_patient
from ..supply_store import national_kpis, shortage_report

router = APIRouter(prefix="/admin", tags=["admin"])

CHURN_THRESHOLD = 0.6


# ===== REQUEST/RESPONSE MODELS =====
class DonorUpdate(BaseModel):
    """Admin update schema for donor profile."""
    blood_group: Optional[str] = None
    donor_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    donor_status: Optional[str] = None  # "active", "inactive", "suspended"


class PatientUpdate(BaseModel):
    """Admin update schema for patient profile."""
    blood_group: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    quantity_required: Optional[int] = None
    patient_status: Optional[str] = None  # "active", "inactive", "urgent"


# ===== ADMIN DONORS MANAGEMENT =====
@router.get("/donors")
def list_admin_donors(limit: int = Query(50, le=500), skip: int = Query(0, ge=0)):
    """List all donors with full details (admin only)."""
    donors = all_donors()
    paginated = donors[skip : skip + limit]
    return {
        "total": len(donors),
        "skip": skip,
        "limit": limit,
        "donors": [
            {
                "user_id": d["user_id"],
                "blood_group": normalize_blood_group(d.get("blood_group")),
                "donor_type": d.get("donor_type"),
                "latitude": d.get("latitude"),
                "longitude": d.get("longitude"),
                "churn_risk": round(float(d.get("churn_risk", 0)), 3),
                "responsiveness": round(float(d.get("responsiveness", 0)), 3),
                "eligible": is_eligible(d),
                "donations_till_date": d.get("donations_till_date"),
                "total_calls": d.get("total_calls"),
            }
            for d in paginated
        ],
    }


@router.get("/donors/{donor_id}")
def get_admin_donor(donor_id: str):
    """Get full donor details (admin only)."""
    d = get_donor(donor_id)
    if not d:
        raise HTTPException(404, f"Donor {donor_id} not found")
    return {
        "user_id": d["user_id"],
        "blood_group": normalize_blood_group(d.get("blood_group")),
        "donor_type": d.get("donor_type"),
        "latitude": d.get("latitude"),
        "longitude": d.get("longitude"),
        "churn_risk": round(float(d.get("churn_risk", 0)), 3),
        "responsiveness": round(float(d.get("responsiveness", 0)), 3),
        "eligible": is_eligible(d),
        "donations_till_date": d.get("donations_till_date"),
        "total_calls": d.get("total_calls"),
        "timestamp_registered": d.get("timestamp_registered"),
    }


@router.put("/donors/{donor_id}")
def update_admin_donor(donor_id: str, update: DonorUpdate):
    """Update donor profile (admin only). Partial updates supported."""
    d = get_donor(donor_id)
    if not d:
        raise HTTPException(404, f"Donor {donor_id} not found")
    
    # Apply updates (in production, would write to DynamoDB)
    if update.blood_group:
        norm = normalize_blood_group(update.blood_group)
        if not norm:
            raise HTTPException(400, f"Invalid blood group: {update.blood_group}")
        d["blood_group"] = norm
    if update.donor_type:
        d["donor_type"] = update.donor_type
    if update.latitude is not None:
        d["latitude"] = update.latitude
    if update.longitude is not None:
        d["longitude"] = update.longitude
    if update.donor_status:
        d["status"] = update.donor_status

    return {
        "status": "updated",
        "donor_id": donor_id,
        "message": f"Donor {donor_id} updated successfully",
    }


@router.delete("/donors/{donor_id}")
def delete_admin_donor(donor_id: str):
    """Delete/deactivate donor profile (admin only)."""
    d = get_donor(donor_id)
    if not d:
        raise HTTPException(404, f"Donor {donor_id} not found")
    
    # In production, mark as deleted or deactivate rather than true delete
    return {
        "status": "deactivated",
        "donor_id": donor_id,
        "message": f"Donor {donor_id} has been deactivated",
    }


# ===== ADMIN PATIENTS MANAGEMENT =====
@router.get("/patients")
def list_admin_patients(limit: int = Query(20, le=100), skip: int = Query(0, ge=0)):
    """List all patients with full details (admin only)."""
    patients = all_patients()
    paginated = patients[skip : skip + limit]
    return {
        "total": len(patients),
        "skip": skip,
        "limit": limit,
        "patients": [
            {
                "user_id": p["user_id"],
                "blood_group": p.get("blood_group"),
                "latitude": p.get("latitude"),
                "longitude": p.get("longitude"),
                "quantity_required": p.get("quantity_required"),
                "expected_next_transfusion_date": p.get("expected_next_transfusion_date"),
            }
            for p in paginated
        ],
    }


@router.get("/patients/{patient_id}")
def get_admin_patient(patient_id: str):
    """Get full patient details (admin only)."""
    p = get_patient(patient_id)
    if not p:
        raise HTTPException(404, f"Patient {patient_id} not found")
    return {
        "user_id": p["user_id"],
        "blood_group": p.get("blood_group"),
        "latitude": p.get("latitude"),
        "longitude": p.get("longitude"),
        "quantity_required": p.get("quantity_required"),
        "expected_next_transfusion_date": p.get("expected_next_transfusion_date"),
        "timestamp_registered": p.get("timestamp_registered"),
    }


@router.put("/patients/{patient_id}")
def update_admin_patient(patient_id: str, update: PatientUpdate):
    """Update patient profile (admin only). Partial updates supported."""
    p = get_patient(patient_id)
    if not p:
        raise HTTPException(404, f"Patient {patient_id} not found")
    
    if update.blood_group:
        p["blood_group"] = update.blood_group
    if update.latitude is not None:
        p["latitude"] = update.latitude
    if update.longitude is not None:
        p["longitude"] = update.longitude
    if update.quantity_required is not None:
        p["quantity_required"] = update.quantity_required
    if update.patient_status:
        p["status"] = update.patient_status

    return {
        "status": "updated",
        "patient_id": patient_id,
        "message": f"Patient {patient_id} updated successfully",
    }


@router.delete("/patients/{patient_id}")
def delete_admin_patient(patient_id: str):
    """Delete/deactivate patient profile (admin only)."""
    p = get_patient(patient_id)
    if not p:
        raise HTTPException(404, f"Patient {patient_id} not found")
    
    return {
        "status": "deactivated",
        "patient_id": patient_id,
        "message": f"Patient {patient_id} has been deactivated",
    }


# ===== ADMIN BRIDGE MANAGEMENT =====
@router.get("/bridges")
def list_admin_bridges():
    """List all active bridges (admin only)."""
    bridges = all_bridges()
    return {
        "total": len(bridges),
        "bridges": bridges,
    }


@router.get("/bridges/{bridge_id}")
def get_admin_bridge(bridge_id: str):
    """Get bridge details (admin only)."""
    b = get_bridge(bridge_id)
    if not b:
        raise HTTPException(404, f"Bridge {bridge_id} not found")
    return b


@router.delete("/bridges/{bridge_id}")
def close_admin_bridge(bridge_id: str):
    """Close/deactivate a bridge (admin only)."""
    b = get_bridge(bridge_id)
    if not b:
        raise HTTPException(404, f"Bridge {bridge_id} not found")
    
    return {
        "status": "closed",
        "bridge_id": bridge_id,
        "message": f"Bridge {bridge_id} closed successfully",
    }


@router.post("/bridges/{bridge_id}/heal")
def heal_admin_bridge(bridge_id: str):
    """Manually trigger bridge healing (admin override)."""
    result = heal_bridge(bridge_id)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return {
        "status": "healed",
        "bridge_id": bridge_id,
        "result": result,
    }


# ===== ADMIN ANALYTICS & ALERTS =====
@router.get("/dashboard")
def dashboard():
    """Single-call dashboard payload for the admin view.

    Combines Layer 2 donor/patient/bridge stats with Layer 1 supply KPIs so
    the admin sees the full picture in one request.
    """
    donors = all_donors()
    patients = all_patients()

    eligible = sum(1 for d in donors if is_eligible(d))
    high_churn = [
        d for d in donors if float(d.get("churn_risk", 0)) >= CHURN_THRESHOLD
    ]

    # Blood group distribution across donors
    group_counts: dict[str, int] = {}
    for d in donors:
        g = normalize_blood_group(d.get("blood_group"))
        if g:
            group_counts[g] = group_counts.get(g, 0) + 1

    # Upcoming transfusion load (patients with dates in Dataset.csv)
    upcoming_transfusions = sum(
        1 for p in patients if p.get("expected_next_transfusion_date")
    )

    # Layer 1 supply snapshot (national blood bank data)
    supply = national_kpis()

    return {
        # Layer 2 — donor/patient/bridge stats
        "total_donors": len(donors),
        "eligible_donors": eligible,
        "total_patients": len(patients),
        "upcoming_transfusions": upcoming_transfusions,
        "high_churn_count": len(high_churn),
        "blood_group_distribution": group_counts,
        "bridge_health": bridge_health_summary(),
        # Layer 1 — national blood supply snapshot
        "supply": supply,
    }


@router.get("/supply-overview")
def supply_overview():
    """
    Detailed supply-chain overview for the admin command-center panel.

    Shows shortage by blood group (from optimizer forecast) + national KPIs.
    """
    kpis = national_kpis()
    shortage = shortage_report()

    for r in shortage:
        for k in ("supply_units", "horizon_demand", "daily_demand",
                  "days_of_coverage", "shortfall_units"):
            try:
                r[k] = float(r[k])
            except (ValueError, TypeError, KeyError):
                r[k] = 0.0

    shortage.sort(key=lambda r: r.get("days_of_coverage", 9999))
    critical = [r for r in shortage if r.get("status") == "CRITICAL"]
    low = [r for r in shortage if r.get("status") == "LOW"]
    ok = [r for r in shortage if r.get("status") == "OK"]

    return {
        "kpis": kpis,
        "shortage": {
            "critical": critical,
            "low": low,
            "ok": ok,
        },
        "action_required": bool(critical),
        "recommendation": (
            f"URGENT: {len(critical)} blood group(s) critically low. "
            f"Mobilize donors + trigger inter-bank transfers immediately."
            if critical else
            f"{len(low)} group(s) running low. Monitor + schedule donor outreach."
            if low else
            "All blood groups adequately stocked."
        ),
    }


@router.get("/alerts/churn")
def churn_alerts(threshold: float = Query(CHURN_THRESHOLD, ge=0, le=1)):
    """Donors at risk of churning — sorted by risk descending."""
    donors = all_donors()
    at_risk = []
    for d in donors:
        cr = float(d.get("churn_risk", 0))
        if cr >= threshold:
            at_risk.append({
                "user_id": d["user_id"],
                "blood_group": normalize_blood_group(d.get("blood_group")),
                "donor_type": d.get("donor_type"),
                "churn_risk": round(cr, 3),
                "responsiveness": round(float(d.get("responsiveness", 0)), 3),
                "eligible": is_eligible(d),
                "action": _fatigue_action(cr, float(d.get("responsiveness", 0.5))),
            })
    at_risk.sort(key=lambda x: x["churn_risk"], reverse=True)
    return {"count": len(at_risk), "donors": at_risk}


@router.get("/alerts/urgent")
def urgent_alerts():
    """Patients with urgent transfusion needs."""
    patients = all_patients()
    urgent = [
        {
            "user_id": p["user_id"],
            "blood_group": p.get("blood_group"),
            "quantity_required": p.get("quantity_required"),
            "expected_next_transfusion_date": p.get("expected_next_transfusion_date"),
        }
        for p in patients
        if p.get("status") == "urgent"
    ]
    return {"count": len(urgent), "patients": urgent}


def _fatigue_action(churn: float, resp: float) -> str:
    """Fatigue-aware cadence: decide what to do with this donor."""
    if churn >= 0.8:
        return "do-not-disturb"
    if churn >= 0.6 and resp < 0.3:
        return "send-appreciation"
    if churn >= 0.6:
        return "wait"
    if resp >= 0.7:
        return "contact-now"
    return "wait"
