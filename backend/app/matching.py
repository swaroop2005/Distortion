"""Donor ranking engine for ThalNet.

Given a patient (or request), scores and ranks all eligible, compatible donors
using four factors:
  1. Blood compatibility (ABO+Rh hard filter)
  2. Eligibility (90-day window hard filter)
  3. ML scores (churn_risk penalty + responsiveness boost)
  4. Geo proximity (haversine km)

Returns ranked list with human-readable reasons per donor.

Used by: bridge builder (assemble 8→1), emergency triage, outreach queue.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from .compat import can_donate, normalize_blood_group
from .eligibility import days_until_eligible, is_eligible
from .geo import donor_patient_km
from .store import all_donors, get_patient

# Weights (sum to ~1.0 for interpretability)
W_RESPONSIVENESS = 0.35
W_CHURN = 0.30
W_GEO = 0.25
W_RECENCY = 0.10

MAX_DISTANCE_KM = 200.0


def _geo_score(km: float) -> float:
    """0–1 score, 1 = same location, 0 = ≥MAX_DISTANCE_KM away."""
    if km >= MAX_DISTANCE_KM:
        return 0.0
    return round(1.0 - km / MAX_DISTANCE_KM, 4)


def _recency_score(donor: dict) -> float:
    """Higher if donor donated recently (active). 0.5 default if unknown."""
    dsld = donor.get("days_since_last_donation")
    if dsld is None or (isinstance(dsld, float) and dsld != dsld):
        return 0.5
    dsld = float(dsld)
    if dsld <= 0:
        return 0.5
    if dsld <= 90:
        return 1.0
    if dsld <= 365:
        return 0.6
    return 0.2


def rank_donors(
    patient_id: str,
    *,
    ref_date: Optional[date] = None,
    limit: int = 20,
    exclude_ids: Optional[set[str]] = None,
    blood_group_override: Optional[str] = None,
) -> list[dict]:
    """Rank donors for a patient. Returns list of {donor_id, score, reasons, ...}.

    Args:
        patient_id: user_id of the patient.
        ref_date: reference date for eligibility (default today).
        limit: max donors to return.
        exclude_ids: donor IDs to skip (already in bridge, etc.).
        blood_group_override: use instead of patient's blood_group (for emergency requests).
    """
    ref = ref_date or date.today()
    patient = get_patient(patient_id)
    if not patient:
        return []

    patient_group = blood_group_override or patient.get("blood_group")
    p_norm = normalize_blood_group(patient_group)
    if not p_norm:
        return []

    exclude = exclude_ids or set()
    donors = all_donors()
    scored = []

    for d in donors:
        did = str(d.get("user_id", ""))
        if did in exclude:
            continue

        # Hard filter 1: blood compatibility
        if not can_donate(d.get("blood_group"), patient_group):
            continue

        # Hard filter 2: eligibility
        dte = days_until_eligible(d, ref)
        if dte > 0:
            continue

        km = donor_patient_km(d, patient)
        reasons = []

        d_norm = normalize_blood_group(d.get("blood_group"))
        if d_norm == p_norm:
            reasons.append(f"exact match {d_norm}")
        else:
            reasons.append(f"{d_norm} compatible")

        geo = _geo_score(km)
        resp = float(d.get("responsiveness", 0.5))
        churn = float(d.get("churn_risk", 0.5))
        recency = _recency_score(d)

        score = (
            W_RESPONSIVENESS * resp
            + W_CHURN * (1.0 - churn)
            + W_GEO * geo
            + W_RECENCY * recency
        )
        score = round(score, 4)

        if km < 10:
            reasons.append(f"{km:.0f} km away")
        elif km < MAX_DISTANCE_KM:
            reasons.append(f"{km:.0f} km away")
        else:
            reasons.append("distant")

        if resp >= 0.7:
            reasons.append("highly responsive")
        if churn <= 0.2:
            reasons.append("reliable")
        elif churn >= 0.7:
            reasons.append("churn risk")

        scored.append({
            "donor_id": did,
            "score": score,
            "distance_km": km,
            "blood_group": d_norm,
            "churn_risk": round(churn, 3),
            "responsiveness": round(resp, 3),
            "reasons": reasons,
            "donor_name": d.get("gender", "Unknown"),
            "donor_type": d.get("donor_type", ""),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


def rank_for_emergency(
    blood_group: str,
    lat: float,
    lng: float,
    *,
    ref_date: Optional[date] = None,
    limit: int = 30,
) -> list[dict]:
    """Rank donors for an ad-hoc emergency (no patient record needed).

    Builds a synthetic patient dict and delegates to rank_donors logic.
    """
    ref = ref_date or date.today()
    p_norm = normalize_blood_group(blood_group)
    if not p_norm:
        return []

    exclude: set[str] = set()
    donors = all_donors()
    patient_stub = {"latitude": lat, "longitude": lng, "blood_group": blood_group}
    scored = []

    for d in donors:
        if not can_donate(d.get("blood_group"), blood_group):
            continue
        dte = days_until_eligible(d, ref)
        if dte > 0:
            continue

        km = donor_patient_km(d, patient_stub)
        geo = _geo_score(km)
        resp = float(d.get("responsiveness", 0.5))
        churn = float(d.get("churn_risk", 0.5))
        recency = _recency_score(d)

        score = round(
            W_RESPONSIVENESS * resp
            + W_CHURN * (1.0 - churn)
            + W_GEO * geo
            + W_RECENCY * recency,
            4,
        )

        d_norm = normalize_blood_group(d.get("blood_group"))
        reasons = [f"{d_norm} compatible"]
        if km < MAX_DISTANCE_KM:
            reasons.append(f"{km:.0f} km")
        if resp >= 0.7:
            reasons.append("responsive")
        if churn >= 0.7:
            reasons.append("churn risk")

        scored.append({
            "donor_id": str(d.get("user_id", "")),
            "score": score,
            "distance_km": km,
            "blood_group": d_norm,
            "churn_risk": round(churn, 3),
            "responsiveness": round(resp, 3),
            "reasons": reasons,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]
