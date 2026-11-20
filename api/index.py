"""
SortSense Cloud FastAPI Application
Hosts Cloud API endpoints for SortSense Hardware (ESP32-S3),
AI Inference Backend, and Campus Monitoring Web Dashboard.
"""

import hmac
import os
from fastapi import APIRouter, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict, List, Optional

from api.db import (
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    DatabaseUnavailableError,
    RecordNotFoundError,
    ValidationError,
    db,
)
from api.models import (
    AnalyticsResponse,
    EmptyPayload,
    LiveStatusResponse,
    ProvisionPayload,
    SimulateBinTelemetryPayload,
    StationCreatePayload,
    StationUpdatePayload,
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
def ingest_telemetry(
    payload: TelemetryPayload,
    x_device_key: Optional[str] = Header(default=None, alias="X-Device-Key"),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """
    Ingest ToF bin fill levels from ESP32-S3 / AI Backend.
    In live mode, validates X-Device-Key and persists HARDWARE telemetry via ingest_bin_fill_level RPC.
    """
    _require_device_auth(x_device_key, authorization)
    try:
        return db.record_telemetry(payload)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RecordNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except DatabaseUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


# ---------------------------------------------------------
# 2. Waste Drop Event Ingestion (Called by AI/LLM Backend)
# ---------------------------------------------------------

def _require_device_auth(
    x_device_key: Optional[str], authorization: Optional[str]
) -> None:
    """
    Validate device / AI Backend API key when DEVICE_API_KEY (or fallback
    SORTSENSE_DEVICE_API_KEY / TELEMETRY_INGEST_KEY) is configured.
    When unset or empty, unauthenticated hardware/AI ingestion is permitted.
    """
    configured_key = (
        os.getenv("DEVICE_API_KEY")
        or os.getenv("SORTSENSE_DEVICE_API_KEY")
        or os.getenv("TELEMETRY_INGEST_KEY")
        or ""
    ).strip()
    if not configured_key:
        return None
    supplied = (x_device_key or "").strip()
    if not supplied and authorization and authorization.lower().startswith("bearer "):
        supplied = authorization[7:].strip()
    if not supplied or not hmac.compare_digest(supplied, configured_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing device credentials.",
        )


@api_router.post("/events/log-waste", status_code=status.HTTP_201_CREATED)
def log_waste_event(
    payload: WasteDropEventPayload,
    x_device_key: Optional[str] = Header(default=None, alias="X-Device-Key"),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """
    Ingest verified waste drop logs from AI/LLM Backend.
    Resolves station_code and dropped_in_bin to active database records and persists to drop_events.
    """
    _require_device_auth(x_device_key, authorization)
    try:
        event = db.record_waste_drop(payload)
        if event.get("duplicate"):
            return {
                "status": "duplicate_ignored",
                "message": "Duplicate waste drop event ignored",
                "event": event,
            }
        return {
            "status": "created",
            "message": "Waste drop event recorded successfully",
            "event": event,
        }
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RecordNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except DatabaseUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


# ---------------------------------------------------------
# 3. Live Campus Station Status Feed
# ---------------------------------------------------------

@api_router.get("/dashboard/live-status", response_model=LiveStatusResponse)
def get_live_status():
    """
    Retrieve live status for all campus stations from Supabase.
    Calculates max_fill_pct and status_color (<60=green, 60-84=yellow, >=85=red).
    """
    try:
        return db.get_live_status()
    except DatabaseUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


# ---------------------------------------------------------
# 4. Daily Analytics Feed
# ---------------------------------------------------------

def _require_admin_client(authorization: Optional[str]) -> Any:
    """Validate Bearer JWT via Supabase and require an active ADMIN staff profile."""
    if db.use_fixtures:
        return None
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a valid Bearer token.",
        )
    token = authorization[7:].strip()
    try:
        return db.authenticate_staff_user(token, allowed_roles=("ADMIN",))
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except DatabaseUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@api_router.get("/dashboard/analytics", response_model=AnalyticsResponse)
def get_analytics(authorization: Optional[str] = Header(default=None)):
    """
    Retrieve daily waste recycling metrics from Supabase (ADMIN only):
    - total_items_today (Asia/Taipei calendar day)
    - sorting_accuracy_pct (null when no explicit correctness field exists)
    - breakdown (plastic, paper, metal, general)
    """
    user_client = _require_admin_client(authorization)
    try:
        return db.get_analytics(client=user_client)
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except DatabaseUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@api_router.get("/dashboard/recent-events")
def get_recent_events(limit: int = 15, authorization: Optional[str] = Header(default=None)):
    """
    Retrieve recent verified waste drop events from Supabase (ADMIN only).
    """
    user_client = _require_admin_client(authorization)
    try:
        return {"events": db.get_recent_events(limit=limit, client=user_client)}
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except DatabaseUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


# ---------------------------------------------------------
# 5. Station Provisioning & ADMIN Station Management
# ---------------------------------------------------------

@api_router.get("/waste-categories")
def get_waste_categories():
    """Retrieve active waste categories from Supabase."""
    try:
        return {"categories": db.get_waste_categories()}
    except DatabaseUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@api_router.get("/admin/stations")
def get_admin_stations(authorization: Optional[str] = Header(default=None)):
    """Retrieve all stations, locations, and bins for ADMIN Station Management."""
    user_client = _require_admin_client(authorization)
    try:
        return {"stations": db.get_admin_stations(client=user_client)}
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except DatabaseUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@api_router.post("/admin/stations", status_code=status.HTTP_201_CREATED)
def create_admin_station(
    payload: StationCreatePayload,
    authorization: Optional[str] = Header(default=None),
):
    """Create a new station, location, and associated bins (ADMIN only)."""
    user_client = _require_admin_client(authorization)
    try:
        station = db.create_admin_station(payload, client=user_client)
        return {"status": "created", "station": station}
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except DatabaseUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@api_router.patch("/admin/stations/{station_code}")
def update_admin_station(
    station_code: str,
    payload: StationUpdatePayload,
    authorization: Optional[str] = Header(default=None),
):
    """Update station, location, and bin configuration (ADMIN only)."""
    user_client = _require_admin_client(authorization)
    try:
        station = db.update_admin_station(station_code, payload, client=user_client)
        return {"status": "updated", "station": station}
    except RecordNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except DatabaseUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@api_router.post("/admin/telemetry/simulate", status_code=status.HTTP_200_OK)
def simulate_bin_telemetry(
    payload: SimulateBinTelemetryPayload,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """
    ADMIN-only individual-bin telemetry simulation for bins without active physical sensors.
    Never writes to sensor_readings and never overwrites HARDWARE telemetry.
    """
    user_client = _require_admin_client(authorization)
    try:
        return db.simulate_bin_telemetry(payload, client=user_client)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RecordNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except DatabaseUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@api_router.post("/bins/provision", status_code=status.HTTP_200_OK)
def provision_station(
    payload: ProvisionPayload,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """
    Register or update station coordinates via QR-code phone GPS onboarding (ADMIN only in prod).
    """
    user_client = _require_admin_client(authorization)
    try:
        return db.provision_station(payload, client=user_client)
    except AuthenticationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except DatabaseUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


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
