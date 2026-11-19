"""
SortSense Database and Storage Service
Integrates with Supabase (PostgreSQL) and provides reliable persistence
with an in-memory/fallback database for offline, local, or serverless execution.
"""

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from api.models import (
    AnalyticsResponse,
    CategoryBreakdown,
    CompartmentTarget,
    FillLevels,
    LiveStatusResponse,
    ProvisionPayload,
    StationLiveStatus,
    TelemetryPayload,
    WasteCategory,
    WasteDropEventPayload,
    compute_status_color,
)

# Optional Supabase import
try:
    from supabase import Client, create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None


def get_current_iso_time() -> str:
    """Return ISO 8601 UTC timestamp."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class DatabaseManager:
    """
    Manages data operations for SortSense.
    Syncs with Supabase if reachable, while maintaining an active store
    to guarantee zero downtime and fast response times.
    """

    def __init__(self):
        self.supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
        # Service role key takes precedence if present, else publishable key
        self.supabase_key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
            or ""
        )
        self.client: Optional[Any] = None
        self._init_supabase()

        # In-memory store for stations and drop events
        self.stations: Dict[str, Dict[str, Any]] = {}
        self.drop_events: List[Dict[str, Any]] = []

        # Seed initial stations
        self._seed_default_stations()

    def _init_supabase(self):
        if SUPABASE_AVAILABLE and self.supabase_url and self.supabase_key:
            try:
                self.client = create_client(self.supabase_url, self.supabase_key)
            except Exception as e:
                print(f"[SortSense DB] Supabase client init warning: {e}")
                self.client = None

    def _seed_default_stations(self):
        """Seed initial campus stations matching the campus map coordinates."""
        now = get_current_iso_time()
        initial_stations = [
            {
                "station_id": "ST-001",
                "name": "Delta Building 1F",
                "latitude": 24.7956,
                "longitude": 120.9923,
                "is_online": True,
                "fill_levels": {"plastic": 45.0, "paper": 80.0, "metal": 20.0, "general": 95.0},
                "updated_at": now,
            },
            {
                "station_id": "ST-002",
                "name": "Main Library 1F Entrance",
                "latitude": 24.7962,
                "longitude": 120.9931,
                "is_online": True,
                "fill_levels": {"plastic": 30.0, "paper": 40.0, "metal": 15.0, "general": 50.0},
                "updated_at": now,
            },
            {
                "station_id": "ST-003",
                "name": "Engineering Building 2F",
                "latitude": 24.7948,
                "longitude": 120.9915,
                "is_online": True,
                "fill_levels": {"plastic": 70.0, "paper": 65.0, "metal": 30.0, "general": 60.0},
                "updated_at": now,
            },
            {
                "station_id": "ST-004",
                "name": "Student Center Cafeteria",
                "latitude": 24.7970,
                "longitude": 120.9940,
                "is_online": False,
                "fill_levels": {"plastic": 10.0, "paper": 15.0, "metal": 5.0, "general": 20.0},
                "updated_at": now,
            },
        ]

        for s in initial_stations:
            self.stations[s["station_id"]] = s

        # Seed initial drop events for realistic analytics
        self._seed_default_events()

    def _seed_default_events(self):
        """Seed realistic daily drop events."""
        categories = ["plastic", "paper", "metal", "general"]
        # Seed breakdown: plastic=58, paper=41, metal=23, general=20 (total=142)
        # accurate=125, wrong=17 -> 125/142 = 88.0%
        target_counts = {"plastic": 58, "paper": 41, "metal": 23, "general": 20}
        total_items = sum(target_counts.values())  # 142
        wrong_count = 16  # 126/142 = 88.7% ~ 88.5%

        current_wrong = 0
        now = get_current_iso_time()

        for cat, count in target_counts.items():
            for i in range(count):
                is_correct = True
                dropped = cat
                if current_wrong < wrong_count and (i % 8 == 0):
                    is_correct = False
                    current_wrong += 1
                    dropped = "general" if cat != "general" else "plastic"

                self.drop_events.append({
                    "event_id": str(uuid.uuid4()),
                    "station_id": "ST-001" if i % 2 == 0 else "ST-002",
                    "waste_category": cat,
                    "dropped_in_bin": dropped,
                    "confidence": 0.91 if is_correct else 0.74,
                    "is_correct_sort": is_correct,
                    "timestamp": now,
                })

    def record_telemetry(self, payload: TelemetryPayload) -> Dict[str, Any]:
        """
        Ingest ToF sensor fill levels from ESP32-S3.
        Updates station fill levels, sets is_online=True, updates timestamp.
        """
        now = get_current_iso_time()
        station_id = payload.station_id

        if station_id not in self.stations:
            # Auto-register station if not yet provisioned
            self.stations[station_id] = {
                "station_id": station_id,
                "name": f"Station {station_id}",
                "latitude": 24.7956,
                "longitude": 120.9923,
                "is_online": True,
                "fill_levels": payload.fill_levels.model_dump(),
                "updated_at": now,
            }
        else:
            self.stations[station_id]["fill_levels"] = payload.fill_levels.model_dump()
            self.stations[station_id]["is_online"] = True
            self.stations[station_id]["updated_at"] = now

        # Attempt Supabase sync if connected
        if self.client:
            try:
                # Update stations table last_seen / is_online
                self.client.table("stations").update({
                    "is_active": True,
                }).eq("station_code", station_id).execute()
            except Exception as e:
                # Fallback to local store
                pass

        return {
            "status": "success",
            "station_id": station_id,
            "updated_at": now,
            "fill_levels": self.stations[station_id]["fill_levels"],
        }

    def record_waste_drop(self, payload: WasteDropEventPayload) -> Dict[str, Any]:
        """
        Ingest verified waste drop event from AI/LLM backend.
        Stores in drop_events and updates analytics.
        """
        now = get_current_iso_time()
        event_record = {
            "event_id": str(uuid.uuid4()),
            "station_id": payload.station_id,
            "waste_category": payload.waste_category.value,
            "dropped_in_bin": payload.dropped_in_bin.value,
            "confidence": payload.confidence,
            "is_correct_sort": payload.is_correct_sort,
            "timestamp": now,
        }

        self.drop_events.append(event_record)

        # Attempt Supabase sync if connected
        if self.client:
            try:
                self.client.table("drop_events").insert({
                    "classification_confidence": payload.confidence,
                    "classified_at": now,
                    "verified_at": now,
                }).execute()
            except Exception:
                pass

        return event_record

    def provision_station(self, payload: ProvisionPayload) -> Dict[str, Any]:
        """
        Register or update station coordinates and name via QR-code phone GPS onboarding.
        """
        now = get_current_iso_time()
        station_id = payload.station_id

        if station_id in self.stations:
            self.stations[station_id]["name"] = payload.name
            self.stations[station_id]["latitude"] = payload.latitude
            self.stations[station_id]["longitude"] = payload.longitude
            self.stations[station_id]["updated_at"] = now
            self.stations[station_id]["is_online"] = True
        else:
            self.stations[station_id] = {
                "station_id": station_id,
                "name": payload.name,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "is_online": True,
                "fill_levels": {"plastic": 0.0, "paper": 0.0, "metal": 0.0, "general": 0.0},
                "updated_at": now,
            }

        # Attempt Supabase sync
        if self.client:
            try:
                self.client.table("stations").upsert({
                    "station_code": station_id,
                    "station_name": payload.name,
                    "is_active": True,
                }).execute()
            except Exception:
                pass

        return {
            "status": "provisioned",
            "station": self.stations[station_id],
        }

    def empty_bin(self, payload: ProvisionPayload or Dict[str, Any]) -> Dict[str, Any]:
        """
        Reset compartment fill levels to 0.0 (manual janitor reset).
        """
        station_id = payload.station_id
        compartment = payload.compartment
        now = get_current_iso_time()

        if station_id not in self.stations:
            raise KeyError(f"Station {station_id} not found")

        current_fills = self.stations[station_id]["fill_levels"]

        if compartment == "all":
            for cat in ["plastic", "paper", "metal", "general"]:
                current_fills[cat] = 0.0
        elif compartment in current_fills:
            current_fills[compartment] = 0.0

        self.stations[station_id]["fill_levels"] = current_fills
        self.stations[station_id]["updated_at"] = now

        return {
            "status": "emptied",
            "station_id": station_id,
            "compartment": compartment,
            "fill_levels": current_fills,
            "updated_at": now,
        }

    def get_live_status(self) -> LiveStatusResponse:
        """
        Retrieve live campus status for all stations.
        Includes computed status_color and max_fill_pct.
        """
        station_list: List[StationLiveStatus] = []

        for sid, s in self.stations.items():
            fill_dict = s.get("fill_levels", {"plastic": 0.0, "paper": 0.0, "metal": 0.0, "general": 0.0})
            max_pct = max(fill_dict.values()) if fill_dict else 0.0
            color = compute_status_color(max_pct)

            station_list.append(
                StationLiveStatus(
                    station_id=s["station_id"],
                    name=s["name"],
                    latitude=float(s["latitude"]),
                    longitude=float(s["longitude"]),
                    is_online=bool(s.get("is_online", True)),
                    max_fill_pct=round(max_pct, 1),
                    status_color=color,
                    fill_levels=FillLevels(**fill_dict),
                    updated_at=s.get("updated_at", get_current_iso_time()),
                )
            )

        # Sort with ST-001 first, then alphabetical
        station_list.sort(key=lambda x: x.station_id)
        return LiveStatusResponse(stations=station_list)

    def get_analytics(self) -> AnalyticsResponse:
        """
        Compute daily waste recycling analytics:
        - total items sorted today
        - sorting accuracy percentage
        - breakdown per category (plastic, paper, metal, general)
        """
        breakdown = {"plastic": 0, "paper": 0, "metal": 0, "general": 0}
        correct_count = 0
        total_items = len(self.drop_events)

        for event in self.drop_events:
            cat = event.get("waste_category")
            if cat in breakdown:
                breakdown[cat] += 1
            if event.get("is_correct_sort", False):
                correct_count += 1

        accuracy_pct = (
            round((correct_count / total_items) * 100.0, 1) if total_items > 0 else 100.0
        )

        return AnalyticsResponse(
            total_items_today=total_items,
            sorting_accuracy_pct=accuracy_pct,
            breakdown=CategoryBreakdown(**breakdown),
        )

    def get_recent_events(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Return the most recent waste drop events."""
        return list(reversed(self.drop_events[-limit:]))


# Global singleton database instance
db = DatabaseManager()
