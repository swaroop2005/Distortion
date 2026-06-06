"""Autonomous 3-agent orchestrator.

The core automation — replaces manual coordinator work:
  1. TRIAGE:  detect need → rank donors → build/repair bridge
  2. OUTREACH: contact ranked donors → interpret replies → follow up
  3. ESCALATE+LEARN: batch cold → broaden → flag admin → log outcomes

Locally: runs synchronously (simulate Step Functions).
AWS: each step = a Lambda, wired by Step Functions state machine.

Entry points:
  - handle_new_donor(donor): donor registers → find patients, map to bridges
  - handle_transfusion_due(patient): upcoming need → triage → outreach
  - handle_emergency(blood_group, lat, lng): ad-hoc → fast rank → outreach
  - run_outreach_cycle(request_id, ranked_donors): the contact loop
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from .bridge import build_bridge, heal_bridge, patient_bridges
from .compat import can_donate, normalize_blood_group
from .eligibility import is_eligible
from .geo import donor_patient_km
from .matching import rank_donors, rank_for_emergency
from .outreach import get_llm, log_outcome, failure_summary
from .store import all_patients, get_donor, get_patient

# ── In-memory request + event store ──────────────────────────────────────

_requests: dict[str, dict] = {}
_events: list[dict] = []


def _log_event(event_type: str, **data):
    entry = {"type": event_type, "timestamp": datetime.utcnow().isoformat(), **data}
    _events.append(entry)
    return entry


def get_events(limit: int = 50) -> list[dict]:
    return list(reversed(_events[-limit:]))


def get_request(request_id: str) -> Optional[dict]:
    return _requests.get(request_id)


def all_requests() -> list[dict]:
    return list(_requests.values())


# ── AGENT 1: TRIAGE ─────────────────────────────────────────────────────

def triage_for_patient(patient_id: str, *, ref_date: Optional[date] = None) -> dict:
    """Auto-detect need, rank donors, build/repair bridge."""
    ref = ref_date or date.today()
    patient = get_patient(patient_id)
    if not patient:
        return {"error": "patient not found"}

    request_id = str(uuid.uuid4())[:12]

    # Check existing bridges — heal if broken
    bridges = patient_bridges(patient_id)
    if bridges:
        for b in bridges:
            if b["integrity"] != "Full":
                heal_bridge(b["bridge_id"], ref_date=ref)
                _log_event("bridge_healed", request_id=request_id,
                          patient_id=patient_id, bridge_id=b["bridge_id"])

    # Build new bridge if none exists
    if not bridges:
        bridge = build_bridge(patient_id, ref_date=ref)
        _log_event("bridge_built", request_id=request_id,
                  patient_id=patient_id, bridge_id=bridge.get("bridge_id"))

    # Rank donors for outreach
    ranked = rank_donors(patient_id, ref_date=ref, limit=15)

    request = {
        "request_id": request_id,
        "patient_id": patient_id,
        "blood_group": patient.get("blood_group"),
        "status": "triaged",
        "ranked_donors": len(ranked),
        "created": datetime.utcnow().isoformat(),
        "bridges": patient_bridges(patient_id),
    }
    _requests[request_id] = request
    _log_event("triage_complete", request_id=request_id,
              patient_id=patient_id, donors_ranked=len(ranked))

    return {"request": request, "ranked_donors": ranked}


# ── AGENT 2: OUTREACH ───────────────────────────────────────────────────

def run_outreach_cycle(
    request_id: str,
    ranked_donors: list[dict],
    patient_context: Optional[dict] = None,
    max_contacts: int = 10,
) -> dict:
    """Contact ranked donors one by one. Simulate the autonomous loop."""
    llm = get_llm()
    contacted = []
    accepted = []
    declined = []
    pending = []

    impact = {
        "donors_this_month": len(ranked_donors),
        "patients_helped": len(all_patients()),
        "total_donations": 0,
    }

    for donor_info in ranked_donors[:max_contacts]:
        donor_id = donor_info["donor_id"]
        donor = get_donor(donor_id)
        if not donor:
            continue

        # Compose personalized message
        ctx = patient_context or {"distance_km": donor_info.get("distance_km", "nearby")}
        impact["total_donations"] = int(donor.get("donations_till_date", 0) or 0)
        message = llm.compose_outreach(donor, ctx, impact)

        # Simulate realistic reply using ML scores + randomness
        # In production: real donor replies interpreted by Bedrock
        import random
        resp = float(donor.get("responsiveness", 0.5))
        churn = float(donor.get("churn_risk", 0.5))
        accept_prob = resp * (1 - churn) * 0.8  # max ~64% even for best donors
        roll = random.random()

        if roll < accept_prob:
            simulated_reply = random.choice([
                "Yes, I can donate", "Sure, count me in",
                "haan bilkul, batao kab aana hai", "Yes ready"])
            label = "accept"
        elif roll < accept_prob + 0.15:
            simulated_reply = random.choice([
                "Maybe later this week", "Let me check my schedule",
                "Not sure, can you call tomorrow?", "shayad, baad mein batata hoon"])
            label = "maybe"
        elif roll < accept_prob + 0.30:
            simulated_reply = random.choice([
                "Sorry, travelling this week", "Not possible right now",
                "nahi ho payega abhi", "I'm out of town"])
            label = "decline"
        elif roll < accept_prob + 0.40:
            simulated_reply = random.choice([
                "Busy right now, ask me next month",
                "baad mein contact karo", "Not this time"])
            label = "later"
        else:
            simulated_reply = ""
            label = "no_response"

        # Interpret reply (in production, Bedrock does this on real text)
        if simulated_reply:
            interpretation = llm.interpret_reply(simulated_reply)
        else:
            interpretation = {"label": "no_response", "confidence": 1.0}

        outcome = log_outcome(
            request_id=request_id,
            donor_id=donor_id,
            action="outreach",
            message_sent=message,
            reply=simulated_reply or None,
            label=interpretation["label"],
            result="confirmed" if interpretation["label"] == "accept" else "pending",
        )

        contact_record = {
            "donor_id": donor_id,
            "blood_group": donor_info.get("blood_group"),
            "distance_km": donor_info.get("distance_km"),
            "message_preview": message[:100] + "...",
            "reply": simulated_reply or "(no response)",
            "interpretation": interpretation,
            "status": "confirmed" if interpretation["label"] == "accept" else interpretation["label"],
        }
        contacted.append(contact_record)

        if interpretation["label"] == "accept":
            accepted.append(contact_record)
            # Send impact thank-you
            thankyou = llm.compose_impact_thankyou(donor, impact)
            _log_event("donor_accepted", request_id=request_id,
                      donor_id=donor_id, thankyou_sent=True)
        elif interpretation["label"] == "decline":
            declined.append(contact_record)
        else:
            pending.append(contact_record)

    # Update request status
    if request_id in _requests:
        if accepted:
            _requests[request_id]["status"] = "matched"
        elif len(contacted) >= max_contacts:
            _requests[request_id]["status"] = "escalated"
        _requests[request_id]["contacted"] = len(contacted)
        _requests[request_id]["accepted"] = len(accepted)

    _log_event("outreach_complete", request_id=request_id,
              contacted=len(contacted), accepted=len(accepted),
              declined=len(declined), pending=len(pending))

    return {
        "request_id": request_id,
        "contacted": len(contacted),
        "accepted": len(accepted),
        "declined": len(declined),
        "pending": len(pending),
        "contacts": contacted,
    }


# ── AGENT 3: ESCALATE + LEARN ───────────────────────────────────────────

def escalate_if_needed(request_id: str) -> dict:
    """Check if batch went cold → escalate to admin."""
    req = _requests.get(request_id)
    if not req:
        return {"error": "request not found"}

    if req.get("status") == "matched":
        return {"action": "none", "reason": "already matched"}

    learning = failure_summary()

    if req.get("accepted", 0) == 0:
        req["status"] = "escalated"
        _log_event("escalated", request_id=request_id,
                  reason="no acceptances", learning=learning)
        return {
            "action": "escalate",
            "reason": "No donors accepted — broadening pool and flagging admin",
            "learning": learning,
            "suggestion": "Try donors outside immediate area or different blood-compatible groups",
        }

    return {"action": "monitor", "reason": "some acceptances, watching"}


# ── HIGH-LEVEL ENTRY POINTS ─────────────────────────────────────────────

def handle_new_donor(donor_id: str) -> dict:
    """Donor registers → find compatible patients → offer to map to bridges."""
    donor = get_donor(donor_id)
    if not donor:
        return {"error": "donor not found"}

    llm = get_llm()
    d_group = donor.get("blood_group")
    patients = all_patients()

    # Find patients this donor can help
    compatible_patients = []
    for p in patients:
        if can_donate(d_group, p.get("blood_group")):
            dist = donor_patient_km(donor, p)
            if dist < 50:
                compatible_patients.append({
                    "patient_id": p["user_id"],
                    "blood_group": p.get("blood_group"),
                    "distance_km": dist,
                })

    compatible_patients.sort(key=lambda x: x["distance_km"])

    _log_event("new_donor_processed", donor_id=donor_id,
              compatible_patients=len(compatible_patients))

    # Send welcome + clock nudge if there's a nearby patient
    nearby = compatible_patients[0] if compatible_patients else None
    nudge = llm.compose_clock_nudge(donor, nearby)

    return {
        "donor_id": donor_id,
        "blood_group": normalize_blood_group(d_group),
        "compatible_patients_nearby": len(compatible_patients),
        "nearest_patient": compatible_patients[0] if compatible_patients else None,
        "welcome_message": nudge,
        "eligible": is_eligible(donor),
    }


def handle_transfusion_due(patient_id: str) -> dict:
    """Upcoming transfusion → full autonomous cycle: triage → outreach → escalate."""
    # Step 1: Triage
    triage_result = triage_for_patient(patient_id)
    if "error" in triage_result:
        return triage_result

    request_id = triage_result["request"]["request_id"]
    ranked = triage_result["ranked_donors"]

    # Step 2: Outreach
    outreach_result = run_outreach_cycle(request_id, ranked)

    # Step 3: Escalate if needed
    escalation = escalate_if_needed(request_id)

    return {
        "request_id": request_id,
        "triage": {
            "status": triage_result["request"]["status"],
            "donors_ranked": len(ranked),
            "bridges": len(triage_result["request"].get("bridges", [])),
        },
        "outreach": {
            "contacted": outreach_result["contacted"],
            "accepted": outreach_result["accepted"],
            "declined": outreach_result["declined"],
        },
        "escalation": escalation,
        "learning": failure_summary(),
    }


def handle_emergency(blood_group: str, lat: float, lng: float) -> dict:
    """Ad-hoc emergency → fast rank → outreach."""
    ranked = rank_for_emergency(blood_group, lat, lng, limit=15)
    if not ranked:
        return {"error": "no compatible donors found"}

    request_id = str(uuid.uuid4())[:12]
    _requests[request_id] = {
        "request_id": request_id,
        "type": "emergency",
        "blood_group": blood_group,
        "status": "triaged",
        "created": datetime.utcnow().isoformat(),
    }

    outreach_result = run_outreach_cycle(request_id, ranked)
    escalation = escalate_if_needed(request_id)

    return {
        "request_id": request_id,
        "type": "emergency",
        "outreach": outreach_result,
        "escalation": escalation,
    }
