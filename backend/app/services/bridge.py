"""Auto-Bridge Builder — the flagship feature.

Assembles and maintains the 8→1 Blood Bridge: for each patient, picks 8–10
donors that are blood-compatible, geographically spread, and eligibility-
staggered so someone is always eligible every 15–20 days.

Key concepts:
  - Bridge = a patient + their assigned donor squad + coverage calendar
  - Integrity score: Full (≥8 eligible coverage) / At-risk (5-7) / Broken (<5)
  - Self-heal: when a donor churns or becomes ineligible, auto-recruit replacement
  - Predictive bridge-break alarm: flag bridges likely to break soon (churn model)
  - No-show buffer: if top donor has low responsiveness, pre-rank a backup

Stores bridges in-memory for local dev; set THALNET_DB=dynamodb for persistence.
"""
from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from ..utils.eligibility import days_until_eligible, is_eligible
from .matching import rank_donors
from .store import get_donor, get_patient

USE_DYNAMO = os.getenv("THALNET_DB", "").lower() == "dynamodb"


def _dynamo_save(bridge_dict: dict):
    if not USE_DYNAMO:
        return
    try:
        from . import db
        db.put_bridge(bridge_dict["bridge_id"], bridge_dict)
    except Exception:
        pass  # never crash on persistence failure — in-memory is source of truth


def _dynamo_load_all() -> list[dict]:
    if not USE_DYNAMO:
        return []
    try:
        from . import db
        return db.scan_bridges()
    except Exception:
        return []

TARGET_BRIDGE_SIZE = 8
MAX_BRIDGE_SIZE = 10
TRANSFUSION_CYCLE_DAYS = 18  # midpoint of 15–20 day range
CHURN_ALARM_THRESHOLD = 0.6
RESPONSIVENESS_BUFFER_THRESHOLD = 0.4

# In-memory bridge store (local dev)
_bridges: dict[str, "Bridge"] = {}


@dataclass
class BridgeDonor:
    donor_id: str
    blood_group: Optional[str] = None
    distance_km: float = 0.0
    churn_risk: float = 0.0
    responsiveness: float = 0.5
    days_to_eligible: int = 0
    active: bool = True


@dataclass
class Bridge:
    bridge_id: str
    patient_id: str
    blood_group: str
    donors: list[BridgeDonor] = field(default_factory=list)
    created: str = ""
    integrity: str = "Broken"
    coverage_days: int = 0
    alarms: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "bridge_id": self.bridge_id,
            "patient_id": self.patient_id,
            "blood_group": self.blood_group,
            "integrity": self.integrity,
            "donor_count": len([d for d in self.donors if d.active]),
            "coverage_days": self.coverage_days,
            "alarms": self.alarms,
            "donors": [
                {
                    "donor_id": d.donor_id,
                    "blood_group": d.blood_group,
                    "distance_km": d.distance_km,
                    "churn_risk": d.churn_risk,
                    "responsiveness": d.responsiveness,
                    "days_to_eligible": d.days_to_eligible,
                    "active": d.active,
                }
                for d in self.donors
            ],
            "created": self.created,
        }


def _compute_coverage(donors: list[BridgeDonor], ref: date) -> int:
    """Estimate how many days of the next cycle are covered by eligible donors.

    Staggering logic: count distinct eligibility windows that fall within the
    next TRANSFUSION_CYCLE_DAYS * 3 period (covers ~3 transfusion cycles).
    """
    horizon = TRANSFUSION_CYCLE_DAYS * 3
    covered_days = set()
    for d in donors:
        if not d.active:
            continue
        start = max(0, d.days_to_eligible)
        # A donor covers from their eligible date for ~TRANSFUSION_CYCLE_DAYS
        for day in range(start, min(start + TRANSFUSION_CYCLE_DAYS, horizon)):
            covered_days.add(day)
    return len(covered_days)


def _compute_integrity(active_count: int, coverage: int) -> str:
    if active_count >= TARGET_BRIDGE_SIZE and coverage >= TRANSFUSION_CYCLE_DAYS * 2:
        return "Full"
    if active_count >= 5 and coverage >= TRANSFUSION_CYCLE_DAYS:
        return "At-risk"
    return "Broken"


def _check_alarms(donors: list[BridgeDonor]) -> list[str]:
    """Predictive alarms based on churn risk and responsiveness."""
    alarms = []
    active = [d for d in donors if d.active]

    high_churn = [d for d in active if d.churn_risk >= CHURN_ALARM_THRESHOLD]
    if len(high_churn) >= 2:
        alarms.append(
            f"Bridge-break risk: {len(high_churn)} donors have high churn probability"
        )
    elif len(high_churn) == 1:
        alarms.append(f"Donor {high_churn[0].donor_id[:8]}.. showing churn risk")

    low_resp = [d for d in active if d.responsiveness < RESPONSIVENESS_BUFFER_THRESHOLD]
    if len(low_resp) >= 3:
        alarms.append(
            f"No-show risk: {len(low_resp)} donors have low responsiveness"
        )

    if len(active) < TARGET_BRIDGE_SIZE:
        deficit = TARGET_BRIDGE_SIZE - len(active)
        alarms.append(f"Understaffed: need {deficit} more donor(s)")

    return alarms


