"""Admin routes — dashboard aggregations, bridge health, churn alerts."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..bridge import all_bridges, bridge_health_summary
from ..compat import normalize_blood_group
from ..eligibility import is_eligible
from ..store import all_donors, all_patients

router = APIRouter(prefix="/admin", tags=["admin"])

CHURN_THRESHOLD = 0.6


@router.get("/dashboard")
def dashboard():
    """Single-call dashboard payload for the admin view."""
    donors = all_donors()
    patients = all_patients()

    eligible = sum(1 for d in donors if is_eligible(d))
    high_churn = [
        d for d in donors if float(d.get("churn_risk", 0)) >= CHURN_THRESHOLD
    ]

    # Blood group distribution
    group_counts: dict[str, int] = {}
    for d in donors:
        g = normalize_blood_group(d.get("blood_group"))
        if g:
            group_counts[g] = group_counts.get(g, 0) + 1

    return {
        "total_donors": len(donors),
        "eligible_donors": eligible,
        "total_patients": len(patients),
        "high_churn_count": len(high_churn),
        "blood_group_distribution": group_counts,
        "bridge_health": bridge_health_summary(),
    }


@router.get("/churn-alerts")
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


@router.get("/bridges")
def list_bridges():
    return {"bridges": all_bridges()}
