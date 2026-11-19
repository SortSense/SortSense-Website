"""
Comprehensive Unit and Integration Tests for SortSense Cloud API.
Tests all endpoints, validations, business logic, color calculations, and error cases.
"""

import pytest
from fastapi.testclient import TestClient
from api.index import app
from api.models import compute_status_color

client = TestClient(app)


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
