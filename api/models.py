"""
SortSense Pydantic Data Models and Schemas
Strict type definitions and validations for all SortSense endpoints.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, field_validator, model_validator


class WasteCategory(str, Enum):
    """Strict standardized waste categories across hardware, AI backend, and web."""
    PLASTIC = "plastic"
    PAPER = "paper"
    METAL = "metal"
    GENERAL = "general"


CompartmentTarget = Literal["all", "plastic", "paper", "metal", "general"]
StatusColor = Literal["green", "yellow", "red"]
StationConnectivityStatus = Literal["ONLINE", "OFFLINE", "UNKNOWN"]
OperationalStatusValue = Literal["NORMAL", "SENSOR_ERROR"]
ReadingSource = Literal["HARDWARE", "SIMULATED"]


class FillLevels(BaseModel):
    """Compartment fill levels in percentages (0-100), or None when unconfigured/unavailable."""
    plastic: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Plastic compartment fill percentage")
    paper: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Paper compartment fill percentage")
    metal: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Metal compartment fill percentage")
    general: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="General waste compartment fill percentage")

    @field_validator("plastic", "paper", "metal", "general", mode="before")
    @classmethod
    def clamp_percentage(cls, value: Optional[float]) -> Optional[float]:
        if value is None:
            return None
        val = float(value)
        return max(0.0, min(100.0, round(val, 2)))


class TelemetryPayload(BaseModel):
    """Payload sent by ESP32-S3 ToF sensors to POST /api/telemetry/fill-levels."""
    station_id: str = Field(..., min_length=1, description="Unique station identifier, e.g. ST-001")
    fill_levels: FillLevels


class WasteDropEventPayload(BaseModel):
    """Payload sent by AI/LLM Backend to POST /api/events/log-waste."""
    station_id: str = Field(..., min_length=1, description="Unique station identifier, e.g. ST-001")
    waste_category: Union[WasteCategory, Literal["none"]] = Field(
        ..., description="Category predicted by AI model (plastic, paper, metal, general, or none)"
    )
    dropped_in_bin: WasteCategory = Field(..., description="Actual bin compartment the item dropped into")
    confidence: float = Field(..., ge=0.0, le=1.0, description="AI classification confidence (0.0 to 1.0)")
    is_correct_sort: bool = Field(..., description="Whether the item was dropped into the correct bin")
    idempotency_key: Optional[str] = Field(
        default=None, max_length=128, description="Optional client-supplied deduplication key"
    )
    measured_at: Optional[str] = Field(
        default=None, description="Optional ISO-8601 event timestamp"
    )

    @field_validator("waste_category", "dropped_in_bin", mode="before")
    @classmethod
    def normalize_category_input(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value


class ProvisionPayload(BaseModel):
    """Payload sent for QR-code phone GPS onboarding to POST /api/bins/provision."""
    station_id: str = Field(..., min_length=1, description="Station identifier, e.g. ST-001")
    name: str = Field(..., min_length=1, description="Human-readable station name, e.g. Delta Building 1F")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="GPS Latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="GPS Longitude coordinate")


class EmptyPayload(BaseModel):
    """Payload sent for janitor/admin bin emptying to POST /api/bins/empty."""
    station_id: str = Field(..., min_length=1, description="Target station identifier")
    compartment: CompartmentTarget = Field(
        default="all",
        description="Target compartment to empty: 'all', 'plastic', 'paper', 'metal', or 'general'"
    )
    notes: Optional[str] = Field(
        default=None, max_length=500, description="Optional maintenance notes"
    )


class LiveBinItem(BaseModel):
    """Individual bin telemetry item within a disposal area."""
    bin_id: str
    category_id: Optional[str] = None
    category_slug: Optional[str] = None
    category_name: str
    capacity_liters: float = 50.0
    fill_percentage: Optional[float] = None
    operational_status: Optional[str] = None
    reading_source: Optional[ReadingSource] = None
    updated_at: Optional[str] = None


class LiveDisposalArea(BaseModel):
    """Disposal area containing configured bins on a floor."""
    area_id: str
    area_name: str
    description: Optional[str] = None
    bins: List[LiveBinItem] = Field(default_factory=list)


class LiveFloor(BaseModel):
    """Floor belonging to a station."""
    floor_id: str
    floor_name: str
    floor_order: int = 0
    disposal_areas: List[LiveDisposalArea] = Field(default_factory=list)


class StationLiveStatus(BaseModel):
    """Live status schema for a single station (summary + hierarchical floors/areas/bins)."""
    station_id: str
    name: str
    location_name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_online: bool
    connectivity_status: StationConnectivityStatus = "UNKNOWN"
    is_stale: bool = False
    has_sensor_error: bool = False
    sensor_error_categories: List[str] = Field(default_factory=list)
    max_fill_pct: Optional[float] = None
    status_color: Optional[StatusColor] = None
    fill_levels: FillLevels
    updated_at: Optional[str] = None
    floors: List[LiveFloor] = Field(default_factory=list)


class LiveStatusResponse(BaseModel):
    """Response returned by GET /api/dashboard/live-status."""
    stations: List[StationLiveStatus]
    total_active_stations: int = 0
    total_waste_categories: int = 0
    total_monitored_compartments: int = 0
    total_drop_events: Optional[int] = None


class CategoryBreakdown(BaseModel):
    """Item count breakdown per waste category."""
    plastic: int = Field(default=0, ge=0)
    paper: int = Field(default=0, ge=0)
    metal: int = Field(default=0, ge=0)
    general: int = Field(default=0, ge=0)


class AnalyticsResponse(BaseModel):
    """Response returned by GET /api/dashboard/analytics."""
    total_items_today: int = Field(default=0, ge=0)
    sorting_accuracy_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    breakdown: CategoryBreakdown


class BinCreateItem(BaseModel):
    """Bin configuration item for ADMIN station creation."""
    category_id: str = Field(..., min_length=1, description="UUID from public.waste_categories")
    capacity_liters: float = Field(default=50.0, gt=0.0, le=10000.0)
    is_active: bool = True


class DisposalAreaCreateItem(BaseModel):
    """Disposal area configuration within a floor."""
    area_name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = True
    bins: List[BinCreateItem] = Field(..., min_length=1)


class FloorCreateItem(BaseModel):
    """Floor configuration within a station."""
    floor_name: str = Field(..., min_length=1, max_length=120)
    floor_order: int = 0
    is_active: bool = True
    disposal_areas: List[DisposalAreaCreateItem] = Field(..., min_length=1)


class StationCreatePayload(BaseModel):
    """Payload for ADMIN-only hierarchical station creation (floors -> disposal_areas -> bins)."""
    station_code: str = Field(..., min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    station_name: str = Field(..., min_length=1, max_length=120)
    location_name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=2048)
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    is_active: bool = True
    floors: Optional[List[FloorCreateItem]] = None
    bins: Optional[List[BinCreateItem]] = None

    @field_validator("image_url", mode="before")
    @classmethod
    def normalize_create_image_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_coordinates_and_hierarchy(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude must be provided together, or both omitted.")
        has_floors = bool(self.floors and len(self.floors) > 0)
        has_bins = bool(self.bins and len(self.bins) > 0)
        if not has_floors and not has_bins:
            raise ValueError("At least one floor with a disposal area and bin must be configured.")
        return self


class BinUpdateItem(BaseModel):
    """Existing or new bin configuration item for ADMIN station update."""
    bin_id: Optional[str] = None
    area_id: Optional[str] = None
    category_id: str = Field(..., min_length=1)
    capacity_liters: float = Field(default=50.0, gt=0.0, le=10000.0)
    is_active: bool = True


class DisposalAreaUpdateItem(BaseModel):
    """Existing or new disposal area within a floor."""
    area_id: Optional[str] = None
    area_name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = True
    bins: List[BinUpdateItem] = Field(default_factory=list)


class FloorUpdateItem(BaseModel):
    """Existing or new floor within a station."""
    floor_id: Optional[str] = None
    floor_name: str = Field(..., min_length=1, max_length=120)
    floor_order: int = 0
    is_active: bool = True
    disposal_areas: List[DisposalAreaUpdateItem] = Field(default_factory=list)


class StationUpdatePayload(BaseModel):
    """Payload for ADMIN-only station, floor, disposal area, and bin updates."""
    station_name: str = Field(..., min_length=1, max_length=120)
    location_name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, max_length=2048)
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    is_active: bool = True
    floors: Optional[List[FloorUpdateItem]] = None
    bins: Optional[List[BinUpdateItem]] = None
    delete_bin_ids: List[str] = Field(default_factory=list)

    @field_validator("image_url", mode="before")
    @classmethod
    def normalize_update_image_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_coordinates_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude must be provided together, or both omitted.")
        return self


class SimulateBinTelemetryItem(BaseModel):
    """Single simulated telemetry reading for an existing bin (ADMIN-only)."""
    bin_id: str = Field(..., min_length=1, description="UUID of an existing active bin")
    fill_percentage: Optional[float] = Field(
        default=None, ge=0.0, le=100.0, description="Simulated fill percentage (0-100); ignored or preserved on SENSOR_ERROR"
    )
    operational_status: OperationalStatusValue = Field(
        default="NORMAL", description="NORMAL or SENSOR_ERROR"
    )
    measured_at: Optional[str] = Field(
        default=None, description="Optional ISO-8601 timestamp; defaults to server timestamp if omitted"
    )

    @model_validator(mode="after")
    def validate_fill_for_normal(self):
        if self.operational_status == "NORMAL" and self.fill_percentage is None:
            raise ValueError("fill_percentage is required when operational_status is NORMAL.")
        if self.fill_percentage is not None:
            self.fill_percentage = max(0.0, min(100.0, round(float(self.fill_percentage), 2)))
        return self


class SimulateBinTelemetryPayload(BaseModel):
    """Batch payload for POST /api/admin/telemetry/simulate."""
    readings: List[SimulateBinTelemetryItem] = Field(..., min_length=1)


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
