"""
Comprehensive Unit and Integration Tests for SortSense Cloud API.
Tests all endpoints, validations, business logic, color calculations, and error cases.
"""

import pytest
from fastapi.testclient import TestClient
from types import SimpleNamespace
from api.db import db
from api.index import app
from api.models import compute_status_color

client = TestClient(app)


@pytest.fixture(autouse=True)
def _enable_test_fixtures_for_legacy_tests(request):
    """
    Existing contract tests rely on in-memory seed fixtures.
    Production mode (use_fixtures=False) is tested explicitly in
    TestSupabaseReadIntegration and TestSupabaseAnalyticsAndRecentEvents.
    """
    if request.cls in (
        TestSupabaseReadIntegration,
        TestSupabaseAnalyticsAndRecentEvents,
        TestAdminStationManagement,
    ):
        yield
        return

    prev_use_fixtures = db.use_fixtures
    db.use_fixtures = True
    if not db.stations:
        db._seed_default_stations()
    try:
        yield
    finally:
        db.use_fixtures = prev_use_fixtures


class TestHealthAndRoot:
    """Test root and health diagnostic endpoints."""

    def test_root_endpoint(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "SortSense Cloud API"
        assert data["status"] == "running"

    def test_api_root_prefix(self):
        response = client.get("/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "running"

    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "OK"
        assert "database_connected" in data


class TestTelemetryIngestion:
    """Test ToF sensor fill-level telemetry ingestion (ESP32-S3)."""

    def test_valid_telemetry_post(self):
        payload = {
            "station_id": "ST-001",
            "fill_levels": {
                "plastic": 45,
                "paper": 80,
                "metal": 20,
                "general": 95,
            },
        }
        response = client.post("/api/telemetry/fill-levels", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["station_id"] == "ST-001"
        assert data["fill_levels"]["general"] == 95.0

    def test_telemetry_without_api_prefix(self):
        payload = {
            "station_id": "ST-001",
            "fill_levels": {"plastic": 10, "paper": 20, "metal": 30, "general": 40},
        }
        response = client.post("/telemetry/fill-levels", json=payload)
        assert response.status_code == 200
        assert response.json()["status"] == "success"

    def test_telemetry_auto_provisions_new_station(self):
        payload = {
            "station_id": "ST-NEW-999",
            "fill_levels": {"plastic": 15, "paper": 25, "metal": 35, "general": 45},
        }
        response = client.post("/api/telemetry/fill-levels", json=payload)
        assert response.status_code == 200

        # Verify new station is visible in live status
        status_res = client.get("/api/dashboard/live-status")
        station_ids = [s["station_id"] for s in status_res.json()["stations"]]
        assert "ST-NEW-999" in station_ids

    def test_telemetry_invalid_payload(self):
        # Missing fill_levels
        response = client.post("/api/telemetry/fill-levels", json={"station_id": "ST-001"})
        assert response.status_code == 422


class TestWasteDropEventLogging:
    """Test verified waste drop event logging (AI/LLM Backend)."""

    def test_valid_waste_drop_returns_201(self):
        payload = {
            "station_id": "ST-001",
            "waste_category": "plastic",
            "dropped_in_bin": "plastic",
            "confidence": 0.91,
            "is_correct_sort": True,
        }
        response = client.post("/api/events/log-waste", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "created"
        assert data["event"]["station_id"] == "ST-001"
        assert data["event"]["waste_category"] == "plastic"
        assert data["event"]["is_correct_sort"] is True

    def test_incorrect_sort_logging(self):
        payload = {
            "station_id": "ST-002",
            "waste_category": "paper",
            "dropped_in_bin": "general",
            "confidence": 0.85,
            "is_correct_sort": False,
        }
        response = client.post("/api/events/log-waste", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["event"]["is_correct_sort"] is False

    def test_invalid_category_enum(self):
        payload = {
            "station_id": "ST-001",
            "waste_category": "radioactive",  # Invalid enum
            "dropped_in_bin": "plastic",
            "confidence": 0.9,
            "is_correct_sort": False,
        }
        response = client.post("/api/events/log-waste", json=payload)
        assert response.status_code == 422

    def test_confidence_out_of_bounds(self):
        payload = {
            "station_id": "ST-001",
            "waste_category": "plastic",
            "dropped_in_bin": "plastic",
            "confidence": 1.5,  # > 1.0
            "is_correct_sort": True,
        }
        response = client.post("/api/events/log-waste", json=payload)
        assert response.status_code == 422


class TestLiveStatusEndpoint:
    """Test GET /api/dashboard/live-status color rules and computations."""

    def test_live_status_structure(self):
        response = client.get("/api/dashboard/live-status")
        assert response.status_code == 200
        data = response.json()
        assert "stations" in data
        assert len(data["stations"]) > 0

        first_station = data["stations"][0]
        assert "station_id" in first_station
        assert "name" in first_station
        assert "latitude" in first_station
        assert "longitude" in first_station
        assert "is_online" in first_station
        assert "max_fill_pct" in first_station
        assert "status_color" in first_station
        assert "fill_levels" in first_station
        assert "updated_at" in first_station

    def test_color_rule_green(self):
        assert compute_status_color(0.0) == "green"
        assert compute_status_color(59.9) == "green"

    def test_color_rule_yellow(self):
        assert compute_status_color(60.0) == "yellow"
        assert compute_status_color(84.0) == "yellow"

    def test_color_rule_red(self):
        assert compute_status_color(85.0) == "red"
        assert compute_status_color(95.0) == "red"
        assert compute_status_color(100.0) == "red"

    def test_live_status_dynamic_color_update(self):
        # Push 95% to ST-001
        client.post(
            "/api/telemetry/fill-levels",
            json={
                "station_id": "ST-001",
                "fill_levels": {"plastic": 20, "paper": 30, "metal": 10, "general": 95},
            },
        )
        res = client.get("/api/dashboard/live-status")
        st1 = next(s for s in res.json()["stations"] if s["station_id"] == "ST-001")
        assert st1["max_fill_pct"] == 95.0
        assert st1["status_color"] == "red"


class TestAnalyticsEndpoint:
    """Test GET /api/dashboard/analytics."""

    def test_analytics_response_format(self):
        response = client.get("/api/dashboard/analytics")
        assert response.status_code == 200
        data = response.json()
        assert "total_items_today" in data
        assert "sorting_accuracy_pct" in data
        assert "breakdown" in data

        breakdown = data["breakdown"]
        for cat in ["plastic", "paper", "metal", "general"]:
            assert cat in breakdown
            assert isinstance(breakdown[cat], int)

        assert 0.0 <= data["sorting_accuracy_pct"] <= 100.0

    def test_analytics_updates_after_logging_waste(self):
        initial = client.get("/api/dashboard/analytics").json()
        initial_total = initial["total_items_today"]
        initial_metal = initial["breakdown"]["metal"]

        client.post(
            "/api/events/log-waste",
            json={
                "station_id": "ST-001",
                "waste_category": "metal",
                "dropped_in_bin": "metal",
                "confidence": 0.95,
                "is_correct_sort": True,
            },
        )

        updated = client.get("/api/dashboard/analytics").json()
        assert updated["total_items_today"] == initial_total + 1
        assert updated["breakdown"]["metal"] == initial_metal + 1


class TestProvisioningAndEmptying:
    """Test QR-code phone GPS onboarding and manual janitor bin emptying."""

    def test_station_provisioning(self):
        payload = {
            "station_id": "ST-PROV-101",
            "name": "Chemistry Hall 3F",
            "latitude": 24.7968,
            "longitude": 120.9935,
        }
        response = client.post("/api/bins/provision", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "provisioned"
        assert data["station"]["name"] == "Chemistry Hall 3F"

        # Verify coordinates in live-status
        res = client.get("/api/dashboard/live-status")
        st = next(s for s in res.json()["stations"] if s["station_id"] == "ST-PROV-101")
        assert st["latitude"] == 24.7968
        assert st["longitude"] == 120.9935

    def test_empty_single_compartment(self):
        # Set high fill levels
        client.post(
            "/api/telemetry/fill-levels",
            json={
                "station_id": "ST-001",
                "fill_levels": {"plastic": 80, "paper": 70, "metal": 60, "general": 90},
            },
        )
        # Empty only general compartment
        response = client.post(
            "/api/bins/empty",
            json={"station_id": "ST-001", "compartment": "general"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "emptied"
        assert data["fill_levels"]["general"] == 0.0
        assert data["fill_levels"]["plastic"] == 80.0

    def test_empty_all_compartments(self):
        # Empty all compartments
        response = client.post(
            "/api/bins/empty",
            json={"station_id": "ST-001", "compartment": "all"},
        )
        assert response.status_code == 200
        data = response.json()
        for cat in ["plastic", "paper", "metal", "general"]:
            assert data["fill_levels"][cat] == 0.0

    def test_empty_non_existent_station_returns_404(self):
        response = client.post(
            "/api/bins/empty",
            json={"station_id": "ST-DOES-NOT-EXIST", "compartment": "all"},
        )
        assert response.status_code == 404

    def test_recent_events_endpoint(self):
        response = client.get("/api/dashboard/recent-events?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert len(data["events"]) <= 5


class _FakeQuery:
    def __init__(self, data=None, error=None, calls=None, table_name=None):
        self._data = data if data is not None else []
        self._error = error
        self._calls = calls
        self._table_name = table_name

    def select(self, *args, **_kwargs):
        if self._calls is not None:
            self._calls.append((self._table_name, "select", args))
        return self

    def eq(self, *args, **_kwargs):
        if self._calls is not None:
            self._calls.append((self._table_name, "eq", args))
        return self

    def gte(self, *args, **_kwargs):
        if self._calls is not None:
            self._calls.append((self._table_name, "gte", args))
        return self

    def lt(self, *args, **_kwargs):
        if self._calls is not None:
            self._calls.append((self._table_name, "lt", args))
        return self

    def order(self, *args, **kwargs):
        if self._calls is not None:
            self._calls.append((self._table_name, "order", args, kwargs))
        return self

    def limit(self, *args, **_kwargs):
        if self._calls is not None:
            self._calls.append((self._table_name, "limit", args))
        return self

    def single(self):
        return self

    def execute(self):
        if self._error is not None:
            raise self._error
        return SimpleNamespace(data=self._data)


class _FakeAuth:
    def __init__(self, user_id="staff-uuid-1", error=None):
        self._user_id = user_id
        self._error = error

    def get_user(self, jwt=None):
        if self._error is not None:
            raise self._error
        if not jwt or jwt == "invalid-token":
            return SimpleNamespace(user=None)
        return SimpleNamespace(user=SimpleNamespace(id=self._user_id))


class _FakeSupabaseClient:
    def __init__(self, table_responses, auth=None):
        self._table_responses = table_responses
        self.auth = auth or _FakeAuth()
        self.calls = []

    def table(self, name):
        resp = self._table_responses.get(name, [])
        if isinstance(resp, Exception):
            return _FakeQuery(error=resp, calls=self.calls, table_name=name)
        return _FakeQuery(data=resp, calls=self.calls, table_name=name)


class TestSupabaseReadIntegration:
    """Verify production read paths (use_fixtures=False) never silently fall back to seed data."""

    def test_disconnected_db_returns_503_not_seed_data(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        monkeypatch.setattr(db, "client", None)

        res = client.get("/api/dashboard/live-status")
        assert res.status_code == 503
        assert "not configured" in res.json()["detail"]

        for path in ["/api/dashboard/analytics", "/api/dashboard/recent-events"]:
            res = client.get(path, headers={"Authorization": "Bearer any-token"})
            assert res.status_code == 503
            assert "not configured" in res.json()["detail"]

    def test_empty_supabase_tables_return_empty_collections(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        fake_client = _FakeSupabaseClient(
            {
                "stations": [],
                "drop_events": [],
                "waste_categories": [],
                "bins": [],
                "profiles": {"user_id": "staff-uuid-1", "role": "ADMIN", "is_active": True},
            }
        )
        monkeypatch.setattr(db, "client", fake_client)
        monkeypatch.setattr(db, "_create_user_client", lambda _tok: fake_client)

        status_res = client.get("/api/dashboard/live-status")
        assert status_res.status_code == 200
        assert status_res.json() == {"stations": []}

        headers = {"Authorization": "Bearer valid-jwt"}
        analytics_res = client.get("/api/dashboard/analytics", headers=headers)
        assert analytics_res.status_code == 200
        assert analytics_res.json() == {
            "total_items_today": 0,
            "sorting_accuracy_pct": None,
            "breakdown": {"plastic": 0, "paper": 0, "metal": 0, "general": 0},
        }

        events_res = client.get("/api/dashboard/recent-events", headers=headers)
        assert events_res.status_code == 200
        assert events_res.json() == {"events": []}

    def test_inactive_stations_missing_coords_and_sensor_errors(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        monkeypatch.setattr(
            db,
            "client",
            _FakeSupabaseClient(
                {
                    "stations": [
                        {
                            "station_id": "uuid-1",
                            "station_code": "RLS-TEST-STATION",
                            "station_name": "RLS Test Station",
                            "is_active": True,
                            "locations": {
                                "location_name": "RLS Test Location",
                                "latitude": None,
                                "longitude": None,
                                "is_active": True,
                            },
                            "bins": [
                                {
                                    "bin_id": "b1",
                                    "is_active": True,
                                    "waste_categories": {"category_name": "Plastic"},
                                    "bin_status": {
                                        "fill_percentage": 75.0,
                                        "operational_status": "NORMAL",
                                        "updated_at": "2026-11-19T07:12:42+00:00",
                                    },
                                },
                                {
                                    "bin_id": "b2",
                                    "is_active": True,
                                    "waste_categories": {"category_name": "Paper"},
                                    "bin_status": {
                                        "fill_percentage": 99.0,
                                        "operational_status": "SENSOR_ERROR",
                                        "updated_at": "2026-11-19T07:12:42+00:00",
                                    },
                                },
                            ],
                        },
                        {
                            "station_id": "uuid-2",
                            "station_code": "INACTIVE-ST",
                            "station_name": "Inactive Station",
                            "is_active": False,
                            "locations": {"latitude": 24.79, "longitude": 120.99, "is_active": True},
                            "bins": [],
                        },
                    ]
                }
            ),
        )

        res = client.get("/api/dashboard/live-status")
        assert res.status_code == 200
        stations = res.json()["stations"]
        assert len(stations) == 1
        st = stations[0]
        assert st["station_id"] == "RLS-TEST-STATION"
        assert st["latitude"] is None
        assert st["longitude"] is None
        # Timestamp 2026-11-19 is stale (>300s), so is_online=False, is_stale=True, connectivity_status=OFFLINE
        assert st["is_online"] is False
        assert st["is_stale"] is True
        assert st["connectivity_status"] == "OFFLINE"
        assert st["has_sensor_error"] is True
        assert st["sensor_error_categories"] == ["paper"]
        assert st["fill_levels"]["plastic"] == 75.0
        assert st["fill_levels"]["paper"] is None
        assert st["fill_levels"]["metal"] is None
        assert st["fill_levels"]["general"] is None
        assert st["max_fill_pct"] == 75.0
        assert st["status_color"] == "yellow"

    def test_fresh_reading_is_online_and_missing_timestamp_is_unknown(self, monkeypatch):
        from datetime import datetime, timezone

        monkeypatch.setattr(db, "use_fixtures", False)
        fresh_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        monkeypatch.setattr(
            db,
            "client",
            _FakeSupabaseClient(
                {
                    "stations": [
                        {
                            "station_id": "uuid-fresh",
                            "station_code": "ST-FRESH",
                            "station_name": "Fresh Station",
                            "is_active": True,
                            "locations": {"latitude": 24.7956, "longitude": 120.9923, "is_active": True},
                            "bins": [
                                {
                                    "bin_id": "b-fresh",
                                    "is_active": True,
                                    "waste_categories": {"category_name": "Plastic"},
                                    "bin_status": {
                                        "fill_percentage": 42.0,
                                        "operational_status": "NORMAL",
                                        "updated_at": fresh_iso,
                                    },
                                }
                            ],
                        },
                        {
                            "station_id": "uuid-no-ts",
                            "station_code": "ST-NO-TS",
                            "station_name": "No Timestamp Station",
                            "is_active": True,
                            "locations": {"latitude": 24.7960, "longitude": 120.9930, "is_active": True},
                            "bins": [
                                {
                                    "bin_id": "b-no-ts",
                                    "is_active": True,
                                    "waste_categories": {"category_name": "Metal"},
                                    "bin_status": None,
                                }
                            ],
                        },
                    ]
                }
            ),
        )

        res = client.get("/api/dashboard/live-status")
        assert res.status_code == 200
        by_id = {s["station_id"]: s for s in res.json()["stations"]}

        fresh = by_id["ST-FRESH"]
        assert fresh["is_online"] is True
        assert fresh["is_stale"] is False
        assert fresh["connectivity_status"] == "ONLINE"
        assert fresh["fill_levels"]["plastic"] == 42.0
        assert fresh["fill_levels"]["paper"] is None
        assert fresh["updated_at"] == fresh_iso

        no_ts = by_id["ST-NO-TS"]
        assert no_ts["is_online"] is False
        assert no_ts["connectivity_status"] == "UNKNOWN"
        assert no_ts["updated_at"] is None
        assert no_ts["max_fill_pct"] is None
        assert no_ts["status_color"] is None

    def test_permission_denied_returns_403_with_error_detail(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        fake_client = _FakeSupabaseClient(
            {
                "profiles": {"user_id": "staff-uuid-1", "role": "ADMIN", "is_active": True},
                "drop_events": RuntimeError("permission denied for table drop_events (42501)"),
            }
        )
        monkeypatch.setattr(db, "client", fake_client)
        monkeypatch.setattr(db, "_create_user_client", lambda _tok: fake_client)

        headers = {"Authorization": "Bearer valid-jwt"}
        for path in ["/api/dashboard/analytics", "/api/dashboard/recent-events"]:
            res = client.get(path, headers=headers)
            assert res.status_code == 403
            assert "permission denied" in res.json()["detail"].lower()


class TestSupabaseAnalyticsAndRecentEvents:
    """Stage 2 tests for JWT-authenticated analytics and recent-events endpoints."""

    def test_unauthenticated_requests_rejected_401(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        fake_client = _FakeSupabaseClient({})
        monkeypatch.setattr(db, "client", fake_client)

        for path in ["/api/dashboard/analytics", "/api/dashboard/recent-events"]:
            res_no_hdr = client.get(path)
            assert res_no_hdr.status_code == 401

            res_bad_jwt = client.get(path, headers={"Authorization": "Bearer invalid-token"})
            assert res_bad_jwt.status_code == 401

    def test_inactive_or_unauthorized_user_rejected_403(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        inactive_client = _FakeSupabaseClient(
            {"profiles": {"user_id": "staff-uuid-1", "role": "ADMIN", "is_active": False}}
        )
        monkeypatch.setattr(db, "client", inactive_client)
        monkeypatch.setattr(db, "_create_user_client", lambda _tok: inactive_client)

        res = client.get(
            "/api/dashboard/analytics",
            headers={"Authorization": "Bearer valid-jwt"},
        )
        assert res.status_code == 403
        assert "inactive" in res.json()["detail"].lower()

    def test_janitor_and_non_admin_rejected_403(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        janitor_client = _FakeSupabaseClient(
            {"profiles": {"user_id": "staff-uuid-1", "role": "JANITOR", "is_active": True}}
        )
        monkeypatch.setattr(db, "client", janitor_client)
        monkeypatch.setattr(db, "_create_user_client", lambda _tok: janitor_client)

        for path in ["/api/dashboard/analytics", "/api/dashboard/recent-events"]:
            res = client.get(path, headers={"Authorization": "Bearer valid-jwt"})
            assert res.status_code == 403
            assert "admin" in res.json()["detail"].lower()

        bad_role_client = _FakeSupabaseClient(
            {"profiles": {"user_id": "staff-uuid-1", "role": "STUDENT", "is_active": True}}
        )
        monkeypatch.setattr(db, "client", bad_role_client)
        monkeypatch.setattr(db, "_create_user_client", lambda _tok: bad_role_client)

        res2 = client.get(
            "/api/dashboard/recent-events",
            headers={"Authorization": "Bearer valid-jwt"},
        )
        assert res2.status_code == 403
        assert "unauthorized" in res2.json()["detail"].lower()

    def test_taipei_date_boundaries_calculation(self):
        from datetime import datetime, timezone
        from api.db import get_taipei_day_utc_bounds

        # 2026-11-20 00:30:00 UTC+8 == 2026-11-19 16:30:00 UTC
        # Taiwan day 2026-11-20 runs from 2026-11-19T16:00:00Z to 2026-11-20T16:00:00Z
        sample_utc = datetime(2026, 11, 19, 16, 30, 0, tzinfo=timezone.utc)
        start_iso, end_iso = get_taipei_day_utc_bounds(sample_utc)
        assert start_iso == "2026-11-19T16:00:00Z"
        assert end_iso == "2026-11-20T16:00:00Z"

    def test_authenticated_analytics_multiple_categories_and_null_accuracy(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        fake_client = _FakeSupabaseClient(
            {
                "profiles": {"user_id": "staff-uuid-1", "role": "ADMIN", "is_active": True},
                "waste_categories": [
                    {"category_id": "cat-pl", "category_name": "Plastic"},
                    {"category_id": "cat-pa", "category_name": "Paper"},
                    {"category_id": "cat-me", "category_name": "Metal"},
                    {"category_id": "cat-ge", "category_name": "General Waste"},
                ],
                "drop_events": [
                    {"event_id": "e1", "actual_bin_id": "b1", "classified_category_id": "cat-pl", "classified_at": "2026-11-20T01:00:00+00:00"},
                    {"event_id": "e2", "actual_bin_id": "b1", "classified_category_id": "cat-pl", "classified_at": "2026-11-20T02:00:00+00:00"},
                    {"event_id": "e3", "actual_bin_id": "b2", "classified_category_id": "cat-pa", "classified_at": "2026-11-20T03:00:00+00:00"},
                    {"event_id": "e4", "actual_bin_id": "b3", "classified_category_id": "cat-me", "classified_at": "2026-11-20T04:00:00+00:00"},
                    {"event_id": "e5", "actual_bin_id": "b4", "classified_category_id": "cat-ge", "classified_at": "2026-11-20T05:00:00+00:00"},
                ],
            }
        )
        monkeypatch.setattr(db, "client", fake_client)
        monkeypatch.setattr(db, "_create_user_client", lambda _tok: fake_client)

        res = client.get(
            "/api/dashboard/analytics",
            headers={"Authorization": "Bearer valid-jwt"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total_items_today"] == 5
        assert data["sorting_accuracy_pct"] is None
        assert data["breakdown"] == {"plastic": 2, "paper": 1, "metal": 1, "general": 1}

        # Confirm Taipei UTC boundaries were applied to drop_events
        gte_calls = [c for c in fake_client.calls if c[0] == "drop_events" and c[1] == "gte"]
        lt_calls = [c for c in fake_client.calls if c[0] == "drop_events" and c[1] == "lt"]
        assert gte_calls and gte_calls[0][2][0] == "classified_at"
        assert lt_calls and lt_calls[0][2][0] == "classified_at"

    def test_recent_events_ordering_joins_and_missing_relationships(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        fake_client = _FakeSupabaseClient(
            {
                "profiles": {"user_id": "staff-uuid-1", "role": "ADMIN", "is_active": True},
                "waste_categories": [
                    {"category_id": "cat-pl", "category_name": "Plastic"},
                    {"category_id": "cat-pa", "category_name": "Paper"},
                ],
                "bins": [
                    {
                        "bin_id": "bin-1",
                        "station_id": "st-uuid-1",
                        "category_id": "cat-pl",
                        "stations": {"station_code": "ST-001", "station_name": "Delta 1F"},
                        "waste_categories": {"category_name": "Plastic"},
                    }
                ],
                "drop_events": [
                    {
                        "event_id": "evt-newest",
                        "actual_bin_id": "bin-1",
                        "classified_category_id": "cat-pl",
                        "trigger_sensor_id": "sens-1",
                        "classification_confidence": 0.94,
                        "classified_at": "2026-11-20T06:00:00+00:00",
                        "verified_at": "2026-11-20T06:00:01+00:00",
                        "created_at": "2026-11-20T06:00:01+00:00",
                    },
                    {
                        "event_id": "evt-missing-fk",
                        "actual_bin_id": "nonexistent-bin",
                        "classified_category_id": "nonexistent-cat",
                        "trigger_sensor_id": "sens-2",
                        "classification_confidence": 0.65,
                        "classified_at": "2026-11-20T05:00:00+00:00",
                        "verified_at": "2026-11-20T05:00:01+00:00",
                        "created_at": "2026-11-20T05:00:01+00:00",
                    },
                ],
            }
        )
        monkeypatch.setattr(db, "client", fake_client)
        monkeypatch.setattr(db, "_create_user_client", lambda _tok: fake_client)

        res = client.get(
            "/api/dashboard/recent-events?limit=10",
            headers={"Authorization": "Bearer valid-jwt"},
        )
        assert res.status_code == 200
        events = res.json()["events"]
        assert len(events) == 2

        # Verify order call used classified_at DESC and limit
        order_calls = [c for c in fake_client.calls if c[0] == "drop_events" and c[1] == "order"]
        assert order_calls and order_calls[0][2] == ("classified_at",) and order_calls[0][3] == {"desc": True}
        limit_calls = [c for c in fake_client.calls if c[0] == "drop_events" and c[1] == "limit"]
        assert limit_calls and limit_calls[0][2] == (10,)

        assert events[0]["event_id"] == "evt-newest"
        assert events[0]["station_id"] == "ST-001"
        assert events[0]["waste_category"] == "plastic"
        assert events[0]["dropped_in_bin"] == "plastic"
        assert events[0]["confidence"] == 0.94
        assert events[0]["is_correct_sort"] is None

        # Missing FK relationships handled gracefully without inventing names
        assert events[1]["event_id"] == "evt-missing-fk"
        assert events[1]["station_id"] == "Unknown"
        assert events[1]["waste_category"] == "unknown"
        assert events[1]["dropped_in_bin"] == "unknown"
        assert events[1]["is_correct_sort"] is None


class _MutableFakeQuery:
    def __init__(self, table_name, store):
        self._table = table_name
        self._store = store
        self._op = "select"
        self._payload = None
        self._filters = []

    def select(self, *_args, **_kwargs):
        self._op = "select"
        return self

    def insert(self, payload):
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, col, val):
        self._filters.append((col, val))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def single(self):
        return self

    def execute(self):
        self._store["ops"].append((self._table, self._op, self._payload, list(self._filters)))
        if self._op == "insert" and self._table in self._store.get("fail_on_insert", ()):
            raise RuntimeError(f"Simulated insert failure on {self._table}")
        if self._op == "delete" and self._table in self._store.get("fk_fail_on_delete", ()):
            raise RuntimeError("23503 foreign key constraint violation")

        data = self._store.get(self._table)
        if self._op == "insert":
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            inserted = []
            for idx, r in enumerate(rows):
                row_copy = dict(r)
                if self._table == "locations":
                    row_copy.setdefault("location_id", f"loc-{len(self._store['locations']) + idx + 1}")
                    self._store["locations"].append(row_copy)
                elif self._table == "stations":
                    row_copy.setdefault("station_id", f"st-{len(self._store['stations']) + idx + 1}")
                    self._store["stations"].append(row_copy)
                elif self._table == "floors":
                    row_copy.setdefault("floor_id", f"fl-{len(self._store['floors']) + idx + 1}")
                    self._store["floors"].append(row_copy)
                elif self._table == "disposal_areas":
                    row_copy.setdefault("area_id", f"ar-{len(self._store['disposal_areas']) + idx + 1}")
                    self._store["disposal_areas"].append(row_copy)
                elif self._table == "bins":
                    row_copy.setdefault("bin_id", f"bin-{len(self._store['bins']) + idx + 1}")
                    self._store["bins"].append(row_copy)
                elif self._table == "drop_events":
                    row_copy.setdefault("event_id", f"evt-{len(self._store.setdefault('drop_events', [])) + idx + 1}")
                    self._store["drop_events"].append(row_copy)
                inserted.append(row_copy)
            return SimpleNamespace(data=inserted)

        if self._op == "delete":
            if self._table in ("stations", "locations", "floors", "disposal_areas", "bins"):
                self._store[self._table] = [
                    r for r in self._store[self._table]
                    if not all(r.get(k) == v for k, v in self._filters)
                ]
            return SimpleNamespace(data=[])

        if self._op == "update":
            if self._table in ("stations", "locations", "floors", "disposal_areas", "bins"):
                for r in self._store[self._table]:
                    if all(r.get(k) == v for k, v in self._filters):
                        r.update(self._payload)
            return SimpleNamespace(data=[])

        # select
        if self._table == "profiles":
            return SimpleNamespace(data=data)
        if self._table == "stations":
            rows = list(self._store["stations"])
            for k, v in self._filters:
                rows = [r for r in rows if r.get(k) == v]
            # Attach nested locations & bins for get_admin_stations
            out = []
            for r in rows:
                rc = dict(r)
                loc = next((l for l in self._store["locations"] if l["location_id"] == rc.get("location_id")), None)
                rc["locations"] = loc
                st_bins = []
                for b in self._store["bins"]:
                    if b.get("station_id") == rc.get("station_id"):
                        bc = dict(b)
                        cat = next((c for c in self._store["waste_categories"] if c["category_id"] == bc.get("category_id")), None)
                        bc["waste_categories"] = {"category_name": cat["category_name"]} if cat else None
                        bs = next((s for s in self._store.get("bin_status", []) if s.get("bin_id") == bc.get("bin_id")), None)
                        bc["bin_status"] = dict(bs) if bs else None
                        st_bins.append(bc)
                rc["bins"] = st_bins

                st_floors = []
                for f in self._store.get("floors", []):
                    if f.get("station_id") == rc.get("station_id"):
                        fc = dict(f)
                        fl_areas = []
                        for a in self._store.get("disposal_areas", []):
                            if a.get("floor_id") == fc.get("floor_id"):
                                ac = dict(a)
                                ac["bins"] = [
                                    b for b in st_bins if b.get("area_id") == ac.get("area_id")
                                ]
                                fl_areas.append(ac)
                        fc["disposal_areas"] = fl_areas
                        st_floors.append(fc)
                rc["floors"] = st_floors
                out.append(rc)
            return SimpleNamespace(data=out)
        return SimpleNamespace(data=data or [])


class _FakeRpcCall:
    def __init__(self, fn_name, params, store):
        self._fn_name = fn_name
        self._params = params
        self._store = store

    def execute(self):
        if self._fn_name == "ingest_waste_drop_event":
            if "drop_events" in self._store.get("fail_on_insert", ()):
                raise RuntimeError("Simulated insert failure on drop_events")
            row = {
                "event_id": f"evt-{len(self._store.setdefault('drop_events', [])) + 1}",
                "actual_bin_id": self._params["p_actual_bin_id"],
                "classified_category_id": self._params.get("p_classified_category_id"),
                "trigger_sensor_id": None,
                "classification_confidence": self._params.get("p_confidence", 0.0),
                "classified_at": self._params.get("p_classified_at") or "2026-11-21T00:00:00+00:00",
                "verified_at": self._params.get("p_verified_at") or "2026-11-21T00:00:00+00:00",
            }
            self._store["drop_events"].append(row)
            return SimpleNamespace(data=[dict(row)])
        if self._fn_name != "admin_simulate_bin_telemetry":
            raise RuntimeError(f"Unknown RPC: {self._fn_name}")
        profile = self._store.get("profiles") or {}
        if not profile.get("is_active") or profile.get("role") != "ADMIN":
            raise RuntimeError("42501 Admin privileges required")

        bin_id = self._params["p_bin_id"]
        op_status = self._params.get("p_operational_status") or "NORMAL"
        fill_pct = self._params.get("p_fill_percentage")
        measured_at = self._params.get("p_measured_at") or "2026-11-20T14:00:00+00:00"

        target_bin = next((b for b in self._store.get("bins", []) if b.get("bin_id") == bin_id), None)
        if not target_bin:
            raise RuntimeError(f"P0002 Bin {bin_id} not found")
        if not target_bin.get("is_active", True):
            raise RuntimeError(f"23514 Cannot simulate telemetry for inactive bin {bin_id}")

        if any(s.get("bin_id") == bin_id and s.get("is_active", True) for s in self._store.get("sensors", [])):
            raise RuntimeError(f"23514 Cannot simulate telemetry for bin {bin_id} because it has an active physical sensor")

        bin_statuses = self._store.setdefault("bin_status", [])
        existing = next((s for s in bin_statuses if s.get("bin_id") == bin_id), None)
        if existing and existing.get("reading_source") == "HARDWARE":
            raise RuntimeError(f"23514 Cannot overwrite existing HARDWARE telemetry for bin {bin_id}")

        if op_status == "NORMAL":
            target_fill = round(float(fill_pct), 2)
        else:
            target_fill = existing.get("fill_percentage") if existing else None

        row = {
            "bin_id": bin_id,
            "fill_percentage": target_fill,
            "operational_status": op_status,
            "measured_at": measured_at,
            "updated_at": "2026-11-20T14:00:00+00:00",
            "reading_source": "SIMULATED",
        }
        if existing:
            existing.update(row)
        else:
            bin_statuses.append(row)
        return SimpleNamespace(data=[dict(row)])


class _MutableFakeSupabase:
    def __init__(self, store):
        self.store = store
        self.auth = _FakeAuth()

    def table(self, name):
        return _MutableFakeQuery(name, self.store)

    def rpc(self, fn_name, params):
        return _FakeRpcCall(fn_name, params, self.store)


class TestAdminStationManagement:
    """Tests for ADMIN-only station + bins creation, editing, and rollback."""

    def _make_store(self, role="ADMIN"):
        return {
            "profiles": {"user_id": "staff-uuid-1", "role": role, "is_active": True},
            "waste_categories": [
                {"category_id": "cat-pl", "category_name": "Plastic", "is_active": True},
                {"category_id": "cat-pa", "category_name": "Paper", "is_active": True},
            ],
            "locations": [],
            "stations": [],
            "floors": [],
            "disposal_areas": [],
            "bins": [],
            "ops": [],
        }

    def test_unauthenticated_and_janitor_rejected(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_store(role="JANITOR")
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)

        payload = {
            "station_code": "ST-010",
            "station_name": "Science 1F",
            "location_name": "Science Hall",
            "latitude": 24.7956,
            "longitude": 120.9923,
            "bins": [{"category_id": "cat-pl", "capacity_liters": 50}],
        }

        assert client.get("/api/admin/stations").status_code == 401
        assert client.post("/api/admin/stations", json=payload).status_code == 401

        hdr = {"Authorization": "Bearer valid-jwt"}
        assert client.get("/api/admin/stations", headers=hdr).status_code == 403
        assert client.post("/api/admin/stations", json=payload, headers=hdr).status_code == 403
        assert client.patch(
            "/api/admin/stations/ST-010",
            json={"station_name": "X", "location_name": "Y"},
            headers=hdr,
        ).status_code == 403

    def test_admin_create_station_with_multiple_bins(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_store(role="ADMIN")
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)

        res = client.post(
            "/api/admin/stations",
            headers={"Authorization": "Bearer valid-jwt"},
            json={
                "station_code": "ST-100",
                "station_name": "Delta 1F",
                "location_name": "Delta Building",
                "description": "Main lobby",
                "latitude": 24.7956,
                "longitude": 120.9923,
                "is_active": True,
                "bins": [
                    {"category_id": "cat-pl", "capacity_liters": 50, "is_active": True},
                    {"category_id": "cat-pa", "capacity_liters": 60, "is_active": True},
                ],
            },
        )
        assert res.status_code == 201
        st = res.json()["station"]
        assert st["station_code"] == "ST-100"
        assert st["latitude"] == 24.7956
        assert len(st["bins"]) == 2
        assert st["bins"][0]["fill_percentage"] is None

    def test_invalid_station_or_bin_rejected(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_store(role="ADMIN")
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)
        hdr = {"Authorization": "Bearer valid-jwt"}

        # Missing longitude when latitude provided -> 422
        r1 = client.post(
            "/api/admin/stations",
            headers=hdr,
            json={
                "station_code": "ST-101",
                "station_name": "Delta",
                "location_name": "Delta",
                "latitude": 24.7956,
                "bins": [{"category_id": "cat-pl", "capacity_liters": 50}],
            },
        )
        assert r1.status_code == 422

        # Empty bins -> 422
        r2 = client.post(
            "/api/admin/stations",
            headers=hdr,
            json={
                "station_code": "ST-102",
                "station_name": "Delta",
                "location_name": "Delta",
                "bins": [],
            },
        )
        assert r2.status_code == 422

        # Invalid category_id -> 400
        r3 = client.post(
            "/api/admin/stations",
            headers=hdr,
            json={
                "station_code": "ST-103",
                "station_name": "Delta",
                "location_name": "Delta",
                "bins": [{"category_id": "invalid-cat", "capacity_liters": 50}],
            },
        )
        assert r3.status_code == 400

    def test_failed_bin_creation_rolls_back_station_and_location(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_store(role="ADMIN")
        store["fail_on_insert"] = ("bins",)
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)

        res = client.post(
            "/api/admin/stations",
            headers={"Authorization": "Bearer valid-jwt"},
            json={
                "station_code": "ST-ROLLBACK",
                "station_name": "Rollback Test",
                "location_name": "Test Loc",
                "bins": [{"category_id": "cat-pl", "capacity_liters": 50}],
            },
        )
        assert res.status_code == 503
        assert store["stations"] == []
        assert store["locations"] == []

    def test_admin_edit_station_and_bins_preserves_id_and_handles_fk_delete(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_store(role="ADMIN")
        store["locations"].append(
            {"location_id": "loc-1", "location_name": "Old Bldg", "description": None, "latitude": None, "longitude": None, "is_active": True}
        )
        store["stations"].append(
            {"station_id": "st-1", "location_id": "loc-1", "station_code": "ST-EDIT", "station_name": "Old Name", "is_active": True}
        )
        store["bins"].append(
            {"bin_id": "bin-1", "station_id": "st-1", "category_id": "cat-pl", "capacity_liters": 50.0, "is_active": True}
        )
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)
        hdr = {"Authorization": "Bearer valid-jwt"}

        res = client.patch(
            "/api/admin/stations/ST-EDIT",
            headers=hdr,
            json={
                "station_name": "New Name",
                "location_name": "New Bldg",
                "description": "Updated floor",
                "latitude": 24.7962,
                "longitude": 120.9931,
                "is_active": True,
                "bins": [
                    {"bin_id": "bin-1", "category_id": "cat-pl", "capacity_liters": 75, "is_active": True},
                    {"bin_id": None, "category_id": "cat-pa", "capacity_liters": 60, "is_active": True},
                ],
            },
        )
        assert res.status_code == 200
        updated = res.json()["station"]
        assert updated["station_uuid"] == "st-1"
        assert updated["station_name"] == "New Name"
        assert updated["latitude"] == 24.7962
        assert len(updated["bins"]) == 2

        # FK conflict on bin delete returns 409
        store["fk_fail_on_delete"] = ("bins",)
        res_fk = client.patch(
            "/api/admin/stations/ST-EDIT",
            headers=hdr,
            json={
                "station_name": "New Name",
                "location_name": "New Bldg",
                "delete_bin_ids": ["bin-1"],
            },
        )
        assert res_fk.status_code == 409

    def test_admin_create_station_with_nested_hierarchy(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_store(role="ADMIN")
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)

        res = client.post(
            "/api/admin/stations",
            headers={"Authorization": "Bearer valid-jwt"},
            json={
                "station_code": "ST-HIER-1",
                "station_name": "Delta Building",
                "location_name": "NTHU Campus",
                "description": "Engineering wing",
                "latitude": 24.7961,
                "longitude": 120.9967,
                "is_active": True,
                "floors": [
                    {
                        "floor_name": "1F",
                        "floor_order": 1,
                        "is_active": True,
                        "disposal_areas": [
                            {
                                "area_name": "Main Entrance",
                                "description": "Near north doors",
                                "is_active": True,
                                "bins": [
                                    {"category_id": "cat-pl", "capacity_liters": 60, "is_active": True},
                                    {"category_id": "cat-pa", "capacity_liters": 60, "is_active": True},
                                ],
                            },
                            {
                                "area_name": "Cafeteria",
                                "is_active": True,
                                "bins": [
                                    {"category_id": "cat-pl", "capacity_liters": 80, "is_active": True},
                                ],
                            },
                        ],
                    },
                    {
                        "floor_name": "2F",
                        "floor_order": 2,
                        "is_active": True,
                        "disposal_areas": [
                            {
                                "area_name": "Study Lounge",
                                "is_active": True,
                                "bins": [
                                    {"category_id": "cat-pa", "capacity_liters": 50, "is_active": True},
                                ],
                            }
                        ],
                    },
                ],
            },
        )
        assert res.status_code == 201
        st = res.json()["station"]
        assert st["station_code"] == "ST-HIER-1"
        assert len(st["floors"]) == 2
        assert st["floors"][0]["floor_name"] == "1F"
        assert len(st["floors"][0]["disposal_areas"]) == 2
        assert len(st["floors"][0]["disposal_areas"][0]["bins"]) == 2
        assert len(st["floors"][0]["disposal_areas"][1]["bins"]) == 1
        assert len(st["floors"][1]["disposal_areas"][0]["bins"]) == 1
        assert len(st["bins"]) == 4
        for b in store["bins"]:
            assert b["station_id"] == st["station_uuid"]
            assert b["area_id"] is not None

    def test_admin_edit_hierarchy_move_bin_and_soft_deactivate(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_store(role="ADMIN")
        store["locations"].append(
            {"location_id": "loc-1", "location_name": "Delta", "description": None, "latitude": 24.79, "longitude": 120.99, "is_active": True}
        )
        store["stations"].append(
            {"station_id": "st-1", "location_id": "loc-1", "station_code": "ST-MOVE", "station_name": "Delta", "is_active": True}
        )
        store["floors"].append(
            {"floor_id": "fl-1", "station_id": "st-1", "floor_name": "1F", "floor_order": 1, "is_active": True}
        )
        store["disposal_areas"].extend([
            {"area_id": "ar-1", "floor_id": "fl-1", "area_name": "Area A", "description": None, "is_active": True},
            {"area_id": "ar-2", "floor_id": "fl-1", "area_name": "Area B", "description": None, "is_active": True},
        ])
        store["bins"].append(
            {"bin_id": "bin-1", "station_id": "st-1", "area_id": "ar-1", "category_id": "cat-pl", "capacity_liters": 60.0, "is_active": True}
        )
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)

        res = client.patch(
            "/api/admin/stations/ST-MOVE",
            headers={"Authorization": "Bearer valid-jwt"},
            json={
                "station_name": "Delta Building",
                "location_name": "Delta",
                "floors": [
                    {
                        "floor_id": "fl-1",
                        "floor_name": "1F - Ground",
                        "floor_order": 1,
                        "is_active": True,
                        "disposal_areas": [
                            {
                                "area_id": "ar-1",
                                "area_name": "Area A",
                                "is_active": False,
                                "bins": [],
                            },
                            {
                                "area_id": "ar-2",
                                "area_name": "Area B",
                                "is_active": True,
                                "bins": [
                                    {
                                        "bin_id": "bin-1",
                                        "category_id": "cat-pa",
                                        "capacity_liters": 80,
                                        "is_active": True,
                                    }
                                ],
                            },
                        ],
                    }
                ],
            },
        )
        assert res.status_code == 200
        st = res.json()["station"]
        assert st["floors"][0]["floor_name"] == "1F - Ground"
        assert st["floors"][0]["disposal_areas"][0]["is_active"] is False
        assert len(st["floors"][0]["disposal_areas"][0]["bins"]) == 0
        moved = st["floors"][0]["disposal_areas"][1]["bins"][0]
        assert moved["bin_id"] == "bin-1"
        assert moved["area_id"] == "ar-2"
        assert moved["category_id"] == "cat-pa"
        assert store["bins"][0]["area_id"] == "ar-2"

    def test_failed_area_creation_rolls_back_hierarchy(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_store(role="ADMIN")
        store["fail_on_insert"] = ("disposal_areas",)
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)

        res = client.post(
            "/api/admin/stations",
            headers={"Authorization": "Bearer valid-jwt"},
            json={
                "station_code": "ST-RB-HIER",
                "station_name": "Rollback",
                "location_name": "Loc",
                "floors": [
                    {
                        "floor_name": "1F",
                        "floor_order": 1,
                        "disposal_areas": [
                            {"area_name": "Main", "bins": [{"category_id": "cat-pl", "capacity_liters": 50}]}
                        ],
                    }
                ],
            },
        )
        assert res.status_code == 503
        assert store["floors"] == []
        assert store["stations"] == []
        assert store["locations"] == []

    def test_live_status_returns_nested_hierarchy(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_store(role="ADMIN")
        store["locations"].append(
            {"location_id": "loc-1", "location_name": "Delta", "description": "North", "latitude": 24.79, "longitude": 120.99, "is_active": True}
        )
        store["stations"].append(
            {"station_id": "st-1", "location_id": "loc-1", "station_code": "ST-LIVE", "station_name": "Delta Station", "is_active": True}
        )
        store["floors"].append(
            {"floor_id": "fl-1", "station_id": "st-1", "floor_name": "1F", "floor_order": 1, "is_active": True}
        )
        store["disposal_areas"].append(
            {"area_id": "ar-1", "floor_id": "fl-1", "area_name": "Main Entrance", "description": None, "is_active": True}
        )
        store["bins"].append(
            {"bin_id": "bin-1", "station_id": "st-1", "area_id": "ar-1", "category_id": "cat-pl", "capacity_liters": 60.0, "is_active": True}
        )
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)

        res = client.get("/api/dashboard/live-status")
        assert res.status_code == 200
        stations = res.json()["stations"]
        assert len(stations) == 1
        st = stations[0]
        assert st["station_id"] == "ST-LIVE"
        assert st["location_name"] == "Delta"
        assert len(st["floors"]) == 1
        assert st["floors"][0]["floor_name"] == "1F"
        assert st["floors"][0]["disposal_areas"][0]["area_name"] == "Main Entrance"
        assert len(st["floors"][0]["disposal_areas"][0]["bins"]) == 1
        assert st["floors"][0]["disposal_areas"][0]["bins"][0]["category_name"] == "Plastic"


class TestAdminBinTelemetrySimulation:
    """Phase 1 tests for ADMIN-only individual-bin telemetry simulation."""

    def _make_nthu_shuimu_store(self, role="ADMIN"):
        return {
            "profiles": {"user_id": "staff-uuid-1", "role": role, "is_active": True},
            "waste_categories": [
                {"category_id": "cat-pl", "category_name": "Plastic", "is_active": True},
                {"category_id": "cat-pa", "category_name": "Paper", "is_active": True},
                {"category_id": "cat-me", "category_name": "Metal", "is_active": True},
                {"category_id": "cat-ge", "category_name": "General Waste", "is_active": True},
            ],
            "locations": [
                {
                    "location_id": "loc-sh",
                    "location_name": "Shuimu",
                    "description": None,
                    "latitude": 24.7945,
                    "longitude": 120.9932,
                    "is_active": True,
                }
            ],
            "stations": [
                {
                    "station_id": "st-sh",
                    "location_id": "loc-sh",
                    "station_code": "NTHU-SHUIMU",
                    "station_name": "NTHU Shuimu",
                    "is_active": True,
                }
            ],
            "floors": [
                {"floor_id": "fl-sh", "station_id": "st-sh", "floor_name": "Unassigned Floor", "floor_order": 0, "is_active": True}
            ],
            "disposal_areas": [
                {"area_id": "ar-sh", "floor_id": "fl-sh", "area_name": "Unassigned Area", "description": None, "is_active": True}
            ],
            "bins": [
                {"bin_id": "c01645cf-6eab-4dc5-9a79-4a9b9405f37f", "station_id": "st-sh", "area_id": "ar-sh", "category_id": "cat-pl", "capacity_liters": 60.0, "is_active": True},
                {"bin_id": "bda84bad-82cf-4bb8-b8a5-d1c09e984536", "station_id": "st-sh", "area_id": "ar-sh", "category_id": "cat-pa", "capacity_liters": 60.0, "is_active": True},
                {"bin_id": "694f269a-f7f7-4a82-b19b-c7b3d42a81d4", "station_id": "st-sh", "area_id": "ar-sh", "category_id": "cat-me", "capacity_liters": 60.0, "is_active": True},
                {"bin_id": "6f7644f3-9597-43c7-a45a-ecefd0953374", "station_id": "st-sh", "area_id": "ar-sh", "category_id": "cat-ge", "capacity_liters": 60.0, "is_active": True},
            ],
            "sensors": [],
            "sensor_readings": [],
            "bin_status": [],
            "ops": [],
        }

    def test_unauthenticated_and_janitor_cannot_simulate(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_nthu_shuimu_store(role="JANITOR")
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)

        payload = {"readings": [{"bin_id": "c01645cf-6eab-4dc5-9a79-4a9b9405f37f", "fill_percentage": 85.0}]}
        assert client.post("/api/admin/telemetry/simulate", json=payload).status_code == 401
        assert client.post(
            "/api/admin/telemetry/simulate",
            headers={"Authorization": "Bearer valid-jwt"},
            json=payload,
        ).status_code == 403

    def test_admin_simulates_four_nthu_shuimu_bins_independently(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_nthu_shuimu_store(role="ADMIN")
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)

        res = client.post(
            "/api/admin/telemetry/simulate",
            headers={"Authorization": "Bearer valid-jwt"},
            json={
                "readings": [
                    {"bin_id": "c01645cf-6eab-4dc5-9a79-4a9b9405f37f", "fill_percentage": 85.0, "operational_status": "NORMAL"},
                    {"bin_id": "bda84bad-82cf-4bb8-b8a5-d1c09e984536", "fill_percentage": 40.0, "operational_status": "NORMAL"},
                    {"bin_id": "694f269a-f7f7-4a82-b19b-c7b3d42a81d4", "fill_percentage": 15.0, "operational_status": "NORMAL"},
                    {"bin_id": "6f7644f3-9597-43c7-a45a-ecefd0953374", "operational_status": "SENSOR_ERROR"},
                ]
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["processed"] == 4
        assert store["sensor_readings"] == []
        assert all(r["reading_source"] == "SIMULATED" for r in body["results"])
        assert body["results"][3]["operational_status"] == "SENSOR_ERROR"
        assert body["results"][3]["fill_percentage"] is None

        live = client.get("/api/dashboard/live-status")
        assert live.status_code == 200
        st = live.json()["stations"][0]
        assert st["has_sensor_error"] is True
        assert st["sensor_error_categories"] == ["general"]
        bins = st["floors"][0]["disposal_areas"][0]["bins"]
        by_id = {b["bin_id"]: b for b in bins}
        assert by_id["c01645cf-6eab-4dc5-9a79-4a9b9405f37f"]["fill_percentage"] == 85.0
        assert by_id["bda84bad-82cf-4bb8-b8a5-d1c09e984536"]["fill_percentage"] == 40.0
        assert by_id["694f269a-f7f7-4a82-b19b-c7b3d42a81d4"]["fill_percentage"] == 15.0
        assert by_id["6f7644f3-9597-43c7-a45a-ecefd0953374"]["fill_percentage"] is None
        assert by_id["6f7644f3-9597-43c7-a45a-ecefd0953374"]["operational_status"] == "SENSOR_ERROR"
        assert all(b["reading_source"] == "SIMULATED" for b in bins)

    def test_simulation_rejects_active_physical_sensor_and_hardware_telemetry(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = self._make_nthu_shuimu_store(role="ADMIN")
        store["sensors"].append({"sensor_id": "sen-1", "bin_id": "c01645cf-6eab-4dc5-9a79-4a9b9405f37f", "is_active": True})
        store["bin_status"].append({
            "bin_id": "bda84bad-82cf-4bb8-b8a5-d1c09e984536",
            "fill_percentage": 55.0,
            "operational_status": "NORMAL",
            "reading_source": "HARDWARE",
        })
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)
        hdr = {"Authorization": "Bearer valid-jwt"}

        r1 = client.post(
            "/api/admin/telemetry/simulate",
            headers=hdr,
            json={"readings": [{"bin_id": "c01645cf-6eab-4dc5-9a79-4a9b9405f37f", "fill_percentage": 50.0}]},
        )
        assert r1.status_code == 409

        r2 = client.post(
            "/api/admin/telemetry/simulate",
            headers=hdr,
            json={"readings": [{"bin_id": "bda84bad-82cf-4bb8-b8a5-d1c09e984536", "fill_percentage": 50.0}]},
        )
        assert r2.status_code == 409


class TestHardwareWasteDropIntegration:
    """Tests for AI_Backend -> Cloud FastAPI POST /api/events/log-waste integration."""

    def _make_store(self):
        return {
            "profiles": {"user_id": "staff-uuid-1", "role": "ADMIN", "is_active": True},
            "waste_categories": [
                {"category_id": "cat-pl", "category_name": "Plastic", "is_active": True},
                {"category_id": "cat-pa", "category_name": "Paper", "is_active": True},
                {"category_id": "cat-me", "category_name": "Metal", "is_active": True},
                {"category_id": "cat-ge", "category_name": "General Waste", "is_active": True},
            ],
            "locations": [
                {"location_id": "loc-1", "location_name": "NTHU", "is_active": True}
            ],
            "stations": [
                {"station_id": "st-sh", "location_id": "loc-1", "station_code": "NTHU-SHUIMU", "station_name": "Shuimu", "is_active": True}
            ],
            "floors": [
                {"floor_id": "fl-1", "station_id": "st-sh", "floor_name": "1F", "floor_order": 1, "is_active": True}
            ],
            "disposal_areas": [
                {"area_id": "ar-1", "floor_id": "fl-1", "area_name": "Main", "is_active": True}
            ],
            "bins": [
                {"bin_id": "bin-pl-1", "station_id": "st-sh", "area_id": "ar-1", "category_id": "cat-pl", "capacity_liters": 60.0, "is_active": True},
                {"bin_id": "bin-ge-1", "station_id": "st-sh", "area_id": "ar-1", "category_id": "cat-ge", "capacity_liters": 60.0, "is_active": True},
            ],
            "drop_events": [],
            "ops": [],
        }

    def test_device_auth_required_in_live_mode(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        monkeypatch.setenv("SORTSENSE_DEVICE_API_KEY", "secret-device-key")
        db._recent_drop_fingerprints.clear()
        fake = _MutableFakeSupabase(self._make_store())
        monkeypatch.setattr(db, "client", fake)

        payload = {
            "station_id": "NTHU-SHUIMU",
            "waste_category": "plastic",
            "dropped_in_bin": "plastic",
            "confidence": 0.91,
            "is_correct_sort": True,
        }
        assert client.post("/api/events/log-waste", json=payload).status_code == 401
        assert client.post(
            "/api/events/log-waste",
            headers={"X-Device-Key": "wrong-key"},
            json=payload,
        ).status_code == 401

        monkeypatch.delenv("SORTSENSE_DEVICE_API_KEY", raising=False)
        monkeypatch.delenv("TELEMETRY_INGEST_KEY", raising=False)
        assert client.post("/api/events/log-waste", json=payload).status_code == 503

    def test_valid_hardware_event_correct_incorrect_and_duplicate(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        monkeypatch.setenv("SORTSENSE_DEVICE_API_KEY", "secret-device-key")
        monkeypatch.setenv("STATION_CODE_MAP", '{"ST-001": "NTHU-SHUIMU"}')
        db._recent_drop_fingerprints.clear()
        store = self._make_store()
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        hdr = {"X-Device-Key": "secret-device-key"}

        # 1. Correct sort via ST-001 -> NTHU-SHUIMU mapping & category normalization
        r1 = client.post(
            "/api/events/log-waste",
            headers=hdr,
            json={
                "station_id": "ST-001",
                "waste_category": "PLASTIC",
                "dropped_in_bin": "Plastic",
                "confidence": 0.91,
                "is_correct_sort": True,
            },
        )
        assert r1.status_code == 201
        ev1 = r1.json()["event"]
        assert ev1["station_id"] == "NTHU-SHUIMU"
        assert ev1["actual_bin_id"] == "bin-pl-1"
        assert ev1["classified_category_id"] == "cat-pl"
        assert len(store["drop_events"]) == 1

        # 2. Duplicate retry ignored without inserting a second row
        r_dup = client.post(
            "/api/events/log-waste",
            headers=hdr,
            json={
                "station_id": "ST-001",
                "waste_category": "PLASTIC",
                "dropped_in_bin": "Plastic",
                "confidence": 0.91,
                "is_correct_sort": True,
            },
        )
        assert r_dup.status_code == 201
        assert r_dup.json()["status"] == "duplicate_ignored"
        assert len(store["drop_events"]) == 1

        # 3. Incorrect sort with 'none' cached prediction from AI_Backend
        r2 = client.post(
            "/api/events/log-waste",
            headers=hdr,
            json={
                "station_id": "NTHU-SHUIMU",
                "waste_category": "none",
                "dropped_in_bin": "general",
                "confidence": 0.0,
                "is_correct_sort": False,
            },
        )
        assert r2.status_code == 201
        ev2 = r2.json()["event"]
        assert ev2["actual_bin_id"] == "bin-ge-1"
        assert ev2["classified_category_id"] is None
        assert len(store["drop_events"]) == 2

    def test_unknown_station_missing_bin_and_db_failure(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        monkeypatch.setenv("SORTSENSE_DEVICE_API_KEY", "secret-device-key")
        db._recent_drop_fingerprints.clear()
        store = self._make_store()
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        hdr = {"X-Device-Key": "secret-device-key"}

        # Unknown station -> 404
        r_st = client.post(
            "/api/events/log-waste",
            headers=hdr,
            json={
                "station_id": "UNKNOWN-ST",
                "waste_category": "plastic",
                "dropped_in_bin": "plastic",
                "confidence": 0.9,
                "is_correct_sort": True,
            },
        )
        assert r_st.status_code == 404

        # Missing active bin for category (paper not configured in store) -> 404
        r_bin = client.post(
            "/api/events/log-waste",
            headers=hdr,
            json={
                "station_id": "NTHU-SHUIMU",
                "waste_category": "paper",
                "dropped_in_bin": "paper",
                "confidence": 0.85,
                "is_correct_sort": True,
            },
        )
        assert r_bin.status_code == 404

        # DB failure on drop_events insert -> 503
        store["fail_on_insert"] = ("drop_events",)
        r_db = client.post(
            "/api/events/log-waste",
            headers=hdr,
            json={
                "station_id": "NTHU-SHUIMU",
                "waste_category": "plastic",
                "dropped_in_bin": "plastic",
                "confidence": 0.77,
                "is_correct_sort": True,
            },
        )
        assert r_db.status_code == 503
