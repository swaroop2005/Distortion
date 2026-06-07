"""ThalNet FastAPI app — production-grade blood support network API.

ARCHITECTURE:
- L1: Supply optimization (data pipeline) → /supply
- L2: Coordination layer (autonomous 3-agent loop) → /agent
- Portal: Patient portal → /patients
- Portal: Donor portal → /donors
- RBAC: Admin management & analytics → /admin

ROUTING STRATEGY (production):
1. /admin/* — RBAC-protected management (CRUD all resources)
   - /admin/donors/* — Donor management (list, detail, update, delete)
   - /admin/patients/* — Patient management (list, detail, update, delete)
   - /admin/bridges/* — Bridge lifecycle management
   - /admin/dashboard — Analytics & KPIs
   - /admin/alerts/* — Churn, urgent cases

2. /patients/* — Public patient portal (read + bridge ops)
   - GET /patients/{patient_id} — Profile + active bridges
   - POST /patients/{patient_id}/bridge — Create Auto-Bridge
   - GET|POST /patients/{patient_id}/bridge/{bridge_id}* — Bridge ops

3. /donors/* — Public donor portal (read + registration + ranking)
   - GET /donors/{donor_id} — Profile + eligibility
   - GET /donors/{donor_id}/clock — Personal donation countdown
   - POST /donors/register — Self-register
   - POST /donors/rank-emergency — Emergency ranking

4. /agent/* — Autonomous orchestration (unchanged)
   - POST /agent/transfusion-due/* — Triage → Outreach → Learn
   - POST /agent/new-donor/* — New donor onboarding
   - POST /agent/emergency — Emergency circuit
   - GET /agent/requests* — Request tracking
   - GET /agent/learning — Failure analysis

5. /supply/* — L1 optimizer data exposure (unchanged)
   - GET /supply/banks — Compatible banks
   - GET /supply/regional — State-level aggregation
   - GET /supply/mobilization — Optimizer plan
   - GET /supply/patient-map — Map data

NOTES:
- No path ambiguity: POST /donors/register ≠ GET /donors/{donor_id}
- All admin routes require authentication (to be added via middleware)
- Public portals strip sensitive fields (churn, responsiveness in lists)
- Bridge operations stay in patient portal (patient-owned resource)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import admin, agent, auth, chat, connections, donors, patients, supply_routes
from .store import all_patients
from .services.bridge import build_bridge

app = FastAPI(
    title="ThalNet API",
    version="0.2.0",
    description="Blood-support autonomous network for thalassemia patients & donors",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ===== MIDDLEWARE =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== STARTUP: seed demo bridges =====
@app.on_event("startup")
async def seed_bridges() -> None:
    """Pre-build bridges for first 10 patients. Fully fault-tolerant."""
    try:
        patients_list = all_patients()
        seeded = 0
        for patient in patients_list[:10]:
            try:
                build_bridge(patient["user_id"], size=8)
                seeded += 1
            except Exception:
                pass
        print(f"[startup] Seeded {seeded} demo bridges")
    except Exception as exc:
        print(f"[startup] Bridge seeding skipped: {exc}")


# ===== ROUTERS (organized by access level) =====
# Admin: CRUD + management
app.include_router(admin.router)
app.include_router(supply_routes.router)

# Auth
app.include_router(auth.router)

# Public portals
app.include_router(donors.router)
app.include_router(patients.router)
app.include_router(chat.router)
app.include_router(connections.router)
app.include_router(agent.router)


# ===== HEALTH & STATUS =====
@app.get("/")
def root():
    """Service info."""
    return {
        "service": "ThalNet API",
        "status": "ok",
        "version": "0.2.0",
        "docs": "/docs",
        "routes": {
            "admin": "/admin/* (RBAC-protected)",
            "donors": "/donors/* (public portal)",
            "patients": "/patients/* (public portal)",
            "agent": "/agent/* (autonomous orchestration)",
            "supply": "/supply/* (L1 optimizer)",
        },
    }


@app.get("/health")
def health():
    """Liveness probe."""
    return {"status": "healthy"}


# ===== AWS LAMBDA ENTRYPOINT =====
try:
    from mangum import Mangum

    handler = Mangum(app)
except ImportError:  # local dev without mangum installed
    handler = None
