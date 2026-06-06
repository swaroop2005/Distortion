"""ThalNet FastAPI app.

Thin skeleton for the hackathon. Runs locally with uvicorn and on AWS Lambda
via the Mangum adapter (see `handler` at the bottom). Real routes (requests,
donors, chat, dashboard) get added as the 3-agent loop comes online.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import admin, agent, donors, patients, supply_routes

app = FastAPI(title="ThalNet API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(donors.router)
app.include_router(admin.router)
app.include_router(agent.router)
app.include_router(supply_routes.router)


@app.get("/")
def root():
    return {"service": "ThalNet API", "status": "ok", "version": "0.1.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}


# AWS Lambda entrypoint (API Gateway -> Mangum -> FastAPI).
try:
    from mangum import Mangum

    handler = Mangum(app)
except ImportError:  # local dev without mangum installed
    handler = None
