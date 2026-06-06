"""Admin routes — dashboard aggregations, bridge health, churn alerts, supply KPIs."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..bridge import all_bridges, bridge_health_summary
from ..compat import normalize_blood_group
from ..eligibility import is_eligible
from ..store import all_donors, all_patients
from ..supply_store import national_kpis, shortage_report

router = APIRouter(prefix="/admin", tags=["admin"])

CHURN_THRESHOLD = 0.6


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
