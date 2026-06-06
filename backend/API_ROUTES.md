# ThalNet API Routes — Production Documentation

**Version:** 0.2.0 | **Last Updated:** 2026-06-06

---

## Overview

ThalNet API is organized into 5 logical domains:

1. **`/admin/*`** — RBAC-protected administrative CRUD operations
2. **`/donors/*`** — Public donor portal (self-service)
3. **`/patients/*`** — Public patient portal (self-service)
4. **`/agent/*`** — Autonomous orchestration layer (3-agent loop)
5. **`/supply/*`** — L1 supply optimization data

No path ambiguity. All endpoints have proper HTTP semantics.

---

## 1. ADMIN API (`/admin/*`)

**RBAC Protection:** TODO — Add auth middleware before production.

### Donor Management

#### `GET /admin/donors`
List all donors with full details (paginated).

**Query Params:**
- `limit` (int, default=50, max=500) — Items per page
- `skip` (int, default=0, min=0) — Offset

**Response:**
```json
{
  "total": 4446,
  "skip": 0,
  "limit": 50,
  "donors": [
    {
      "user_id": "D001",
      "blood_group": "O Positive",
      "donor_type": "whole_blood",
      "latitude": 17.385,
      "longitude": 78.486,
      "churn_risk": 0.245,
      "responsiveness": 0.789,
      "eligible": true,
      "donations_till_date": 12,
      "total_calls": 34
    }
  ]
}
```

#### `GET /admin/donors/{donor_id}`
Get full donor profile (admin view).

**Response:** Donor detail object (see above).

#### `PUT /admin/donors/{donor_id}`
Update donor profile (partial updates).

**Body:**
```json
{
  "blood_group": "O Positive",
  "donor_type": "whole_blood",
  "latitude": 17.385,
  "longitude": 78.486,
  "donor_status": "active"
}
```

**Response:**
```json
{
  "status": "updated",
  "donor_id": "D001",
  "message": "Donor D001 updated successfully"
}
```

#### `DELETE /admin/donors/{donor_id}`
Deactivate donor (soft delete).

**Response:**
```json
{
  "status": "deactivated",
  "donor_id": "D001",
  "message": "Donor D001 has been deactivated"
}
```

---

### Patient Management

#### `GET /admin/patients`
List all patients with full details (paginated).

**Query Params:**
- `limit` (int, default=20, max=100)
- `skip` (int, default=0, min=0)

**Response:**
```json
{
  "total": 84,
  "skip": 0,
  "limit": 20,
  "patients": [
    {
      "user_id": "P001",
      "blood_group": "AB Negative",
      "latitude": 17.385,
      "longitude": 78.486,
      "quantity_required": 2,
      "expected_next_transfusion_date": "2026-06-15"
    }
  ]
}
```

#### `GET /admin/patients/{patient_id}`
Get full patient profile (admin view).

#### `PUT /admin/patients/{patient_id}`
Update patient profile (partial updates).

**Body:**
```json
{
  "blood_group": "AB Negative",
  "latitude": 17.385,
  "longitude": 78.486,
  "quantity_required": 2,
  "patient_status": "active"
}
```

#### `DELETE /admin/patients/{patient_id}`
Deactivate patient (soft delete).

---

### Bridge Management

#### `GET /admin/bridges`
List all active bridges.

**Response:**
```json
{
  "total": 47,
  "bridges": [
    {
      "bridge_id": "BR001",
      "patient_id": "P001",
      "size": 8,
      "donor_ids": ["D001", "D002", ...],
      "status": "active",
      "created_at": "2026-06-06T10:30:00Z"
    }
  ]
}
```

#### `GET /admin/bridges/{bridge_id}`
Get bridge details & status.

#### `DELETE /admin/bridges/{bridge_id}`
Close bridge (deactivate).

#### `POST /admin/bridges/{bridge_id}/heal`
Manually trigger bridge self-healing (admin override).

**Response:**
```json
{
  "status": "healed",
  "bridge_id": "BR001",
  "result": {...}
}
```

---

### Analytics & Alerts

#### `GET /admin/dashboard`
Single-call dashboard payload.

**Response:**
```json
{
  "total_donors": 4446,
  "eligible_donors": 1234,
  "total_patients": 84,
  "high_churn_count": 89,
  "blood_group_distribution": {
    "O Positive": 1200,
    "O Negative": 450,
    ...
  },
  "bridge_health": {
    "active": 47,
    "healing": 3,
    "failed": 1
  }
}
```

#### `GET /admin/alerts/churn`
Donors at risk of churning.

**Query Params:**
- `threshold` (float, default=0.6, range 0–1) — Churn threshold

