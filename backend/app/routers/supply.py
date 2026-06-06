"""Supply-chain API routes.

Exposes real-time blood stock data (e-RaktKosh, 44k rows / 3863 banks),
optimizer shortage forecast, donor mobilization list, and bank-to-bank
transfer plan.

Key use-cases:
  Donor view   — "How urgently is my blood type needed?" → GET /supply/demand-forecast
  Patient view — "Which nearby banks have blood for me?" → GET /supply/banks?lat=&lon=&blood_group=
  Admin view   — National KPIs + shortage breakdown     → GET /supply/summary, /supply/shortage
  Seam to ThalNet outreach agent                        → GET /supply/mobilization
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..supply_store import (
    banks_with_stock,
    mobilization_plan,
    national_kpis,
    shortage_report,
    stock_summary,
    transfer_plan,
    under_safety_banks,
)

router = APIRouter(prefix="/supply", tags=["supply"])


# ──────────────────────────────────────────────
# Current blood stock
# ──────────────────────────────────────────────

@router.get("/summary")
def summary(
    state: Optional[str] = Query(None, description="State name, e.g. Telangana"),
    district: Optional[str] = Query(None, description="District name, e.g. Hyderabad"),
    blood_group: Optional[str] = Query(None, description="Canonical group: O+, AB-, A+, …"),
    component_type: Optional[str] = Query(None, description="e.g. Whole Blood, Packed Red Blood Cells"),
):
    """
    Blood stock summary — total units nationwide (or scoped) by blood group and component.

    Blood groups sorted scarcest-first so the most critical gaps are always at the top.
    Leave all params empty for the national picture.
    """
    return stock_summary(
        state=state,
        district=district,
        blood_group=blood_group,
        component_type=component_type,
    )


@router.get("/banks")
def banks(
    district: Optional[str] = Query(None, description="Filter by district name"),
    state: Optional[str] = Query(None, description="Filter by state name"),
    blood_group: Optional[str] = Query(None, description="e.g. O+, AB-, A+"),
    component_type: Optional[str] = Query(None, description="e.g. Whole Blood"),
    lat: Optional[float] = Query(None, description="Your latitude — auto-resolve to nearest district"),
    lon: Optional[float] = Query(None, description="Your longitude — auto-resolve to nearest district"),
    radius_districts: int = Query(3, ge=1, le=10, description="How many nearest districts to search"),
    min_units: int = Query(1, ge=1),
    limit: int = Query(30, le=200),
):
    """
    Blood banks with available stock.

    **Geo query (recommended):** pass `lat` + `lon` and optionally `blood_group`.
    The API finds the nearest districts and returns banks sorted by proximity.

    **Explicit filter:** pass `district` or `state` directly.

    Results include phone/email from the bank registry so the caller can contact
    the bank directly.
    """
    result = banks_with_stock(
        district=district,
        state=state,
        blood_group=blood_group,
        component_type=component_type,
        lat=lat,
        lon=lon,
        radius_districts=radius_districts,
        min_units=min_units,
        limit=limit,
    )
    return {
        "count": len(result),
        "query": {
            "lat": lat, "lon": lon,
            "district": district, "state": state,
            "blood_group": blood_group, "component_type": component_type,
        },
        "banks": result,
    }


# ──────────────────────────────────────────────
# Optimizer outputs (pre-computed; run optimizer.run to refresh)
# ──────────────────────────────────────────────

@router.get("/shortage")
def shortage(blood_group: Optional[str] = Query(None)):
    """
    Pre-computed shortage forecast from the supply-chain optimizer.

    Groups sorted by days-of-coverage (worst first).

    Status: CRITICAL = < 7 days · LOW = 7–21 days · OK = > 21 days.

    Refresh: `python -m optimizer.run --demand-scale 30 --mode both`
    """
    rows = shortage_report()
    if not rows:
        return {
            "message": "No shortage report on disk. Run: python -m optimizer.run --demand-scale 30",
            "critical": [],
            "low": [],
            "ok": [],
        }

    if blood_group:
        rows = [r for r in rows if r.get("blood_group") == blood_group.upper().strip()]

    # Coerce numerics and sort worst-first
    for r in rows:
        for k in ("supply_units", "horizon_demand", "daily_demand",
                  "days_of_coverage", "shortfall_units"):
            try:
                r[k] = float(r[k])
            except (ValueError, TypeError, KeyError):
                r[k] = 0.0

    rows.sort(key=lambda r: r.get("days_of_coverage", 9999))

    critical = [r for r in rows if r.get("status") == "CRITICAL"]
    low = [r for r in rows if r.get("status") == "LOW"]
    ok = [r for r in rows if r.get("status") == "OK"]

    return {
        "summary": {
            "critical_count": len(critical),
            "low_count": len(low),
            "ok_count": len(ok),
            "total_groups": len(rows),
        },
        "critical": critical,
        "low": low,
        "ok": ok,
    }


@router.get("/demand-forecast")
def demand_forecast(blood_group: Optional[str] = Query(None)):
    """
    Demand forecast by blood group: daily rate, 30-day demand, days of supply coverage.

    Sorted scarcest-first — the top entry is the group most at risk.

    This is the key "how urgently is my blood needed?" signal shown to donors.
    """
    rows = shortage_report()
    if not rows:
        return {"error": "No forecast available. Run: python -m optimizer.run --demand-scale 30"}

    if blood_group:
        bg = blood_group.upper().strip()
        rows = [r for r in rows if r.get("blood_group") == bg]
        if not rows:
            raise HTTPException(404, f"No forecast data for blood group '{bg}'")

    forecast = []
    for r in rows:
        try:
            days = float(r.get("days_of_coverage", 9999))
            daily = float(r.get("daily_demand", 0))
            supply = float(r.get("supply_units", 0))
            demand30 = float(r.get("horizon_demand", 0))
            shortfall = float(r.get("shortfall_units", 0))
        except (ValueError, TypeError):
            continue

        # Human-readable urgency label
        if days < 7:
            urgency = "CRITICAL — less than a week of stock"
        elif days < 21:
            urgency = "LOW — 1–3 weeks of stock remaining"
        elif days < 60:
            urgency = "MODERATE — 3–8 weeks of stock"
        else:
            urgency = "ADEQUATE"

        forecast.append({
            "blood_group": r.get("blood_group"),
            "status": r.get("status", "UNKNOWN"),
            "urgency_message": urgency,
            "days_of_coverage": round(days, 1),
            "daily_demand_units": round(daily, 2),
            "demand_next_30_days": round(demand30, 1),
            "current_supply_units": round(supply, 1),
            "shortfall_units": round(shortfall, 1),
        })

    forecast.sort(key=lambda x: x["days_of_coverage"])
    return {
        "count": len(forecast),
        "note": "Demand modelled from patient transfusion schedules in Dataset.csv × scale factor.",
        "forecast": forecast,
    }


@router.get("/mobilization")
def mobilization(
    blood_group: Optional[str] = Query(None, description="e.g. AB-, O+"),
    district: Optional[str] = Query(None, description="Filter by district"),
    limit: int = Query(50, le=500),
):
    """
    Ranked donor mobilization list — the Layer 1 → Layer 2 seam.

    These are the donors the ThalNet outreach agent should contact next, ordered
    by proximity + eligibility. Generated by the supply-chain optimizer from
    `Dataset.csv` + shortage analysis.

    Refresh: `python -m optimizer.run --demand-scale 30`
    """
    rows = mobilization_plan(blood_group=blood_group, district=district, limit=limit)
    if not rows:
        return {
            "message": "No mobilization plan on disk. Run: python -m optimizer.run --demand-scale 30",
            "count": 0,
            "donors": [],
        }

    # Group summary for the caller
    by_group: dict[str, int] = {}
    for r in rows:
        g = r.get("blood_group", "?")
        by_group[g] = by_group.get(g, 0) + 1

    return {
        "count": len(rows),
        "by_blood_group": sorted(by_group.items(), key=lambda x: -x[1]),
        "donors": rows,
    }


@router.get("/transfers")
def transfers(
    blood_group: Optional[str] = Query(None),
    limit: int = Query(50, le=500),
):
    """
    Recommended bank-to-bank blood transfers (from optimizer redistribution engine).

    Shows which surplus banks should ship to which deficit banks, with distance and units.
    """
    rows = transfer_plan(blood_group=blood_group, limit=limit)
    if not rows:
        return {"message": "No transfer plan on disk.", "count": 0, "transfers": []}
    return {"count": len(rows), "transfers": rows}


@router.get("/under-safety")
def under_safety(
    state: Optional[str] = Query(None),
    blood_group: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    """
    Banks still below the safety-stock floor even after rebalancing.

    These are the highest-risk locations — ThalNet should prioritise mobilizing
    donors near these banks.
    """
    rows = under_safety_banks(state=state, blood_group=blood_group, limit=limit)
    return {"count": len(rows), "banks": rows}


@router.get("/kpis")
def kpis():
    """
    Single-call national KPI snapshot for the top of any dashboard:
    total banks, total units, critical groups, donors to mobilize.
    """
    return national_kpis()
