"""
SortSense Database and Storage Service
Integrates with Supabase (PostgreSQL) and provides reliable persistence
with an in-memory/fallback database for offline, local, or serverless execution.
"""

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import uuid
from zoneinfo import ZoneInfo

from api.models import (
    AnalyticsResponse,
    CategoryBreakdown,
    CompartmentTarget,
    DisposalAreaCreateItem,
    FillLevels,
    FloorCreateItem,
    LiveBinItem,
    LiveDisposalArea,
    LiveFloor,
    LiveStatusResponse,
    ProvisionPayload,
    SimulateBinTelemetryPayload,
    StationCreatePayload,
    StationLiveStatus,
    StationUpdatePayload,
    TelemetryPayload,
    WasteCategory,
    WasteDropEventPayload,
    compute_status_color,
)

# Optional Supabase import
try:
    from supabase import Client, ClientOptions, create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None
    ClientOptions = None


class DatabaseUnavailableError(RuntimeError):
    """Raised when Supabase is disconnected, misconfigured, or fails a query."""


class AuthenticationError(RuntimeError):
    """Raised when a bearer token is missing, invalid, or expired (HTTP 401)."""


class AuthorizationError(RuntimeError):
    """Raised when an authenticated user is inactive or lacks staff permissions (HTTP 403)."""


class ConflictError(RuntimeError):
    """Raised when a duplicate record or foreign-key constraint prevents an operation (HTTP 409)."""


class RecordNotFoundError(RuntimeError):
    """Raised when a requested record does not exist (HTTP 404)."""


class ValidationError(ValueError):
    """Raised when input references invalid database entities (HTTP 400)."""


try:
    TAIPEI_TZ = ZoneInfo("Asia/Taipei")
except Exception:
    TAIPEI_TZ = timezone(timedelta(hours=8), name="Asia/Taipei")


def get_telemetry_freshness_seconds() -> int:
    """Return configurable telemetry freshness threshold in seconds (default 300s / 5m)."""
    raw = os.environ.get("SORTSENSE_TELEMETRY_FRESHNESS_SECONDS", "300")
    try:
        return max(1, int(raw))
    except ValueError:
        return 300


def _parse_iso_timestamp(ts: Optional[str]) -> Optional[datetime]:
    """Parse an ISO-8601 timestamp string into a UTC-aware datetime, or None."""
    if not ts or not isinstance(ts, str):
        return None
    try:
        cleaned = ts.strip()
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _is_timestamp_fresh(
    ts: Optional[str],
    now: Optional[datetime] = None,
    threshold_seconds: Optional[int] = None,
) -> bool:
    """Return True if ts is within threshold_seconds of now."""
    parsed = _parse_iso_timestamp(ts)
    if parsed is None:
        return False
    ref = now.astimezone(timezone.utc) if now else datetime.now(timezone.utc)
    limit = threshold_seconds if threshold_seconds is not None else get_telemetry_freshness_seconds()
    age_seconds = (ref - parsed).total_seconds()
    return age_seconds <= limit