**Response:**
```json
{
  "count": 89,
  "donors": [
    {
      "user_id": "D123",
      "blood_group": "O Positive",
      "churn_risk": 0.85,
      "responsiveness": 0.12,
      "action": "do-not-disturb"
    }
  ]
}
```

**Action values:**
- `do-not-disturb` — Churn ≥ 0.8 (rest them)
- `send-appreciation` — Churn ≥ 0.6 AND responsiveness < 0.3
- `wait` — Churn ≥ 0.6 (monitor)
- `contact-now` — Responsiveness ≥ 0.7 (engaged)

#### `GET /admin/alerts/urgent`
Patients with urgent transfusion needs.

**Response:**
```json
{
  "count": 8,
  "patients": [
    {
      "user_id": "P042",
      "blood_group": "AB Negative",
      "quantity_required": 2,
      "expected_next_transfusion_date": "2026-06-08"
    }
  ]
}
```

---

## 2. DONOR API (`/donors/*`)

**Access:** Public

### Listing & Discovery

#### `GET /donors/`
Public donor listing (restricted).

**Response:**
```json
{
  "message": "Public donor listing is anonymized. For full donor management, use /admin/donors",
  "contact": "admin@thalnet.local"
}
```

#### `GET /donors/{donor_id}`
Get donor public profile.

**Response:**
```json
{
  "user_id": "D001",
  "blood_group": "O Positive",
  "donor_type": "whole_blood",
  "latitude": 17.385,
  "longitude": 78.486,
  "churn_risk": 0.245,
  "responsiveness": 0.789,
  "eligible": true,
  "days_to_eligible": 0,
  "next_eligible_date": null,
  "donations_till_date": 12,
  "total_calls": 34
}
```

#### `GET /donors/{donor_id}/clock`
Personal Donation Clock (proactive view).

**Response:**
```json
{
  "eligible_now": true,
  "days_to_eligible": 0,
  "next_eligible_date": null,
  "blood_group": "O Positive",
  "donations_count": 12,
  "message": "You are eligible to donate now! 🩸"
}
```

---

### Emergency Matching

#### `POST /donors/rank-emergency`
Rank donors for emergency request.

**Body:**
```json
{
  "blood_group": "O Positive",
  "latitude": 17.385,
  "longitude": 78.486,
  "limit": 20
}
```

**Response:**
```json
{
  "count": 12,
  "donors": [
    {
      "user_id": "D001",
      "distance_km": 2.3,
      "score": 0.92,
      "eligible": true,
      "churn_risk": 0.245
    }
  ]
}
```

---

### Registration

#### `POST /donors/register`
Register as new donor.

**Body:**
```json
{
  "blood_group": "O Positive",
  "gender": "Male",
  "latitude": 17.385,
  "longitude": 78.486
}
```

**Response:**
```json
{
  "status": "registered",
  "blood_group": "O Positive",
  "message": "Welcome to the Blood Bridge network! You are now eligible for matching.",
  "note": "Demo mode — stored in-memory. Production writes to DynamoDB."
}
```

---

## 3. PATIENT API (`/patients/*`)

**Access:** Public

### Listing & Discovery

#### `GET /patients/`
Public patient listing (restricted).

**Response:**
```json
{
  "message": "Patient registry is admin-only. Use GET /{patient_id} for individual queries.",
  "contact": "admin@thalnet.local"
}
```

#### `GET /patients/{patient_id}`
Get patient profile with active bridges.

**Response:**
```json
{
  "user_id": "P001",
  "blood_group": "AB Negative",
  "latitude": 17.385,
  "longitude": 78.486,
  "quantity_required": 2,
  "expected_next_transfusion_date": "2026-06-15",
  "bridges": [
    {
      "bridge_id": "BR001",
      "size": 8,
      "status": "active",
      "donors": [...]
    }
  ]
}
```

---

### Bridge Operations

#### `POST /patients/{patient_id}/bridge`
Create new Auto-Bridge (8→1, self-healing, staggered).

**Body:**
```json
{
  "size": 8
}
```

**Validation:**
- `size` ≥ 2 (minimum)
- `size` ≤ 20 (maximum)

**Response:**
```json
{
  "bridge_id": "BR001",
  "patient_id": "P001",
  "size": 8,
  "donor_ids": ["D001", "D002", "D003", ...],
  "schedule": [...],
  "status": "active",
  "created_at": "2026-06-06T10:30:00Z"
}
```

#### `GET /patients/{patient_id}/bridge/{bridge_id}`
Get bridge status, schedule, history.

**Response:**
```json
{
  "bridge_id": "BR001",
  "patient_id": "P001",
  "size": 8,
  "status": "active",
  "donors": [
    {
      "donor_id": "D001",
      "scheduled_date": "2026-06-06",
      "status": "pending"
    }
  ],
  "schedule": [...],
  "integrity_check": "passed",
  "created_at": "2026-06-06T10:30:00Z"
}
```