def build_bridge(
    patient_id: str,
    *,
    ref_date: Optional[date] = None,
    size: int = TARGET_BRIDGE_SIZE,
) -> dict:
    """Build a new 8→1 bridge for a patient. Returns bridge dict."""
    ref = ref_date or date.today()
    patient = get_patient(patient_id)
    if not patient:
        return {"error": "patient not found"}

    ranked = rank_donors(patient_id, ref_date=ref, limit=size + 5)

    donors = []
    for r in ranked[:size]:
        d_rec = get_donor(r["donor_id"])
        dte = days_until_eligible(d_rec, ref) if d_rec else 0
        donors.append(
            BridgeDonor(
                donor_id=r["donor_id"],
                blood_group=r["blood_group"],
                distance_km=r["distance_km"],
                churn_risk=r["churn_risk"],
                responsiveness=r["responsiveness"],
                days_to_eligible=max(0, dte),
            )
        )

    coverage = _compute_coverage(donors, ref)
    active_count = len(donors)
    integrity = _compute_integrity(active_count, coverage)
    alarms = _check_alarms(donors)

    bridge = Bridge(
        bridge_id=str(uuid.uuid4())[:12],
        patient_id=patient_id,
        blood_group=patient.get("blood_group", ""),
        donors=donors,
        created=ref.isoformat(),
        integrity=integrity,
        coverage_days=coverage,
        alarms=alarms,
    )

    _bridges[bridge.bridge_id] = bridge
    _dynamo_save(bridge.to_dict())
    return bridge.to_dict()


def heal_bridge(bridge_id: str, *, ref_date: Optional[date] = None) -> dict:
    """Self-heal: replace inactive/churned donors to restore bridge health."""
    ref = ref_date or date.today()
    bridge = _bridges.get(bridge_id)
    if not bridge:
        return {"error": "bridge not found"}

    # Mark high-churn donors as inactive (simulates churn detection)
    for d in bridge.donors:
        if d.churn_risk >= 0.8:
            d.active = False

    active = [d for d in bridge.donors if d.active]
    deficit = TARGET_BRIDGE_SIZE - len(active)

    if deficit <= 0:
        bridge.alarms = _check_alarms(bridge.donors)
        bridge.coverage_days = _compute_coverage(bridge.donors, ref)
        bridge.integrity = _compute_integrity(len(active), bridge.coverage_days)
        return bridge.to_dict()

    existing_ids = {d.donor_id for d in bridge.donors}
    replacements = rank_donors(
        bridge.patient_id,
        ref_date=ref,
        limit=deficit + 3,
        exclude_ids=existing_ids,
    )

    for r in replacements[:deficit]:
        d_rec = get_donor(r["donor_id"])
        dte = days_until_eligible(d_rec, ref) if d_rec else 0
        bridge.donors.append(
            BridgeDonor(
                donor_id=r["donor_id"],
                blood_group=r["blood_group"],
                distance_km=r["distance_km"],
                churn_risk=r["churn_risk"],
                responsiveness=r["responsiveness"],
                days_to_eligible=max(0, dte),
                active=True,
            )
        )

    active = [d for d in bridge.donors if d.active]
    bridge.coverage_days = _compute_coverage(bridge.donors, ref)
    bridge.integrity = _compute_integrity(len(active), bridge.coverage_days)
    bridge.alarms = _check_alarms(bridge.donors)

    _dynamo_save(bridge.to_dict())
    return bridge.to_dict()


def get_bridge(bridge_id: str) -> Optional[dict]:
    b = _bridges.get(bridge_id)
    if b:
        return b.to_dict()
    if USE_DYNAMO:
        try:
            from . import db
            return db.get_bridge(bridge_id)
        except Exception:
            pass
    return None


def patient_bridges(patient_id: str) -> list[dict]:
    return [
        b.to_dict() for b in _bridges.values() if b.patient_id == patient_id
    ]


def all_bridges() -> list[dict]:
    mem = [b.to_dict() for b in _bridges.values()]
    if USE_DYNAMO and not mem:
        # cold start — return persisted bridges if memory is empty
        return _dynamo_load_all()
    return mem


def bridge_health_summary() -> dict:
    """Admin overview: how many bridges in each state."""
    bridges = list(_bridges.values())
    total = len(bridges)
    full = sum(1 for b in bridges if b.integrity == "Full")
    at_risk = sum(1 for b in bridges if b.integrity == "At-risk")
    broken = sum(1 for b in bridges if b.integrity == "Broken")
    alarmed = sum(1 for b in bridges if b.alarms)
    return {
        "total": total,
        "full": full,
        "at_risk": at_risk,
        "broken": broken,
        "bridges_with_alarms": alarmed,
    }