def get_taipei_day_utc_bounds(now: Optional[datetime] = None) -> Tuple[str, str]:
    """Return [start_utc_iso, end_utc_iso) for the current Asia/Taipei calendar day."""
    ref = now.astimezone(TAIPEI_TZ) if now else datetime.now(TAIPEI_TZ)
    start_taipei = ref.replace(hour=0, minute=0, second=0, microsecond=0)
    end_taipei = start_taipei + timedelta(days=1)
    start_utc = start_taipei.astimezone(timezone.utc)
    end_utc = end_taipei.astimezone(timezone.utc)
    return (
        start_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        end_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


def _load_local_env() -> None:
    """Load .env.local into os.environ for local dev when variables are unset."""
    env_path = Path(".env.local")
    if not env_path.is_file():
        return
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except OSError:
        pass


def get_current_iso_time() -> str:
    """Return ISO 8601 UTC timestamp."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _normalize_category(name: Optional[str]) -> Optional[str]:
    """Map Supabase waste_categories.category_name to API WasteCategory slug."""
    if not name:
        return None
    normalized = name.strip().lower()
    if normalized.startswith("plastic"):
        return "plastic"
    if normalized.startswith("paper"):
        return "paper"
    if normalized.startswith("metal"):
        return "metal"
    if normalized.startswith("general"):
        return "general"
    return None


class DatabaseManager:
    """
    Manages data operations for SortSense.
    Production read endpoints query Supabase directly and fail explicitly on errors.
    In-memory seed fixtures are isolated behind explicit test configuration.
    """

    def __init__(self, use_fixtures: Optional[bool] = None):
        _load_local_env()
        self.supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
        # Service role key takes precedence if present (backend-only), else publishable key
        self.supabase_key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
            or ""
        )
        if use_fixtures is None:
            self.use_fixtures = os.environ.get("SORTSENSE_USE_TEST_FIXTURES") == "1"
        else:
            self.use_fixtures = use_fixtures

        self.client: Optional[Any] = None
        self._init_supabase()

        # In-memory store reserved for explicit test fixtures and legacy write compatibility
        self.stations: Dict[str, Dict[str, Any]] = {}
        self.drop_events: List[Dict[str, Any]] = []
        self._recent_drop_fingerprints: Dict[str, datetime] = {}

        if self.use_fixtures:
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
        In fixture mode, updates in-memory self.stations.
        In live mode (use_fixtures=False), resolves active station & bins and persists
        HARDWARE telemetry via `ingest_bin_fill_level` RPC (never fabricating 0% on NULL/SENSOR_ERROR).
        """
        now = get_current_iso_time()
        raw_station_code = payload.station_id.strip()

        if self.use_fixtures:
            if raw_station_code not in self.stations:
                self.stations[raw_station_code] = {
                    "station_id": raw_station_code,
                    "name": f"Station {raw_station_code}",
                    "latitude": 24.7956,
                    "longitude": 120.9923,
                    "is_online": True,
                    "fill_levels": payload.fill_levels.model_dump(),
                    "updated_at": now,
                }
            else:
                self.stations[raw_station_code]["fill_levels"] = payload.fill_levels.model_dump()
                self.stations[raw_station_code]["is_online"] = True
                self.stations[raw_station_code]["updated_at"] = now

            return {
                "status": "success",
                "station_id": raw_station_code,
                "updated_at": now,
                "fill_levels": self.stations[raw_station_code]["fill_levels"],
            }

        if not self.client:
            raise DatabaseUnavailableError(
                "Supabase client is not configured for hardware fill-level persistence."
            )

        station_map_raw = os.getenv("STATION_CODE_MAP", "").strip()
        if station_map_raw:
            try:
                station_map = json.loads(station_map_raw)
                if isinstance(station_map, dict) and raw_station_code in station_map:
                    raw_station_code = str(station_map[raw_station_code]).strip()
            except Exception:
                pass

        try:
            st_res = (
                self.client.table("stations")
                .select(
                    "station_id, station_code, is_active, "
                    "floors(floor_id, is_active, "
                    "disposal_areas(area_id, is_active, "
                    "bins(bin_id, category_id, is_active, waste_categories(category_name))))"
                )
                .eq("station_code", raw_station_code)
                .execute()
            )
            cats_res = (
                self.client.table("waste_categories")
                .select("category_id, category_name, is_active")
                .execute()
            )
        except Exception as exc:
            raise DatabaseUnavailableError(
                f"Failed to resolve station for fill-level telemetry: {exc}"
            ) from exc

        st_rows = st_res.data or []
        if not st_rows:
            raise RecordNotFoundError(f"Station '{raw_station_code}' not found.")
        station_row = st_rows[0]
        if not station_row.get("is_active", True):
            raise ValidationError(f"Station '{raw_station_code}' is inactive.")

        cat_by_id: Dict[str, str] = {}
        for c in cats_res.data or []:
            if not c.get("is_active", True):
                continue
            slug = _normalize_category(c.get("category_name"))
            if slug and c.get("category_id"):
                cat_by_id[str(c["category_id"])] = slug

        bins_by_slug: Dict[str, List[str]] = {}
        for fl in station_row.get("floors") or []:
            if not fl.get("is_active", True):
                continue
            for ar in fl.get("disposal_areas") or []:
                if not ar.get("is_active", True):
                    continue
                for b in ar.get("bins") or []:
                    if not b.get("is_active", True):
                        continue
                    slug = cat_by_id.get(str(b.get("category_id") or ""))
                    if slug and b.get("bin_id"):
                        bins_by_slug.setdefault(slug, []).append(str(b["bin_id"]))

        levels = payload.fill_levels.model_dump()
        updated_bins: List[Dict[str, Any]] = []
        for slug, bin_ids in bins_by_slug.items():
            fill_val = levels.get(slug)
            # If a configured active bin receives None, record SENSOR_ERROR (preserving prior fill/NULL) rather than 0%
            op_status = "NORMAL" if fill_val is not None else "SENSOR_ERROR"
            for bin_id in bin_ids:
                try:
                    rpc_res = self.client.rpc(
                        "ingest_bin_fill_level",
                        {
                            "p_bin_id": bin_id,
                            "p_fill_percentage": fill_val,
                            "p_operational_status": op_status,
                            "p_distance_mm": None,
                            "p_measured_at": now,
                        },
                    ).execute()
                    row = (
                        rpc_res.data[0]
                        if isinstance(rpc_res.data, list) and rpc_res.data
                        else (rpc_res.data or {})
                    )
                    updated_bins.append({
                        "bin_id": bin_id,
                        "category": slug,
                        "fill_percentage": None if op_status == "SENSOR_ERROR" else row.get("fill_percentage", fill_val),
                        "operational_status": row.get("operational_status") or op_status,
                        "reading_source": row.get("reading_source") or "HARDWARE",
                    })
                except Exception as exc:
                    msg = str(exc)
                    low = msg.lower()
                    if "42501" in msg or "permission denied" in low:
                        raise AuthorizationError(f"Permission denied recording telemetry: {exc}") from exc
                    if "p0002" in low or "not found" in low:
                        raise RecordNotFoundError(f"Active bin not found: {exc}") from exc
                    raise DatabaseUnavailableError(
                        f"Failed to persist fill-level telemetry for bin '{bin_id}': {exc}"
                    ) from exc

        return {
            "status": "success",
            "station_id": raw_station_code,
            "updated_at": now,
            "reading_source": "HARDWARE",
            "fill_levels": levels,
            "updated_bins": updated_bins,
        }

    def _check_and_record_drop_dedup(self, payload: WasteDropEventPayload) -> bool:
        """Return True if this event is a duplicate within the dedup window."""
        now_dt = datetime.now(timezone.utc)
        cutoff = now_dt - timedelta(seconds=10)
        self._recent_drop_fingerprints = {
            k: ts for k, ts in self._recent_drop_fingerprints.items() if ts >= cutoff
        }
        waste_val = payload.waste_category.value if isinstance(payload.waste_category, WasteCategory) else str(payload.waste_category)
        if payload.idempotency_key:
            fp = f"key:{payload.idempotency_key.strip()}"
        else:
            fp = f"{payload.station_id.strip().upper()}|{waste_val}|{payload.dropped_in_bin.value}|{round(payload.confidence, 4)}|{payload.is_correct_sort}"
        if fp in self._recent_drop_fingerprints:
            return True
        self._recent_drop_fingerprints[fp] = now_dt
        return False

    def record_waste_drop(self, payload: WasteDropEventPayload) -> Dict[str, Any]:
        """
        Ingest verified waste drop event from AI/LLM backend.
        In live mode (use_fixtures=False), resolves station_code and dropped_in_bin
        to active Supabase station/floor/area/bin UUIDs and persists to drop_events.
        """
        now = payload.measured_at or get_current_iso_time()
        waste_val = (
            payload.waste_category.value
            if isinstance(payload.waste_category, WasteCategory)
            else str(payload.waste_category).strip().lower()
        )
        dropped_val = payload.dropped_in_bin.value

        if self._check_and_record_drop_dedup(payload):
            return {
                "event_id": None,
                "station_id": payload.station_id,
                "waste_category": waste_val,
                "dropped_in_bin": dropped_val,
                "confidence": payload.confidence,
                "is_correct_sort": payload.is_correct_sort,
                "timestamp": now,
                "duplicate": True,
            }

        if self.use_fixtures:
            event_record = {
                "event_id": str(uuid.uuid4()),
                "station_id": payload.station_id,
                "waste_category": waste_val,
                "dropped_in_bin": dropped_val,
                "confidence": payload.confidence,
                "is_correct_sort": payload.is_correct_sort,
                "timestamp": now,
            }
            self.drop_events.append(event_record)
            return event_record

        if not self.client:
            raise DatabaseUnavailableError(
                "Supabase client is not configured for waste drop persistence."
            )

        # Optional explicit station mapping (e.g. {"ST-001": "NTHU-SHUIMU"})
        raw_station_code = payload.station_id.strip()
        station_map_raw = os.getenv("STATION_CODE_MAP", "").strip()
        if station_map_raw:
            try:
                station_map = json.loads(station_map_raw)
                if isinstance(station_map, dict) and raw_station_code in station_map:
                    raw_station_code = str(station_map[raw_station_code]).strip()
            except Exception:
                pass

        try:
            st_res = (
                self.client.table("stations")
                .select(
                    "station_id, station_code, is_active, "
                    "floors(floor_id, is_active, "
                    "disposal_areas(area_id, is_active, "
                    "bins(bin_id, category_id, is_active, waste_categories(category_name))))"
                )
                .eq("station_code", raw_station_code)
                .execute()
            )
            cats_res = (
                self.client.table("waste_categories")
                .select("category_id, category_name, is_active")
                .execute()
            )
        except Exception as exc:
            raise DatabaseUnavailableError(
                f"Failed to resolve station/categories for waste drop: {exc}"
            ) from exc

        st_rows = st_res.data or []
        if not st_rows:
            raise RecordNotFoundError(
                f"Station '{raw_station_code}' not found."
            )
        station_row = st_rows[0]
        if not station_row.get("is_active", True):
            raise ValidationError(
                f"Station '{raw_station_code}' is inactive."
            )

        # Resolve waste_categories slugs -> category_id
        cat_by_slug: Dict[str, str] = {}
        for c in cats_res.data or []:
            if not c.get("is_active", True):
                continue
            slug = _normalize_category(c.get("category_name"))
            if slug and c.get("category_id"):
                cat_by_slug[slug] = str(c["category_id"])

        dropped_category_id = cat_by_slug.get(dropped_val)
        if not dropped_category_id:
            raise ValidationError(
                f"No active waste category matches dropped_in_bin '{dropped_val}'."
            )

        classified_category_id: Optional[str] = None
        if waste_val != "none":
            classified_category_id = cat_by_slug.get(waste_val)
            if not classified_category_id:
                raise ValidationError(
                    f"No active waste category matches waste_category '{waste_val}'."
                )

        # Resolve active bin within active floor -> active disposal area
        matching_bins: List[str] = []
        for fl in station_row.get("floors") or []:
            if not fl.get("is_active", True):
                continue
            for ar in fl.get("disposal_areas") or []:
                if not ar.get("is_active", True):
                    continue
                for b in ar.get("bins") or []:
                    if not b.get("is_active", True):
                        continue
                    if str(b.get("category_id") or "") == dropped_category_id and b.get("bin_id"):
                        matching_bins.append(str(b["bin_id"]))

        # Optional explicit bin mapping override (e.g. {"ST-001:plastic": "<bin_uuid>"})
        bin_map_raw = os.getenv("BIN_MAPPING_JSON", "").strip()
        mapped_bin_id: Optional[str] = None
        if bin_map_raw:
            try:
                bin_map = json.loads(bin_map_raw)
                if isinstance(bin_map, dict):
                    mapped_bin_id = bin_map.get(f"{payload.station_id.strip()}:{dropped_val}") or bin_map.get(f"{raw_station_code}:{dropped_val}")
            except Exception:
                pass

        if mapped_bin_id and mapped_bin_id in matching_bins:
            actual_bin_id = mapped_bin_id
        elif len(matching_bins) == 1:
            actual_bin_id = matching_bins[0]
        elif len(matching_bins) == 0:
            raise RecordNotFoundError(
                f"No active '{dropped_val}' bin configured for station '{raw_station_code}'."
            )
        else:
            raise ConflictError(
                f"Multiple active '{dropped_val}' bins found for station '{raw_station_code}'; explicit BIN_MAPPING_JSON mapping required."
            )

        insert_payload: Dict[str, Any] = {
            "actual_bin_id": actual_bin_id,
            "classified_category_id": classified_category_id,
            "classification_confidence": payload.confidence,
            "classified_at": now,
            "verified_at": now,
        }

        try:
            if hasattr(self.client, "rpc"):
                try:
                    ins_res = self.client.rpc(
                        "ingest_waste_drop_event",
                        {
                            "p_actual_bin_id": actual_bin_id,
                            "p_classified_category_id": classified_category_id,
                            "p_confidence": payload.confidence,
                            "p_classified_at": now,
                            "p_verified_at": now,
                        },
                    ).execute()
                except Exception as rpc_exc:
                    rpc_msg = str(rpc_exc).lower()
                    # Fall back to direct table insert only if the RPC function is not deployed/mocked
                    if "unknown rpc" in rpc_msg or "pgrst202" in rpc_msg or "could not find the function" in rpc_msg:
                        ins_res = self.client.table("drop_events").insert(insert_payload).execute()
                    else:
                        raise
            else:
                ins_res = self.client.table("drop_events").insert(insert_payload).execute()
        except Exception as exc:
            msg = str(exc)
            low = msg.lower()
            if "p0002" in low or "not found" in low:
                raise RecordNotFoundError(f"Active bin not found for drop event: {exc}") from exc
            if "22023" in msg:
                raise ValidationError(f"Invalid drop event parameter: {exc}") from exc
            if "42501" in msg or "permission denied" in low:
                raise AuthorizationError(
                    f"Permission denied inserting into drop_events (RLS policy): {exc}"
                ) from exc
            raise DatabaseUnavailableError(
                f"Failed to persist waste drop event to Supabase: {exc}"
            ) from exc

        inserted_row = (
            ins_res.data[0]
            if isinstance(ins_res.data, list) and ins_res.data
            else (ins_res.data if isinstance(ins_res.data, dict) else {})
        )
        return {
            "event_id": str(inserted_row.get("event_id") or uuid.uuid4()),
            "station_id": raw_station_code,
            "actual_bin_id": actual_bin_id,
            "classified_category_id": classified_category_id,
            "waste_category": waste_val,
            "dropped_in_bin": dropped_val,
            "confidence": payload.confidence,
            "is_correct_sort": payload.is_correct_sort,
            "timestamp": inserted_row.get("classified_at") or now,
        }

    def provision_station(
        self, payload: ProvisionPayload, client: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Register or update station coordinates and name via QR-code phone GPS onboarding.
        Persists to Supabase locations & stations when use_fixtures=False.
        """
        now = get_current_iso_time()
        station_id = payload.station_id

        if self.use_fixtures:
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
            return {
                "status": "provisioned",
                "station": self.stations[station_id],
            }

        active_client = client
        if active_client is None:
            raise AuthenticationError("Authentication required to provision station coordinates.")

        try:
            existing_res = (
                active_client.table("stations")
                .select("station_id, location_id, station_code, station_name")
                .eq("station_code", station_id)
                .execute()
            )
            existing_rows = existing_res.data or []
            if existing_rows:
                st_row = existing_rows[0]
                active_client.table("stations").update(
                    {"station_name": payload.name}
                ).eq("station_id", st_row["station_id"]).execute()
                if st_row.get("location_id"):
                    active_client.table("locations").update(
                        {
                            "latitude": payload.latitude,
                            "longitude": payload.longitude,
                        }
                    ).eq("location_id", st_row["location_id"]).execute()
            else:
                loc_res = (
                    active_client.table("locations")
                    .insert(
                        {
                            "location_name": payload.name,
                            "latitude": payload.latitude,
                            "longitude": payload.longitude,
                            "is_active": True,
                        }
                    )
                    .execute()
                )
                loc_id = loc_res.data[0]["location_id"]
                active_client.table("stations").insert(
                    {
                        "location_id": loc_id,
                        "station_code": station_id,
                        "station_name": payload.name,
                        "is_active": True,
                    }
                ).execute()
        except Exception as exc:
            msg = str(exc)
            if "42501" in msg or "permission denied" in msg.lower():
                raise AuthorizationError(f"Permission denied provisioning station: {exc}") from exc
            raise DatabaseUnavailableError(f"Failed to provision station in Supabase: {exc}") from exc

        return {
            "status": "provisioned",
            "station": {
                "station_id": station_id,
                "name": payload.name,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
            },
        }

    def empty_bin(
        self, payload: Any, client: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Reset compartment fill levels to 0.0 (ADMIN or JANITOR staff reset).
        In fixture mode, updates in-memory self.stations.
        In live mode (use_fixtures=False), calls `staff_empty_bins` RPC with the
        authenticated staff client to atomically log `bin_emptying_events` and reset `bin_status`.
        """
        station_id = payload.station_id
        compartment = payload.compartment
        notes = getattr(payload, "notes", None)
        now = get_current_iso_time()

        if self.use_fixtures:
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

        if client is None:
            raise AuthenticationError("Authentication required to empty bins.")

        try:
            rpc_res = client.rpc(
                "staff_empty_bins",
                {
                    "p_station_code": station_id,
                    "p_compartment": compartment,
                    "p_notes": notes,
                },
            ).execute()
        except Exception as exc:
            msg = str(exc)
            low = msg.lower()
            if "42501" in msg or "permission denied" in low or "role required" in low:
                raise AuthorizationError(f"Staff privileges required to empty bins: {exc}") from exc
            if "p0002" in low or "not found" in low:
                raise RecordNotFoundError(f"Station or matching active bin not found: {exc}") from exc
            if "22023" in msg or "23514" in msg:
                raise ValidationError(f"Invalid emptying request: {exc}") from exc
            raise DatabaseUnavailableError(f"Failed to empty bins: {exc}") from exc

        row = rpc_res.data[0] if isinstance(rpc_res.data, list) and rpc_res.data else (rpc_res.data or {})
        return {
            "status": "emptied",
            "station_id": str(row.get("station_code") or station_id),
            "compartment": str(row.get("compartment") or compartment),
            "emptied_count": int(row.get("emptied_count") or 0),
            "updated_at": row.get("emptied_at") or now,
        }

    def get_live_status(self) -> LiveStatusResponse:
        """
        Retrieve live campus status for all active stations.
        Reads from Supabase in production; uses in-memory store only when use_fixtures=True.
        """
        if self.use_fixtures:
            return self._get_fixture_live_status()

        if not self.client:
            raise DatabaseUnavailableError(
                "Supabase client is not configured. Check NEXT_PUBLIC_SUPABASE_URL and key settings."
            )

        def _build_live_select(include_image_url: bool, include_reading_source: bool) -> str:
            station_cols = (
                "station_id, station_code, station_name, image_url, is_active, location_id, "
                if include_image_url
                else "station_id, station_code, station_name, is_active, location_id, "
            )
            bin_status_cols = (
                "bin_status(fill_percentage, operational_status, reading_source, updated_at, measured_at)"
                if include_reading_source
                else "bin_status(fill_percentage, operational_status, updated_at, measured_at)"
            )
            return (
                station_cols
                + "locations(location_name, description, latitude, longitude, is_active), "
                + "floors(floor_id, floor_name, floor_order, is_active, "
                + "disposal_areas(area_id, area_name, description, is_active, "
                + "bins(bin_id, category_id, capacity_liters, is_active, "
                + "waste_categories(category_name), "
                + bin_status_cols
                + ")))"
            )

        try:
            res = None
            last_inner_exc: Optional[Exception] = None
            for inc_img, inc_src in (
                (True, True),
                (False, True),
                (True, False),
                (False, False),
            ):
                try:
                    res = (
                        self.client.table("stations")
                        .select(_build_live_select(inc_img, inc_src))
                        .execute()
                    )
                    last_inner_exc = None
                    break
                except Exception as inner_exc:
                    err_str = str(inner_exc)
                    if "image_url" in err_str or "reading_source" in err_str:
                        last_inner_exc = inner_exc
                        continue
                    raise
            if last_inner_exc is not None:
                raise last_inner_exc
        except Exception as exc:
            raise DatabaseUnavailableError(
                f"Failed to query live station status from Supabase: {exc}"
            ) from exc

        rows = (res.data if res is not None else None) or []
        station_list: List[StationLiveStatus] = []
        distinct_category_keys: set[str] = set()
        total_monitored_compartments = 0

        for row in rows:
            if not row.get("is_active", True):
                continue

            location = row.get("locations")
            if isinstance(location, list):
                location = location[0] if location else None
            if location and location.get("is_active") is False:
                continue

            station_code = row.get("station_code") or str(row.get("station_id"))
            station_name = row.get("station_name") or station_code
            loc_name = location.get("location_name") if isinstance(location, dict) else None
            loc_desc = location.get("description") if isinstance(location, dict) else None
            lat = (
                float(location["latitude"])
                if location and location.get("latitude") is not None
                else None
            )
            lng = (
                float(location["longitude"])
                if location and location.get("longitude") is not None
                else None
            )

            fill_dict: Dict[str, Optional[float]] = {
                "plastic": None,
                "paper": None,
                "metal": None,
                "general": None,
            }
            has_any_reading = False
            has_valid_reading = False
            has_sensor_error = False
            sensor_error_categories: List[str] = []
            latest_ts: Optional[str] = None
            latest_dt: Optional[datetime] = None

            def _process_bin(b: Dict[str, Any]) -> Optional[LiveBinItem]:
                nonlocal has_any_reading, has_valid_reading, has_sensor_error, latest_ts, latest_dt, total_monitored_compartments
                if not b.get("is_active", True):
                    return None

                total_monitored_compartments += 1
                cat_obj = b.get("waste_categories")
                if isinstance(cat_obj, list):
                    cat_obj = cat_obj[0] if cat_obj else None
                cat_name = (
                    str(cat_obj.get("category_name"))
                    if isinstance(cat_obj, dict) and cat_obj.get("category_name")
                    else "Unknown"
                )
                cat_slug = _normalize_category(cat_name)
                cat_key = str(b.get("category_id") or cat_slug or cat_name).strip().lower()
                if cat_key and cat_key != "unknown":
                    distinct_category_keys.add(cat_key)

                bs = b.get("bin_status")
                if isinstance(bs, list):
                    bs = bs[0] if bs else None

                ts = None
                op_status = None
                fill_val = None
                reading_source = None
                if isinstance(bs, dict):
                    ts = bs.get("measured_at") or bs.get("updated_at")
                    raw_src = bs.get("reading_source")
                    if isinstance(raw_src, str):
                        norm_src = raw_src.strip().upper()
                        if norm_src in ("HARDWARE", "SIMULATED", "LEGACY"):
                            reading_source = norm_src
                    parsed_ts = _parse_iso_timestamp(ts)
                    if parsed_ts is not None and (latest_dt is None or parsed_ts > latest_dt):
                        latest_dt = parsed_ts
                        latest_ts = ts
                    elif parsed_ts is None and isinstance(ts, str) and latest_ts is None:
                        latest_ts = ts

                    op_status = str(bs.get("operational_status") or "NORMAL").upper()
                    fill_val = bs.get("fill_percentage")

                    if op_status == "SENSOR_ERROR":
                        has_any_reading = True
                        has_sensor_error = True
                        if cat_slug and cat_slug not in sensor_error_categories:
                            sensor_error_categories.append(cat_slug)
                        fill_val = None
                    elif op_status == "OFFLINE":
                        has_any_reading = True
                        fill_val = None
                    elif fill_val is not None:
                        has_any_reading = True
                        has_valid_reading = True
                        numeric_fill = float(fill_val)
                        if cat_slug in fill_dict:
                            prev = fill_dict[cat_slug]
                            fill_dict[cat_slug] = (
                                numeric_fill if prev is None else max(prev, numeric_fill)
                            )

                return LiveBinItem(
                    bin_id=str(b.get("bin_id") or ""),
                    category_id=str(b.get("category_id")) if b.get("category_id") else None,
                    category_slug=cat_slug,
                    category_name=cat_name,
                    capacity_liters=float(b["capacity_liters"]) if b.get("capacity_liters") is not None else 50.0,
                    fill_percentage=float(fill_val) if fill_val is not None else None,
                    operational_status=op_status,
                    reading_source=reading_source,
                    is_active=bool(b.get("is_active", True)),
                    updated_at=ts,
                )

            floors_out: List[LiveFloor] = []
            raw_floors = row.get("floors") or []
            if raw_floors:
                sorted_floors = sorted(
                    raw_floors,
                    key=lambda fl: (int(fl.get("floor_order") or 0), str(fl.get("floor_name") or "")),
                )
                for fl in sorted_floors:
                    if not fl.get("is_active", True):
                        continue
                    areas_out: List[LiveDisposalArea] = []
                    for area in fl.get("disposal_areas") or []:
                        if not area.get("is_active", True):
                            continue
                        bins_out: List[LiveBinItem] = []
                        for b in area.get("bins") or []:
                            item = _process_bin(b)
                            if item is not None:
                                bins_out.append(item)
                        areas_out.append(
                            LiveDisposalArea(
                                area_id=str(area.get("area_id") or ""),
                                area_name=str(area.get("area_name") or ""),
                                description=area.get("description"),
                                bins=bins_out,
                            )
                        )
                    floors_out.append(
                        LiveFloor(
                            floor_id=str(fl.get("floor_id") or ""),
                            floor_name=str(fl.get("floor_name") or ""),
                            floor_order=int(fl.get("floor_order") or 0),
                            disposal_areas=areas_out,
                        )
                    )
            else:
                # Fallback for flat mocked tests passing bins directly on station
                for b in row.get("bins") or []:
                    _process_bin(b)

            if latest_ts is None or not has_any_reading:
                is_stale = False
                is_online = False
                connectivity_status = "UNKNOWN"
            elif _is_timestamp_fresh(latest_ts):
                is_stale = False
                is_online = has_valid_reading
                connectivity_status = "ONLINE" if is_online else "OFFLINE"
            else:
                is_stale = True
                is_online = False
                connectivity_status = "OFFLINE"

            numeric_fills = [v for v in fill_dict.values() if v is not None]
            max_pct = round(max(numeric_fills), 1) if numeric_fills else None
            color = compute_status_color(max_pct) if max_pct is not None else None

            raw_image_url = row.get("image_url")
            image_url = (
                str(raw_image_url).strip()
                if isinstance(raw_image_url, str) and raw_image_url.strip()
                else None
            )

            station_list.append(
                StationLiveStatus(
                    station_id=station_code,
                    name=station_name,
                    location_name=loc_name,
                    description=loc_desc,
                    image_url=image_url,
                    latitude=lat,
                    longitude=lng,
                    is_online=is_online,
                    connectivity_status=connectivity_status,
                    is_stale=is_stale,
                    has_sensor_error=has_sensor_error,
                    sensor_error_categories=sensor_error_categories,
                    max_fill_pct=max_pct,
                    status_color=color,
                    fill_levels=FillLevels(**fill_dict),
                    updated_at=latest_ts,
                    floors=floors_out,
                )
            )

        station_list.sort(key=lambda x: x.station_id)

        # Best-effort real drop_events count when accessible (never blocks live-status under RLS)
        total_drop_events: Optional[int] = None
        try:
            cnt_res = (
                self.client.table("drop_events")
                .select("event_id", count="exact")
                .limit(1)
                .execute()
            )
            raw_count = getattr(cnt_res, "count", None)
            if isinstance(raw_count, int):
                total_drop_events = raw_count
        except Exception:
            total_drop_events = None

        return LiveStatusResponse(
            stations=station_list,
            total_active_stations=len(station_list),
            total_waste_categories=len(distinct_category_keys),
            total_monitored_compartments=total_monitored_compartments,
            total_drop_events=total_drop_events,
        )

    def _get_fixture_live_status(self) -> LiveStatusResponse:
        station_list: List[StationLiveStatus] = []

        for _, s in self.stations.items():
            fill_dict = s.get(
                "fill_levels",
                {"plastic": 0.0, "paper": 0.0, "metal": 0.0, "general": 0.0},
            )
            max_pct = max(fill_dict.values()) if fill_dict else 0.0
            color = compute_status_color(max_pct)
            is_on = bool(s.get("is_online", True))

            station_list.append(
                StationLiveStatus(
                    station_id=s["station_id"],
                    name=s["name"],
                    image_url=s.get("image_url"),
                    latitude=float(s["latitude"]),
                    longitude=float(s["longitude"]),
                    is_online=is_on,
                    connectivity_status="ONLINE" if is_on else "OFFLINE",
                    is_stale=False,
                    has_sensor_error=False,
                    sensor_error_categories=[],
                    max_fill_pct=round(max_pct, 1),
                    status_color=color,
                    fill_levels=FillLevels(**fill_dict),
                    updated_at=s.get("updated_at", get_current_iso_time()),
                )
            )

        station_list.sort(key=lambda x: x.station_id)
        return LiveStatusResponse(
            stations=station_list,
            total_active_stations=len(station_list),
            total_waste_categories=4,
            total_monitored_compartments=len(station_list) * 4,
            total_drop_events=len(self.drop_events),
        )

    def _create_user_client(self, access_token: str) -> Any:
        """Create a per-request Supabase client authenticated with the user's JWT."""
        if not SUPABASE_AVAILABLE or not self.supabase_url or not self.supabase_key:
            raise DatabaseUnavailableError(
                "Supabase client is not configured. Check NEXT_PUBLIC_SUPABASE_URL and key settings."
            )
        if ClientOptions is not None:
            options = ClientOptions(
                headers={"Authorization": f"Bearer {access_token}"},
                auto_refresh_token=False,
                persist_session=False,
            )
            return create_client(self.supabase_url, self.supabase_key, options=options)
        client = create_client(self.supabase_url, self.supabase_key)
        client.postgrest.auth(access_token)
        return client

    def authenticate_staff_user(
        self, access_token: str, allowed_roles: Tuple[str, ...] = ("ADMIN",)
    ) -> Any:
        """
        Validate a Supabase JWT via Supabase Auth, verify active staff status and
        allowed role in profiles under RLS, and return a JWT-scoped Supabase client.
        """
        if not access_token or not access_token.strip():
            raise AuthenticationError("Authentication required.")

        if not self.client:
            raise DatabaseUnavailableError(
                "Supabase client is not configured. Check NEXT_PUBLIC_SUPABASE_URL and key settings."
            )

        try:
            user_resp = self.client.auth.get_user(jwt=access_token)
        except Exception as exc:
            raise AuthenticationError(f"Invalid or expired session token: {exc}") from exc

        user = getattr(user_resp, "user", None)
        user_id = getattr(user, "id", None)
        if not user_id:
            raise AuthenticationError("Invalid or expired session token.")

        user_client = self._create_user_client(access_token)

        try:
            profile_res = (
                user_client.table("profiles")
                .select("user_id, role, is_active")
                .eq("user_id", user_id)
                .single()
                .execute()
            )
        except Exception as exc:
            raise AuthorizationError(
                f"Unable to verify active staff profile: {exc}"
            ) from exc

        profile = profile_res.data
        if not isinstance(profile, dict):
            raise AuthorizationError("Staff profile not found.")
        if not profile.get("is_active"):
            raise AuthorizationError("Staff account is inactive.")

        role = str(profile.get("role") or "").upper()
        if role not in allowed_roles:
            raise AuthorizationError(
                f"Unauthorized staff role. Requires {', '.join(allowed_roles)}."
            )

        return user_client

    def get_analytics(self, client: Optional[Any] = None) -> AnalyticsResponse:
        """
        Compute daily waste recycling analytics from Supabase drop_events
        for the current Asia/Taipei calendar day using an authenticated user client.
        Uses in-memory store only when use_fixtures=True.
        """
        if self.use_fixtures:
            return self._get_fixture_analytics()

        active_client = client
        if active_client is None:
            raise AuthenticationError("Authentication required to read analytics.")

        start_utc_iso, end_utc_iso = get_taipei_day_utc_bounds()
        try:
            events_res = (
                active_client.table("drop_events")
                .select("event_id, actual_bin_id, classified_category_id, classified_at")
                .gte("classified_at", start_utc_iso)
                .lt("classified_at", end_utc_iso)
                .execute()
            )
            cats_res = (
                active_client.table("waste_categories")
                .select("category_id, category_name")
                .execute()
            )
        except Exception as exc:
            msg = str(exc)
            if "42501" in msg or "permission denied" in msg.lower():
                raise AuthorizationError(
                    f"Permission denied querying analytics from Supabase drop_events: {exc}"
                ) from exc
            raise DatabaseUnavailableError(
                f"Failed to query analytics from Supabase drop_events: {exc}"
            ) from exc

        categories_by_id: Dict[str, str] = {}
        for cat_row in cats_res.data or []:
            cid = cat_row.get("category_id")
            slug = _normalize_category(cat_row.get("category_name"))
            if cid and slug:
                categories_by_id[str(cid)] = slug

        events = events_res.data or []
        breakdown = {"plastic": 0, "paper": 0, "metal": 0, "general": 0}
        total_items = len(events)

        for event in events:
            cid = event.get("classified_category_id")
            slug = categories_by_id.get(str(cid)) if cid else None
            if slug in breakdown:
                breakdown[slug] += 1

        # drop_events schema does not contain an explicit sorting-correctness field.
        return AnalyticsResponse(
            total_items_today=total_items,
            sorting_accuracy_pct=None,
            breakdown=CategoryBreakdown(**breakdown),
        )

    def _get_fixture_analytics(self) -> AnalyticsResponse:
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

    def get_recent_events(
        self, limit: int = 20, client: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Return the most recent verified waste drop events from Supabase drop_events
        ordered by classified_at DESC using an authenticated user client.
        Uses in-memory store only when use_fixtures=True.
        """
        if self.use_fixtures:
            return list(reversed(self.drop_events[-limit:]))

        active_client = client
        if active_client is None:
            raise AuthenticationError("Authentication required to read recent events.")

        try:
            events_res = (
                active_client.table("drop_events")
                .select(
                    "event_id, actual_bin_id, classified_category_id, trigger_sensor_id, "
                    "classification_confidence, classified_at, verified_at, created_at"
                )
                .order("classified_at", desc=True)
                .limit(limit)
                .execute()
            )
            bins_res = (
                active_client.table("bins")
                .select(
                    "bin_id, station_id, category_id, "
                    "stations(station_code, station_name), "
                    "waste_categories(category_name)"
                )
                .execute()
            )
            cats_res = (
                active_client.table("waste_categories")
                .select("category_id, category_name")
                .execute()
            )
        except Exception as exc:
            msg = str(exc)
            if "42501" in msg or "permission denied" in msg.lower():
                raise AuthorizationError(
                    f"Permission denied querying recent events from Supabase drop_events: {exc}"
                ) from exc
            raise DatabaseUnavailableError(
                f"Failed to query recent events from Supabase drop_events: {exc}"
            ) from exc

        categories_by_id: Dict[str, str] = {}
        for cat_row in cats_res.data or []:
            cid = cat_row.get("category_id")
            slug = _normalize_category(cat_row.get("category_name"))
            if cid and slug:
                categories_by_id[str(cid)] = slug

        bins_by_id: Dict[str, Dict[str, Any]] = {}
        for bin_row in bins_res.data or []:
            bid = bin_row.get("bin_id")
            if bid:
                bins_by_id[str(bid)] = bin_row

        rows = events_res.data or []
        normalized: List[Dict[str, Any]] = []
        for row in rows:
            actual_bin_id = row.get("actual_bin_id")
            bin_info = bins_by_id.get(str(actual_bin_id)) if actual_bin_id else None

            station_code = "Unknown"
            dropped_slug = "unknown"
            if isinstance(bin_info, dict):
                st_obj = bin_info.get("stations")
                if isinstance(st_obj, list):
                    st_obj = st_obj[0] if st_obj else None
                if isinstance(st_obj, dict) and st_obj.get("station_code"):
                    station_code = str(st_obj["station_code"])

                bin_cat_obj = bin_info.get("waste_categories")
                if isinstance(bin_cat_obj, list):
                    bin_cat_obj = bin_cat_obj[0] if bin_cat_obj else None
                if isinstance(bin_cat_obj, dict):
                    dropped_slug = (
                        _normalize_category(bin_cat_obj.get("category_name"))
                        or "unknown"
                    )

            classified_cid = row.get("classified_category_id")
            classified_slug = (
                categories_by_id.get(str(classified_cid))
                if classified_cid
                else None
            ) or "unknown"

            normalized.append(
                {
                    "event_id": str(row.get("event_id") or ""),
                    "station_id": station_code,
                    "waste_category": classified_slug,
                    "dropped_in_bin": dropped_slug,
                    "confidence": float(row.get("classification_confidence") or 0.0),
                    "is_correct_sort": None,
                    "timestamp": row.get("classified_at")
                    or row.get("verified_at")
                    or row.get("created_at")
                    or get_current_iso_time(),
                }
            )
        return normalized

    def get_waste_categories(self) -> List[Dict[str, Any]]:
        """Retrieve active waste categories from Supabase."""
        if self.use_fixtures:
            return [
                {"category_id": "cat-plastic", "category_name": "Plastic", "indicator_color": "#38A6A0", "is_active": True},
                {"category_id": "cat-paper", "category_name": "Paper", "indicator_color": "#D49A3A", "is_active": True},
                {"category_id": "cat-metal", "category_name": "Metal", "indicator_color": "#71849A", "is_active": True},
                {"category_id": "cat-general", "category_name": "General Waste", "indicator_color": "#776F68", "is_active": True},
            ]

        if not self.client:
            raise DatabaseUnavailableError(
                "Supabase client is not configured. Check NEXT_PUBLIC_SUPABASE_URL and key settings."
            )

        try:
            res = (
                self.client.table("waste_categories")
                .select("category_id, category_name, description, indicator_color, is_active")
                .eq("is_active", True)
                .execute()
            )
        except Exception as exc:
            raise DatabaseUnavailableError(
                f"Failed to query waste_categories from Supabase: {exc}"
            ) from exc

        return res.data or []

    def _format_admin_bin(self, b: Dict[str, Any]) -> Dict[str, Any]:
        cat_obj = b.get("waste_categories")
        if isinstance(cat_obj, list):
            cat_obj = cat_obj[0] if cat_obj else None
        bs = b.get("bin_status")
        if isinstance(bs, list):
            bs = bs[0] if bs else None
        return {
            "bin_id": str(b.get("bin_id")),
            "area_id": str(b.get("area_id")) if b.get("area_id") else None,
            "category_id": str(b.get("category_id")),
            "category_name": cat_obj.get("category_name") if isinstance(cat_obj, dict) else "Unknown",
            "capacity_liters": float(b["capacity_liters"]) if b.get("capacity_liters") is not None else 50.0,
            "is_active": bool(b.get("is_active", True)),
            "fill_percentage": float(bs["fill_percentage"]) if isinstance(bs, dict) and bs.get("fill_percentage") is not None else None,
            "operational_status": bs.get("operational_status") if isinstance(bs, dict) else None,
            "updated_at": bs.get("updated_at") if isinstance(bs, dict) else None,
        }

    def _format_admin_station_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        location = row.get("locations")
        if isinstance(location, list):
            location = location[0] if location else None

        floors_out: List[Dict[str, Any]] = []
        flat_bins: List[Dict[str, Any]] = []

        raw_floors = sorted(
            row.get("floors") or [],
            key=lambda fl: (int(fl.get("floor_order") or 0), str(fl.get("floor_name") or "")),
        )
        for fl in raw_floors:
            areas_out: List[Dict[str, Any]] = []
            for area in fl.get("disposal_areas") or []:
                area_bins = [self._format_admin_bin(b) for b in (area.get("bins") or [])]
                flat_bins.extend(area_bins)
                areas_out.append(
                    {
                        "area_id": str(area.get("area_id")),
                        "area_name": str(area.get("area_name") or ""),
                        "description": area.get("description"),
                        "is_active": bool(area.get("is_active", True)),
                        "bins": area_bins,
                    }
                )
            floors_out.append(
                {
                    "floor_id": str(fl.get("floor_id")),
                    "floor_name": str(fl.get("floor_name") or ""),
                    "floor_order": int(fl.get("floor_order") or 0),
                    "is_active": bool(fl.get("is_active", True)),
                    "disposal_areas": areas_out,
                }
            )

        # Preserve any legacy flat bins if floors weren't joined in a test stub
        if not floors_out and row.get("bins"):
            flat_bins = [self._format_admin_bin(b) for b in (row.get("bins") or [])]

        raw_img = row.get("image_url")
        image_url = (
            str(raw_img).strip()
            if isinstance(raw_img, str) and raw_img.strip()
            else None
        )

        return {
            "station_uuid": str(row.get("station_id")),
            "station_code": str(row.get("station_code") or row.get("station_id")),
            "station_name": str(row.get("station_name") or ""),
            "image_url": image_url,
            "is_active": bool(row.get("is_active", True)),
            "location_id": str(row.get("location_id")) if row.get("location_id") else None,
            "location_name": location.get("location_name") if isinstance(location, dict) else "",
            "description": location.get("description") if isinstance(location, dict) else None,
            "latitude": float(location["latitude"]) if isinstance(location, dict) and location.get("latitude") is not None else None,
            "longitude": float(location["longitude"]) if isinstance(location, dict) and location.get("longitude") is not None else None,
            "floors": floors_out,
            "bins": flat_bins,
        }

    def get_admin_stations(self, client: Optional[Any] = None) -> List[Dict[str, Any]]:
        """Retrieve all stations (active and inactive) with floors, disposal areas, and bins."""
        if not client:
            raise AuthenticationError("ADMIN authentication required.")

        select_tail = (
            "locations(location_id, location_name, description, latitude, longitude, is_active), "
            "floors(floor_id, floor_name, floor_order, is_active, "
            "disposal_areas(area_id, area_name, description, is_active, "
            "bins(bin_id, area_id, category_id, capacity_liters, is_active, "
            "waste_categories(category_name), "
            "bin_status(fill_percentage, operational_status, updated_at))))"
        )
        try:
            try:
                res = (
                    client.table("stations")
                    .select("station_id, station_code, station_name, image_url, is_active, location_id, " + select_tail)
                    .order("station_code")
                    .execute()
                )
            except Exception as inner_exc:
                if "image_url" not in str(inner_exc):
                    raise
                res = (
                    client.table("stations")
                    .select("station_id, station_code, station_name, is_active, location_id, " + select_tail)
                    .order("station_code")
                    .execute()
                )
        except Exception as exc:
            msg = str(exc)
            if "42501" in msg or "permission denied" in msg.lower():
                raise AuthorizationError(f"Permission denied reading admin stations: {exc}") from exc
            raise DatabaseUnavailableError(f"Failed to query admin stations from Supabase: {exc}") from exc

        return [self._format_admin_station_row(r) for r in (res.data or [])]

    def create_admin_station(
        self, payload: StationCreatePayload, client: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Create a new location, station, floors, disposal areas, and bins in Supabase under ADMIN JWT.
        Uses compensating rollback if any step fails so incomplete stations are not left behind.
        """
        if not client:
            raise AuthenticationError("ADMIN authentication required.")

        floors_spec = payload.floors
        if not floors_spec and payload.bins:
            floors_spec = [
                FloorCreateItem(
                    floor_name="Unassigned Floor",
                    floor_order=0,
                    is_active=True,
                    disposal_areas=[
                        DisposalAreaCreateItem(
                            area_name="Unassigned Area",
                            description="Default area for initial bin configuration",
                            is_active=True,
                            bins=payload.bins,
                        )
                    ],
                )
            ]

        # 1. Validate categories exist in database
        try:
            cats_res = client.table("waste_categories").select("category_id").eq("is_active", True).execute()
            valid_cat_ids = {str(c["category_id"]) for c in (cats_res.data or [])}
        except Exception as exc:
            raise DatabaseUnavailableError(f"Failed to validate waste categories: {exc}") from exc

        for fl in floors_spec or []:
            for area in fl.disposal_areas:
                for b in area.bins:
                    if b.category_id not in valid_cat_ids:
                        raise ValidationError(f"Invalid or inactive waste category ID: {b.category_id}")

        # 2. Check duplicate station_code
        try:
            dup_res = (
                client.table("stations")
                .select("station_id")
                .eq("station_code", payload.station_code.strip())
                .execute()
            )
            if dup_res.data:
                raise ConflictError(f"Station code '{payload.station_code}' already exists.")
        except ConflictError:
            raise
        except Exception as exc:
            msg = str(exc)
            if "42501" in msg or "permission denied" in msg.lower():
                raise AuthorizationError(f"Permission denied checking stations: {exc}") from exc
            raise DatabaseUnavailableError(f"Failed to verify station uniqueness: {exc}") from exc

        created_location_id: Optional[str] = None
        created_station_id: Optional[str] = None
        created_floor_ids: List[str] = []
        created_area_ids: List[str] = []
        created_bin_ids: List[str] = []

        try:
            # 3. Insert location
            loc_res = (
                client.table("locations")
                .insert(
                    {
                        "location_name": payload.location_name.strip(),
                        "description": payload.description.strip() if payload.description else None,
                        "latitude": payload.latitude,
                        "longitude": payload.longitude,
                        "is_active": payload.is_active,
                    }
                )
                .execute()
            )
            if not loc_res.data:
                raise DatabaseUnavailableError("Location insert returned no record.")
            created_location_id = str(loc_res.data[0]["location_id"])

            # 4. Insert station
            station_insert_data: Dict[str, Any] = {
                "location_id": created_location_id,
                "station_code": payload.station_code.strip(),
                "station_name": payload.station_name.strip(),
                "is_active": payload.is_active,
            }
            if payload.image_url is not None:
                station_insert_data["image_url"] = payload.image_url

            try:
                st_res = (
                    client.table("stations")
                    .insert(station_insert_data)
                    .execute()
                )
            except Exception as st_exc:
                if "image_url" in str(st_exc) and payload.image_url is None:
                    station_insert_data.pop("image_url", None)
                    st_res = (
                        client.table("stations")
                        .insert(station_insert_data)
                        .execute()
                    )
                else:
                    raise
            if not st_res.data:
                raise DatabaseUnavailableError("Station insert returned no record.")
            created_station_id = str(st_res.data[0]["station_id"])

            # 5. Insert floors -> disposal_areas -> bins (do NOT fabricate bin_status telemetry)
            for fl in floors_spec or []:
                fl_res = (
                    client.table("floors")
                    .insert(
                        {
                            "station_id": created_station_id,
                            "floor_name": fl.floor_name.strip(),
                            "floor_order": fl.floor_order,
                            "is_active": fl.is_active,
                        }
                    )
                    .execute()
                )
                if not fl_res.data:
                    raise DatabaseUnavailableError("Floor insert returned no record.")
                fl_id = str(fl_res.data[0]["floor_id"])
                created_floor_ids.append(fl_id)

                for area in fl.disposal_areas:
                    area_res = (
                        client.table("disposal_areas")
                        .insert(
                            {
                                "floor_id": fl_id,
                                "area_name": area.area_name.strip(),
                                "description": area.description.strip() if area.description else None,
                                "is_active": area.is_active,
                            }
                        )
                        .execute()
                    )
                    if not area_res.data:
                        raise DatabaseUnavailableError("Disposal area insert returned no record.")
                    area_id = str(area_res.data[0]["area_id"])
                    created_area_ids.append(area_id)

                    bins_rows = [
                        {
                            "station_id": created_station_id,
                            "area_id": area_id,
                            "category_id": b.category_id,
                            "capacity_liters": b.capacity_liters,
                            "is_active": b.is_active,
                        }
                        for b in area.bins
                    ]
                    bins_res = client.table("bins").insert(bins_rows).execute()
                    if not bins_res.data or len(bins_res.data) != len(bins_rows):
                        raise DatabaseUnavailableError("Bin creation did not return all created bins.")
                    created_bin_ids.extend(str(br["bin_id"]) for br in bins_res.data)
        except Exception as exc:
            # Compensating rollback in reverse dependency order (respecting ON DELETE RESTRICT)
            for bid in reversed(created_bin_ids):
                try:
                    client.table("bins").delete().eq("bin_id", bid).execute()
                except Exception:
                    pass
            for aid in reversed(created_area_ids):
                try:
                    client.table("disposal_areas").delete().eq("area_id", aid).execute()
                except Exception:
                    pass
            for fid in reversed(created_floor_ids):
                try:
                    client.table("floors").delete().eq("floor_id", fid).execute()
                except Exception:
                    pass
            if created_station_id:
                try:
                    client.table("stations").delete().eq("station_id", created_station_id).execute()
                except Exception:
                    pass
            if created_location_id:
                try:
                    client.table("locations").delete().eq("location_id", created_location_id).execute()
                except Exception:
                    pass

            msg = str(exc)
            if isinstance(exc, (ValidationError, ConflictError, AuthorizationError, DatabaseUnavailableError)):
                raise
            if "42501" in msg or "permission denied" in msg.lower():
                raise AuthorizationError(f"Permission denied creating station: {exc}") from exc
            if "23505" in msg or "duplicate" in msg.lower():
                raise ConflictError(f"Duplicate station, floor, or disposal area constraint violation: {exc}") from exc
            raise DatabaseUnavailableError(f"Failed to create station hierarchy: {exc}") from exc

        all_stations = self.get_admin_stations(client=client)
        created = next(
            (s for s in all_stations if s["station_uuid"] == created_station_id),
            None,
        )
        return created or {"station_uuid": created_station_id, "station_code": payload.station_code}

    def update_admin_station(
        self,
        station_code: str,
        payload: StationUpdatePayload,
        client: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Update an existing station, its location, floors, disposal areas, and bins under ADMIN JWT.
        Preserves station_id, station_code, bin_status telemetry, and historical drop_events.
        """
        if not client:
            raise AuthenticationError("ADMIN authentication required.")

        try:
            st_res = (
                client.table("stations")
                .select("station_id, location_id, station_code")
                .eq("station_code", station_code)
                .execute()
            )
        except Exception as exc:
            msg = str(exc)
            if "42501" in msg or "permission denied" in msg.lower():
                raise AuthorizationError(f"Permission denied reading station: {exc}") from exc
            raise DatabaseUnavailableError(f"Failed to fetch station '{station_code}': {exc}") from exc

        if not st_res.data:
            raise RecordNotFoundError(f"Station '{station_code}' not found.")

        st_row = st_res.data[0]
        station_uuid = str(st_row["station_id"])
        location_id = st_row.get("location_id")

        # Validate categories across floors or flat bins
        if payload.floors is not None or payload.bins is not None:
            cats_res = client.table("waste_categories").select("category_id").eq("is_active", True).execute()
            valid_cat_ids = {str(c["category_id"]) for c in (cats_res.data or [])}
            for fl in payload.floors or []:
                for area in fl.disposal_areas:
                    for b in area.bins:
                        if b.category_id not in valid_cat_ids:
                            raise ValidationError(f"Invalid or inactive waste category ID: {b.category_id}")
            for b in payload.bins or []:
                if b.category_id not in valid_cat_ids:
                    raise ValidationError(f"Invalid or inactive waste category ID: {b.category_id}")

        try:
            if location_id:
                client.table("locations").update(
                    {
                        "location_name": payload.location_name.strip(),
                        "description": payload.description.strip() if payload.description else None,
                        "latitude": payload.latitude,
                        "longitude": payload.longitude,
                        "is_active": payload.is_active,
                    }
                ).eq("location_id", location_id).execute()

            station_update_data: Dict[str, Any] = {
                "station_name": payload.station_name.strip(),
                "is_active": payload.is_active,
            }
            if "image_url" in payload.model_fields_set:
                station_update_data["image_url"] = payload.image_url

            try:
                client.table("stations").update(
                    station_update_data
                ).eq("station_id", station_uuid).execute()
            except Exception as st_upd_exc:
                if "image_url" in str(st_upd_exc) and payload.image_url is None:
                    station_update_data.pop("image_url", None)
                    client.table("stations").update(
                        station_update_data
                    ).eq("station_id", station_uuid).execute()
                else:
                    raise

            # Explicit bin deletions (respecting FK constraints)
            for del_id in payload.delete_bin_ids:
                try:
                    client.table("bins").delete().eq("bin_id", del_id).eq("station_id", station_uuid).execute()
                except Exception as del_exc:
                    del_msg = str(del_exc)
                    if "23503" in del_msg or "foreign key" in del_msg.lower():
                        raise ConflictError(
                            f"Cannot remove bin {del_id} because historical events or telemetry reference it. Deactivate it instead."
                        ) from del_exc
                    raise

            # Hierarchical floors -> disposal_areas -> bins updates
            if payload.floors is not None:
                for fl in payload.floors:
                    if fl.floor_id:
                        client.table("floors").update(
                            {
                                "floor_name": fl.floor_name.strip(),
                                "floor_order": fl.floor_order,
                                "is_active": fl.is_active,
                            }
                        ).eq("floor_id", fl.floor_id).eq("station_id", station_uuid).execute()
                        target_floor_id = fl.floor_id
                    else:
                        fl_ins = (
                            client.table("floors")
                            .insert(
                                {
                                    "station_id": station_uuid,
                                    "floor_name": fl.floor_name.strip(),
                                    "floor_order": fl.floor_order,
                                    "is_active": fl.is_active,
                                }
                            )
                            .execute()
                        )
                        target_floor_id = str(fl_ins.data[0]["floor_id"])

                    for area in fl.disposal_areas:
                        if area.area_id:
                            client.table("disposal_areas").update(
                                {
                                    "floor_id": target_floor_id,
                                    "area_name": area.area_name.strip(),
                                    "description": area.description.strip() if area.description else None,
                                    "is_active": area.is_active,
                                }
                            ).eq("area_id", area.area_id).execute()
                            target_area_id = area.area_id
                        else:
                            area_ins = (
                                client.table("disposal_areas")
                                .insert(
                                    {
                                        "floor_id": target_floor_id,
                                        "area_name": area.area_name.strip(),
                                        "description": area.description.strip() if area.description else None,
                                        "is_active": area.is_active,
                                    }
                                )
                                .execute()
                            )
                            target_area_id = str(area_ins.data[0]["area_id"])

                        for b in area.bins:
                            dest_area_id = b.area_id or target_area_id
                            if b.bin_id:
                                client.table("bins").update(
                                    {
                                        "area_id": dest_area_id,
                                        "category_id": b.category_id,
                                        "capacity_liters": b.capacity_liters,
                                        "is_active": b.is_active,
                                    }
                                ).eq("bin_id", b.bin_id).eq("station_id", station_uuid).execute()
                            else:
                                client.table("bins").insert(
                                    {
                                        "station_id": station_uuid,
                                        "area_id": dest_area_id,
                                        "category_id": b.category_id,
                                        "capacity_liters": b.capacity_liters,
                                        "is_active": b.is_active,
                                    }
                                ).execute()

            # Legacy flat bins fallback
            elif payload.bins is not None:
                for b in payload.bins:
                    if b.bin_id:
                        update_fields: Dict[str, Any] = {
                            "category_id": b.category_id,
                            "capacity_liters": b.capacity_liters,
                            "is_active": b.is_active,
                        }
                        if b.area_id:
                            update_fields["area_id"] = b.area_id
                        client.table("bins").update(update_fields).eq("bin_id", b.bin_id).eq("station_id", station_uuid).execute()
                    else:
                        insert_fields: Dict[str, Any] = {
                            "station_id": station_uuid,
                            "category_id": b.category_id,
                            "capacity_liters": b.capacity_liters,
                            "is_active": b.is_active,
                        }
                        if b.area_id:
                            insert_fields["area_id"] = b.area_id
                        client.table("bins").insert(insert_fields).execute()
        except (ConflictError, ValidationError, AuthorizationError):
            raise
        except Exception as exc:
            msg = str(exc)
            if "42501" in msg or "permission denied" in msg.lower():
                raise AuthorizationError(f"Permission denied updating station: {exc}") from exc
            if "23514" in msg or "cross-station" in msg.lower():
                raise ValidationError(f"Cross-station bin/area assignment rejected: {exc}") from exc
            if "23505" in msg or "duplicate" in msg.lower():
                raise ConflictError(f"Duplicate floor or disposal area name: {exc}") from exc
            raise DatabaseUnavailableError(f"Failed to update station '{station_code}': {exc}") from exc

        all_stations = self.get_admin_stations(client=client)
        updated = next(
            (s for s in all_stations if s["station_uuid"] == station_uuid),
            None,
        )
        return updated or {"station_uuid": station_uuid, "station_code": station_code}

    def simulate_bin_telemetry(
        self, payload: SimulateBinTelemetryPayload, client: Any
    ) -> Dict[str, Any]:
        """
        ADMIN-only simulation for existing bins without registered physical sensors.
        Delegates to the atomic PostgreSQL RPC `admin_simulate_bin_telemetry`, which:
        - verifies active ADMIN privileges
        - rejects unknown/inactive bins, active physical sensors, and HARDWARE rows
        - never writes to sensor_readings
        - preserves prior valid fill_percentage on SENSOR_ERROR
        """
        if self.use_fixtures or client is None:
            raise DatabaseUnavailableError(
                "Supabase connection required for ADMIN bin telemetry simulation."
            )

        results: List[Dict[str, Any]] = []
        for item in payload.readings:
            try:
                res = client.rpc(
                    "admin_simulate_bin_telemetry",
                    {
                        "p_bin_id": item.bin_id,
                        "p_fill_percentage": item.fill_percentage,
                        "p_operational_status": item.operational_status,
                        "p_measured_at": item.measured_at,
                    },
                ).execute()
            except Exception as exc:
                msg = str(exc)
                low = msg.lower()
                if "42501" in msg or "permission denied" in low or "admin privileges required" in low:
                    raise AuthorizationError(f"Admin privileges required: {exc}") from exc
                if "p0002" in low or "not found" in low:
                    raise RecordNotFoundError(f"Target bin not found: {exc}") from exc
                if "23514" in msg or "hardware" in low or "active physical sensor" in low or "inactive bin" in low:
                    raise ConflictError(f"Simulation rejected: {exc}") from exc
                if "22023" in msg:
                    raise ValidationError(f"Invalid simulation parameter: {exc}") from exc
                raise DatabaseUnavailableError(f"Failed to simulate bin telemetry: {exc}") from exc

            row = res.data[0] if isinstance(res.data, list) and res.data else (res.data or {})
            op_status = str(row.get("operational_status") or item.operational_status).upper()
            raw_fill = row.get("fill_percentage")
            results.append({
                "bin_id": str(row.get("bin_id") or item.bin_id),
                "fill_percentage": None if op_status == "SENSOR_ERROR" else (float(raw_fill) if raw_fill is not None else None),
                "operational_status": op_status,
                "measured_at": row.get("measured_at"),
                "updated_at": row.get("updated_at"),
                "reading_source": row.get("reading_source") or "SIMULATED",
            })

        return {
            "status": "simulated",
            "processed": len(results),
            "results": results,
        }


# Global singleton database instance
db = DatabaseManager()