#### `POST /patients/{patient_id}/bridge/{bridge_id}/heal`
Trigger self-healing (donor dropout recovery).

**Response:**
```json
{
  "status": "healed",
  "bridge_id": "BR001",
  "replaced_donor": "D003",
  "new_donor": "D042",
  "message": "Dropped donor replaced, stagger maintained",
  "integrity_check": "passed"
}
```

---

## 4. AGENT API (`/agent/*`)

**Access:** Internal (orchestration)

### Autonomous Orchestration

#### `POST /agent/transfusion-due/{patient_id}`
Trigger full autonomous cycle: Triage → Outreach → Escalate → Learn.

**Response:**
```json
{
  "status": "triggered",
  "patient_id": "P001",
  "request_id": "REQ001",
  "phase": "triage",
  "message": "Full autonomous cycle initiated"
}
```

#### `POST /agent/new-donor/{donor_id}`
Donor registers → find patients → map bridges → welcome msg.

**Response:**
```json
{
  "status": "triggered",
  "donor_id": "D001",
  "message": "Welcome! Matching to patients..."
}
```

#### `POST /agent/emergency`
Ad-hoc emergency → fast rank → outreach.

**Body:**
```json
{
  "blood_group": "O Positive",
  "latitude": 17.385,
  "longitude": 78.486
}
```

### Request Tracking

#### `GET /agent/requests`
List all requests (paginated).

#### `GET /agent/requests/{request_id}`
Get request details (full cycle).

#### `GET /agent/events`
Event log (limit default=50).

**Response:**
```json
{
  "events": [
    {
      "timestamp": "2026-06-06T10:30:00Z",
      "request_id": "REQ001",
      "phase": "outreach",
      "event": "message_sent",
      "donor_id": "D001"
    }
  ]
}
```

#### `GET /agent/outcomes`
Get outcomes for a request.

**Query Params:**
- `request_id` (string, optional) — Filter by request

#### `GET /agent/learning`
Failure learning summary.

#### `GET /agent/review/{request_id}`
Full review of outreach cycle.

**Response:**
```json
{
  "request_id": "REQ001",
  "total_contacted": 12,
  "breakdown": {
    "accept": 8,
    "decline": 2,
    "no_response": 2
  },
  "accept_rate": 0.67,
  "quality": "Good",
  "outcomes": [...],
  "learning": {...}
}
```

---

## 5. SUPPLY API (`/supply/*`)

**Access:** Public (read-only)

### Optimization Data

#### `GET /supply/banks`
Blood banks with compatible stock.

**Query Params:**
- `blood_group` (string, required) — e.g. "O Positive"
- `district` (string, default="Hyderabad")
- `max_km` (float, default=200.0)

**Response:**
```json
{
  "banks": [
    {
      "bank_id": "B001",
      "name": "Blood Bank Hospital",
      "district": "Hyderabad",
      "distance_km": 2.3,
      "stock": 45,
      "phones": [...]
    }
  ]
}
```

#### `GET /supply/regional`
Aggregate supply by blood group for state.

**Query Params:**
- `state` (string, default="Telangana")

**Response:**
```json
{
  "state": "Telangana",
  "summary": {
    "O Positive": 1200,
    "O Negative": 450,
    ...
  }
}
```

#### `GET /supply/mobilization`
Optimizer's mobilization plan (donors selected to fill gaps).

**Response:**
```json
{
  "donors": [
    {
      "donor_id": "D001",
      "action": "contact_now",
      "reason": "gap_in_O_positive",
      "priority": "high"
    }
  ]
}
```

#### `GET /supply/patient-map`
All data for patient map view: nearby donors, banks, stats.

**Query Params:**
- `blood_group` (string, required)
- `district` (string, default="Hyderabad")

**Response:**
```json
{
  "blood_group": "O Positive",
  "nearby_donors": [...],
  "nearby_banks": [...],
  "stats": {
    "eligible_donors": 234,
    "total_stock": 1200
  }
}
```

---

## Error Codes

| Code | Meaning | Example |
|------|---------|---------|
| `200` | OK | Data returned |
| `400` | Bad Request | Invalid blood group, bridge size out of range |
| `404` | Not Found | Donor/patient/bridge doesn't exist |
| `500` | Internal Error | Service failure |

---

## Future: RBAC

Before production, add authentication middleware to protect `/admin/*`:

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def admin_only(credentials = Depends(security)):
    # Validate JWT, check admin role
    pass
```

Apply to all admin routes via dependency injection.

---

## Testing

Start server:
```bash
.venv/bin/uvicorn backend.app.main:app --reload --port 8000
```

Visit docs:
```
http://localhost:8000/docs
```

---

**Last Generated:** 2026-06-06  
**Generated By:** Claude (Distortion Team)
