"""
SortSense Pydantic Data Models and Schemas
Strict type definitions and validations for all SortSense endpoints.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class WasteCategory(str, Enum):
    """Strict standardized waste categories across hardware, AI backend, and web."""
    PLASTIC = "plastic"
    PAPER = "paper"
    METAL = "metal"
    GENERAL = "general"


CompartmentTarget = Literal["all", "plastic", "paper", "metal", "general"]
StatusColor = Literal["green", "yellow", "red"]


class FillLevels(BaseModel):
    """Compartment fill levels in percentages (0-100)."""
    plastic: float = Field(default=0.0, ge=0.0, le=100.0, description="Plastic compartment fill percentage")
    paper: float = Field(default=0.0, ge=0.0, le=100.0, description="Paper compartment fill percentage")
    metal: float = Field(default=0.0, ge=0.0, le=100.0, description="Metal compartment fill percentage")
    general: float = Field(default=0.0, ge=0.0, le=100.0, description="General waste compartment fill percentage")

    @field_validator("plastic", "paper", "metal", "general", mode="before")
    @classmethod
    def clamp_percentage(cls, value: float) -> float:
        val = float(value)
        return max(0.0, min(100.0, round(val, 2)))


class TelemetryPayload(BaseModel):
    """Payload sent by ESP32-S3 ToF sensors to POST /api/telemetry/fill-levels."""
    station_id: str = Field(..., min_length=1, description="Unique station identifier, e.g. ST-001")
    fill_levels: FillLevels


class WasteDropEventPayload(BaseModel):
    """Payload sent by AI/LLM Backend to POST /api/events/log-waste."""
    station_id: str = Field(..., min_length=1, description="Unique station identifier, e.g. ST-001")
    waste_category: WasteCategory = Field(..., description="Category predicted by AI model")
    dropped_in_bin: WasteCategory = Field(..., description="Actual bin compartment the item dropped into")
    confidence: float = Field(..., ge=0.0, le=1.0, description="AI classification confidence (0.0 to 1.0)")
    is_correct_sort: bool = Field(..., description="Whether the item was dropped into the correct bin")


class ProvisionPayload(BaseModel):
    """Payload sent for QR-code phone GPS onboarding to POST /api/bins/provision."""
    station_id: str = Field(..., min_length=1, description="Station identifier, e.g. ST-001")
    name: str = Field(..., min_length=1, description="Human-readable station name, e.g. Delta Building 1F")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="GPS Latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="GPS Longitude coordinate")


class EmptyPayload(BaseModel):
    """Payload sent for janitor bin emptying to POST /api/bins/empty."""
    station_id: str = Field(..., min_length=1, description="Target station identifier")
    compartment: CompartmentTarget = Field(
        default="all",
        description="Target compartment to empty: 'all', 'plastic', 'paper', 'metal', or 'general'"
    )


class StationLiveStatus(BaseModel):
    """Live status schema for a single station."""
    station_id: str
    name: str
    latitude: float
    longitude: float
    is_online: bool
    max_fill_pct: float
    status_color: StatusColor
    fill_levels: FillLevels
    updated_at: str


class LiveStatusResponse(BaseModel):
    """Response returned by GET /api/dashboard/live-status."""
    stations: List[StationLiveStatus]


class CategoryBreakdown(BaseModel):
    """Item count breakdown per waste category."""
    plastic: int = Field(default=0, ge=0)
    paper: int = Field(default=0, ge=0)
    metal: int = Field(default=0, ge=0)
    general: int = Field(default=0, ge=0)


class AnalyticsResponse(BaseModel):
    """Response returned by GET /api/dashboard/analytics."""
    total_items_today: int = Field(default=0, ge=0)
    sorting_accuracy_pct: float = Field(default=100.0, ge=0.0, le=100.0)
    breakdown: CategoryBreakdown


def compute_status_color(max_pct: float) -> StatusColor:
    """
    Color calculation rule:
      < 60  -> 'green'
      60-84 -> 'yellow'
      >= 85 -> 'red'
    """
    if max_pct >= 85.0:
        return "red"
    if max_pct >= 60.0:
        return "yellow"
    return "green"
