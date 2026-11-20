"""
Comprehensive API Endpoint & Integration Test Suite for SortSense Cloud FastAPI.
Covers /api/* health, waste drop ingestion, device auth, station/bin mapping,
duplicate suppression, simulation vs hardware precedence, and bin emptying.
"""

from types import SimpleNamespace
from fastapi.testclient import TestClient
import pytest

from api.index import app
from api.db import db
from tests.test_api import _MutableFakeSupabase


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_db_mode(monkeypatch):
    """Ensure every test starts in isolated fixture mode unless overridden."""
    monkeypatch.setattr(db, "use_fixtures", True)
    monkeypatch.delenv("DEVICE_API_KEY", raising=False)
    monkeypatch.delenv("SORTSENSE_DEVICE_API_KEY", raising=False)
    monkeypatch.delenv("TELEMETRY_INGEST_KEY", raising=False)
    monkeypatch.delenv("STATION_CODE_MAP", raising=False)
    monkeypatch.delenv("BIN_MAPPING_JSON", raising=False)
    db._recent_drop_fingerprints.clear()


def _make_multi_bin_store():
    return {
        "profiles": {"user_id": "admin-1", "role": "ADMIN", "is_active": True},
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
            {
                "station_id": "st-1",
                "location_id": "loc-1",
                "station_code": "NTHU-SHUIMU",
                "station_name": "Shuimu Center",
                "is_active": True,
            }
        ],
        "floors": [
            {"floor_id": "fl-1", "station_id": "st-1", "floor_name": "1F", "floor_order": 1, "is_active": True}
        ],
        "disposal_areas": [
            {"area_id": "ar-1", "floor_id": "fl-1", "area_name": "North", "is_active": True},
            {"area_id": "ar-2", "floor_id": "fl-1", "area_name": "South", "is_active": True},
        ],
        "bins": [
            {"bin_id": "bin-pl-north", "station_id": "st-1", "area_id": "ar-1", "category_id": "cat-pl", "capacity_liters": 60.0, "is_active": True},
            {"bin_id": "bin-pl-south", "station_id": "st-1", "area_id": "ar-2", "category_id": "cat-pl", "capacity_liters": 60.0, "is_active": True},
            {"bin_id": "bin-pa-north", "station_id": "st-1", "area_id": "ar-1", "category_id": "cat-pa", "capacity_liters": 60.0, "is_active": True},
        ],
        "sensors": [],
        "sensor_readings": [],
        "bin_status": [],
        "drop_events": [],
        "ops": [],
    }


class TestEndpointDiscoveryAndCategories:
    """Verify core API health and waste-categories endpoints."""

    def test_health_and_root_routes(self):
        for path in ("/", "/api", "/api/", "/health", "/api/health"):
            res = client.get(path)
            assert res.status_code == 200

    def test_waste_categories_fixture_fallback(self):
        res = client.get("/api/waste-categories")
        assert res.status_code == 200
        cats = res.json()["categories"]
        assert len(cats) == 4
        names = {c["category_name"] for c in cats}
        assert {"Plastic", "Paper", "Metal", "General Waste"} <= names


