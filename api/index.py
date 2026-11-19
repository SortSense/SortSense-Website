"""
SortSense Cloud FastAPI Application
Hosts Cloud API endpoints for SortSense Hardware (ESP32-S3),
AI Inference Backend, and Campus Monitoring Web Dashboard.
"""

from fastapi import APIRouter, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict, List

from api.db import db
from api.models import (
    AnalyticsResponse,
    EmptyPayload,
    LiveStatusResponse,
    ProvisionPayload,
    TelemetryPayload,
    WasteDropEventPayload,
)

app = FastAPI(
    title="SortSense API",
    description="Cloud API for SortSense Smart Campus Waste Management System",
    version="1.0.0",
)

# CORS middleware for Next.js frontend and external clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router for endpoints with /api prefix and root level
api_router = APIRouter()


# ---------------------------------------------------------
# Health and Diagnostics
# ---------------------------------------------------------

@api_router.get("/")
def root():
    return {
        "message": "Welcome to SortSense API",
        "service": "SortSense Cloud API",
        "status": "running",
        "version": "1.0.0",
    }


@api_router.get("/health")
def health_check():
    return {
        "status": "OK",
        "service": "SortSense API",
        "database_connected": bool(db.client is not None),
    }


# ---------------------------------------------------------
# 1. Telemetry Ingestion (Called by ESP32-S3 ToF Sensors)
# ---------------------------------------------------------

@api_router.post("/telemetry/fill-levels", status_code=status.HTTP_200_OK)
def ingest_telemetry(payload: TelemetryPayload) -> Dict[str, Any]:
    """
    Ingest ToF bin fill levels from ESP32-S3.
    Updates station_status and marks station online with current timestamp.
    """
    result = db.record_telemetry(payload)
    return result


# ---------------------------------------------------------
# 2. Waste Drop Event Ingestion (Called by AI/LLM Backend)
# ---------------------------------------------------------

@api_router.post("/events/log-waste", status_code=status.HTTP_201_CREATED)
def log_waste_event(payload: WasteDropEventPayload) -> Dict[str, Any]:
    """
    Ingest verified waste drop logs from AI/LLM Backend.
    Records the event, validates classification confidence and sorting correctness.
    Returns 201 Created.
    """
    event = db.record_waste_drop(payload)
    return {
        "status": "created",
        "message": "Waste drop event recorded successfully",
        "event": event,
    }


# ---------------------------------------------------------
# 3. Live Campus Station Status Feed
# ---------------------------------------------------------

@api_router.get("/dashboard/live-status", response_model=LiveStatusResponse)
def get_live_status():
    """
    Retrieve live status for all campus stations.
    Calculates max_fill_pct and status_color (<60=green, 60-84=yellow, >=85=red).
    """
    return db.get_live_status()


# ---------------------------------------------------------
# 4. Daily Analytics Feed
# ---------------------------------------------------------

@api_router.get("/dashboard/analytics", response_model=AnalyticsResponse)
def get_analytics():
    """
    Retrieve daily waste recycling metrics:
    - total_items_today
    - sorting_accuracy_pct
    - breakdown (plastic, paper, metal, general)
    """
    return db.get_analytics()


@api_router.get("/dashboard/recent-events")
def get_recent_events(limit: int = 15):
    """
    Retrieve recent verified waste drop events for live activity stream.
    """
    return {"events": db.get_recent_events(limit=limit)}


# ---------------------------------------------------------
# 5. Station Provisioning (QR-code phone GPS onboarding)
# ---------------------------------------------------------

@api_router.post("/bins/provision", status_code=status.HTTP_200_OK)
def provision_station(payload: ProvisionPayload) -> Dict[str, Any]:
    """
    Register or update station coordinates via QR-code phone GPS onboarding.
    """
    return db.provision_station(payload)


# ---------------------------------------------------------
# 6. Manual Janitor Reset / Empty Bin
# ---------------------------------------------------------

@api_router.post("/bins/empty", status_code=status.HTTP_200_OK)
def empty_bin(payload: EmptyPayload) -> Dict[str, Any]:
    """
    Reset compartment fill level to 0% (manual janitor reset).
    Target can be 'all' or specific compartment: 'plastic', 'paper', 'metal', 'general'.
    """
    try:
        return db.empty_bin(payload)
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# Register routes at both `/api/...` and root level `/...`
# This guarantees routing works on Vercel whether `/api` is prefixed or stripped.
app.include_router(api_router, prefix="/api")
app.include_router(api_router)