class TestDropEventMappingAndSecurity:
    """Verify X-Device-Key, Bearer device auth, multi-bin disambiguation, and dedup."""

    def test_bearer_device_auth_and_station_mapping(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        monkeypatch.setenv("SORTSENSE_DEVICE_API_KEY", "dev-secret-123")
        monkeypatch.setenv("STATION_CODE_MAP", '{"ST-001": "NTHU-SHUIMU"}')

        store = _make_multi_bin_store()
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)

        res = client.post(
            "/api/events/log-waste",
            headers={"Authorization": "Bearer dev-secret-123"},
            json={
                "station_id": "ST-001",
                "waste_category": "paper",
                "dropped_in_bin": "paper",
                "confidence": 0.88,
                "is_correct_sort": True,
                "idempotency_key": "evt-unique-1",
            },
        )
        assert res.status_code == 201
        assert res.json()["status"] == "created"
        assert res.json()["event"]["actual_bin_id"] == "bin-pa-north"

        # Same idempotency_key suppressed even if confidence differs slightly
        res_dup = client.post(
            "/api/events/log-waste",
            headers={"Authorization": "Bearer dev-secret-123"},
            json={
                "station_id": "ST-001",
                "waste_category": "paper",
                "dropped_in_bin": "paper",
                "confidence": 0.89,
                "is_correct_sort": True,
                "idempotency_key": "evt-unique-1",
            },
        )
        assert res_dup.status_code == 201
        assert res_dup.json()["status"] == "duplicate_ignored"
        assert len(store["drop_events"]) == 1

    def test_ambiguous_multi_bin_requires_explicit_mapping(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        monkeypatch.setenv("SORTSENSE_DEVICE_API_KEY", "dev-secret-123")
        store = _make_multi_bin_store()
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        hdr = {"X-Device-Key": "dev-secret-123"}

        # Two active plastic bins in NTHU-SHUIMU without BIN_MAPPING_JSON -> 409 Conflict
        res_conflict = client.post(
            "/api/events/log-waste",
            headers=hdr,
            json={
                "station_id": "NTHU-SHUIMU",
                "waste_category": "plastic",
                "dropped_in_bin": "plastic",
                "confidence": 0.92,
                "is_correct_sort": True,
            },
        )
        assert res_conflict.status_code == 409

        # With BIN_MAPPING_JSON -> disambiguates cleanly to bin-pl-south
        db._recent_drop_fingerprints.clear()
        monkeypatch.setenv("BIN_MAPPING_JSON", '{"NTHU-SHUIMU:plastic": "bin-pl-south"}')
        res_ok = client.post(
            "/api/events/log-waste",
            headers=hdr,
            json={
                "station_id": "NTHU-SHUIMU",
                "waste_category": "plastic",
                "dropped_in_bin": "plastic",
                "confidence": 0.92,
                "is_correct_sort": True,
            },
        )
        assert res_ok.status_code == 201
        assert res_ok.json()["event"]["actual_bin_id"] == "bin-pl-south"


class TestSimulationErrorPreservationAndEmptying:
    """Verify SENSOR_ERROR preserves prior fill and /api/bins/empty resets work."""

    def test_sensor_error_preserves_prior_fill_and_returns_null(self, monkeypatch):
        monkeypatch.setattr(db, "use_fixtures", False)
        store = _make_multi_bin_store()
        store["bin_status"].append({
            "bin_id": "bin-pa-north",
            "fill_percentage": 64.0,
            "operational_status": "NORMAL",
            "reading_source": "SIMULATED",
        })
        fake = _MutableFakeSupabase(store)
        monkeypatch.setattr(db, "client", fake)
        monkeypatch.setattr(db, "_create_user_client", lambda _t: fake)

        res = client.post(
            "/api/admin/telemetry/simulate",
            headers={"Authorization": "Bearer valid-jwt"},
            json={"readings": [{"bin_id": "bin-pa-north", "operational_status": "SENSOR_ERROR"}]},
        )
        assert res.status_code == 200
        assert res.json()["results"][0]["operational_status"] == "SENSOR_ERROR"
        assert res.json()["results"][0]["fill_percentage"] is None
        # Underlying DB row preserved prior valid fill (64.0), never overwritten with 0%
        assert store["bin_status"][0]["fill_percentage"] == 64.0

    def test_bins_empty_single_all_and_missing_station(self):
        # Set non-zero fills on ST-001
        client.post(
            "/api/telemetry/fill-levels",
            json={
                "station_id": "ST-001",
                "fill_levels": {"plastic": 70.0, "paper": 50.0, "metal": 30.0, "general": 80.0},
            },
        )

        # Empty single compartment
        r1 = client.post("/api/bins/empty", json={"station_id": "ST-001", "compartment": "plastic"})
        assert r1.status_code == 200
        assert r1.json()["fill_levels"]["plastic"] == 0.0
        assert r1.json()["fill_levels"]["paper"] == 50.0

        # Empty all compartments
        r2 = client.post("/api/bins/empty", json={"station_id": "ST-001", "compartment": "all"})
        assert r2.status_code == 200
        assert all(v == 0.0 for v in r2.json()["fill_levels"].values())

        # Non-existent station -> 404
        r3 = client.post("/api/bins/empty", json={"station_id": "NO-SUCH-STATION", "compartment": "all"})
        assert r3.status_code == 404
