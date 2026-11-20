# SortSense-Website — Complete System Explanation & Developer Guide

## 1. Executive Summary

**SortSense** is an IoT-enabled smart campus waste management and recycling analytics system designed for university campuses. This repository (`SortSense-Website`) serves as the central cloud hub connecting:

1. **Hardware Ingestion (ESP32-S3):** Ingests real-time Time-of-Flight (ToF) distance sensor telemetry measuring waste compartment fill levels.
2. **AI Inference Ingestion (Edge LLM/Vision Backend):** Ingests verified waste drop events, classification confidence scores, and sorting accuracy logs.
3. **Campus Monitoring Web Dashboard (Next.js + Tailwind):** Displays an interactive campus map with live station pins, 4-compartment fill level progress bars, manual janitor reset controls, QR GPS provisioning, and recycling analytics charts.

---

## 2. System Architecture & Constraints

```
 ┌──────────────────────┐         ┌───────────────────────┐
 │   Fabio's Hardware   │         │  Edric's AI Backend   │
 │   ESP32-S3 + ToF     │         │   Camera + LLM Vision │
 └──────────┬───────────┘         └───────────┬───────────┘
            │ POST /api/telemetry             │ POST /api/events/log-waste
            │                                 │
            ▼                                 ▼
 ┌────────────────────────────────────────────────────────┐
 │           Python FastAPI Backend (/api/)              │
 │  - Pydantic strict schemas & standard category enums   │
 │  - Supabase client integration + resilient fallback    │
 │  - Color threshold engine (<60 green, 60-84 yellow,    │
 │    >=85 red)                                           │
 └──────────┬─────────────────────────────────────────────┘
            │
            ├───────────────► Supabase (PostgreSQL)
            │                 - stations, locations, bins
            │                 - bin_status, drop_events
            ▼
 ┌────────────────────────────────────────────────────────┐
 │        Next.js + Tailwind Campus Web Dashboard         │
 │  - Periodic HTTP REST polling (every 5 seconds)        │
 │  - Interactive SVG Campus Map with beacon pins         │
 │  - 4-compartment fill bars (Plastic, Paper, Metal,     │
 │    General)                                            │
 │  - Recharts Daily Analytics (Breakdown & Stream Donut) │
 │  - Janitor empty bin resets & GPS provisioning modal   │
 └────────────────────────────────────────────────────────┘
```

### Key Technical Constraints

- **>50% Python Codebase:** All backend API routes are written in **Python (FastAPI)** inside Vercel's `/api/` directory. Next.js does not handle backend data ingestion.
- **No WebSockets on Vercel:** Vercel Serverless runs stateless HTTP requests. Real-time updates use periodic HTTP REST polling (`setInterval` every 5 seconds).
- **Strict Waste Category Enums:** Standardized strictly across all hardware and AI backends to:
  - `"plastic"`
  - `"paper"`
  - `"metal"`
  - `"general"`
- **Status Color Calculation:**
  - `< 60%` max compartment fill $\rightarrow$ `"green"` (Normal)
  - `60% – 84%` max compartment fill $\rightarrow$ `"yellow"` (Warning / Nearing Full)
  - `≥ 85%` max compartment fill $\rightarrow$ `"red"` (Critical / Needs Collection)

---

## 3. Cloud API Endpoints Reference

### 3.1 Telemetry Ingestion (ESP32-S3 Hardware)

- **Route:** `POST /api/telemetry/fill-levels`
- **Caller:** ESP32-S3 controller reading ToF distance sensors.
- **Request Body:**
  ```json
  {
    "station_id": "ST-001",
    "fill_levels": {
      "plastic": 45.0,
      "paper": 80.0,
      "metal": 20.0,
      "general": 95.0
    }
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": "success",
    "station_id": "ST-001",
    "updated_at": "2026-11-19T09:00:00Z",
    "fill_levels": {
      "plastic": 45.0,
      "paper": 80.0,
      "metal": 20.0,
      "general": 95.0
    }
  }
  ```
- **Behavior:** Updates station fill levels, sets `is_online = true`, refreshes `updated_at` timestamp. Automatically registers unknown station IDs.

---

### 3.2 Waste Drop Event Logging (AI/LLM Backend)

- **Route:** `POST /api/events/log-waste`
- **Caller:** AI Vision/Classification Backend when an object drop is verified by IR break-beam sensor.
- **Request Body:**
  ```json
  {
    "station_id": "ST-001",
    "waste_category": "plastic",
    "dropped_in_bin": "plastic",
    "confidence": 0.91,
    "is_correct_sort": true
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "status": "created",
    "message": "Waste drop event recorded successfully",
    "event": {
      "event_id": "4e7c7a2b-8a8b-4c5e-86d7-393e82d7037b",
      "station_id": "ST-001",
      "waste_category": "plastic",
      "dropped_in_bin": "plastic",
      "confidence": 0.91,
      "is_correct_sort": true,
      "timestamp": "2026-11-19T09:00:00Z"
    }
  }
  ```
- **Behavior:** Stores event record and immediately recalculates daily sorting accuracy and stream breakdown totals.

---

### 3.3 Campus Live Status Feeder

- **Route:** `GET /api/dashboard/live-status`
- **Caller:** Next.js Dashboard polling every 5s.
- **Response (200 OK):**
  ```json
  {
    "stations": [
      {
        "station_id": "ST-001",
        "name": "Delta Building 1F",
        "latitude": 24.7956,
        "longitude": 120.9923,
        "is_online": true,
        "max_fill_pct": 95.0,
        "status_color": "red",
        "fill_levels": {
          "plastic": 45.0,
          "paper": 80.0,
          "metal": 20.0,
          "general": 95.0
        },
        "updated_at": "2026-11-19T09:00:00Z"
      }
    ]
  }
  ```

---

### 3.4 Recycling Analytics Feeder

- **Route:** `GET /api/dashboard/analytics`
- **Response (200 OK):**
  ```json
  {
    "total_items_today": 142,
    "sorting_accuracy_pct": 88.5,
    "breakdown": {
      "plastic": 58,
      "paper": 41,
      "metal": 23,
      "general": 20
    }
  }
  ```

---

### 3.5 QR Station GPS Provisioning

- **Route:** `POST /api/bins/provision`
- **Request Body:**
  ```json
  {
    "station_id": "ST-001",
    "name": "Delta Building 1F",
    "latitude": 24.7956,
    "longitude": 120.9923
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": "provisioned",
    "station": { ... }
  }
  ```

---

### 3.6 Manual Janitor Reset / Empty Bin

- **Route:** `POST /api/bins/empty`
- **Request Body (Reset all):**
  ```json
  {
    "station_id": "ST-001",
    "compartment": "all"
  }
  ```
- **Request Body (Reset specific compartment):**
  ```json
  {
    "station_id": "ST-001",
    "compartment": "general"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": "emptied",
    "station_id": "ST-001",
    "compartment": "general",
    "fill_levels": {
      "plastic": 45.0,
      "paper": 80.0,
      "metal": 20.0,
      "general": 0.0
    },
    "updated_at": "2026-11-19T09:01:00Z"
  }
  ```

---

## 4. Frontend Views & Features

### 4.1 Campus Map View (`components/campus-map.tsx`)

- Custom campus map visualizing university buildings (Delta Building, Main Library, Engineering Hall, Student Center) and walkways.
- Interactive beacon pins placed at actual geographic coordinates.
- Live pulsing color halos:
  - Green: `< 60%`
  - Yellow: `60%–84%`
  - Red: `≥ 85%`
- Click a pin to instantly inspect that station in the Station Detail pane.
- Status filter chips: All, Normal, Warning, Critical.

### 4.2 Station Detail View (`components/station-detail.tsx`)

- Four dedicated progress bars for **Plastic**, **Paper**, **Metal**, and **General Waste**.
- Category color coding matching hardware LED indicators:
  - Plastic: Blue (`#3B82F6`)
  - Paper: Amber (`#F59E0B`)
  - Metal: Slate (`#94A3B8`)
  - General: Charcoal (`#475569`)
- Individual quick-action compartment reset buttons.
- Station-level **"Empty All Compartments"** janitor action button.
- QR GPS Onboarding modal for calibrating physical station coordinates.

### 4.3 Analytics View (`components/analytics-view.tsx`)

- Built with **Recharts**:
  - **Daily Category Breakdown Bar Chart:** Total items deposited per waste stream.
  - **Waste Stream Distribution Donut Chart:** Proportional volume breakdown.
- Key performance metric cards:
  - Total Items Sorted Today
  - Overall Sorting Accuracy %
  - Recyclables Diverted Count
  - General Waste Volume
- Live Verified Activity Stream table showing recent waste drops, AI confidence, and sort correctness.

---

## 5. How to Run Locally

### Prerequisites

- Python 3.11+
- Node.js 20+

### Option A: Local Development

1. **Install Python dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

2. **Start the FastAPI Backend:**

   ```bash
   uvicorn api.index:app --reload --port 8000
   ```

3. **Install Node dependencies and start Next.js:**
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser. Next.js automatically rewrites `/api/*` to `http://localhost:8000/api/*`.

---

### Option B: Docker & Docker Compose

To run the complete system (both Next.js frontend and Python FastAPI backend) inside isolated containers:

```bash
docker compose up --build
```

- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **FastAPI Docs & OpenAPI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **FastAPI Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

---

## 6. Running Tests

Run the complete Python test suite covering all 23 unit and integration scenarios:

```bash
pytest tests/ -v
```

Test coverage includes:

- Root and health endpoints
- Telemetry ingestion and auto-provisioning
- Waste drop event validation and confidence constraints
- Category enum integrity
- Dynamic color status rules (`<60` green, `60-84` yellow, `>=85` red)
- Analytics recalculation
- Station GPS provisioning
- Compartment-level and station-wide janitor emptying

---

## 7. CI/CD GitHub Actions Pipeline

The repository includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that executes on every push and pull request to `main`:

1. **`python-tests`:** Sets up Python 3.12, installs dependencies, and runs `pytest tests/ -v`.
2. **`frontend-build`:** Sets up Node.js 20, validates TypeScript types (`tsc --noEmit`), and builds the Next.js production bundle (`next build`).
3. **`docker-build`:** Validates that the multi-stage Dockerfile builds successfully.

---

## 6. Updated End-to-End Hardware, Hierarchy & Pitch Demo Architecture

### 6.1 End-to-End Data Flow

```text
ESP32-S3 (OV5640 + LM393 IR + ToF)
  ├── WS  /ws/vision?station_id=ST-001      ──▶ SortSense-AI_Backend
  ├── POST /internal/verify-drop            ──▶ SortSense-AI_Backend
  │                                               └── POST /api/events/log-waste (X-Device-Key)
  └── POST /api/telemetry/fill-levels             ──▶ Cloud FastAPI (/api/) ──▶ Supabase RPCs (RLS intact)
                                                                                  └── Next.js Dashboard & /stations/[id]
```

### 6.2 Station → Floors → Disposal Areas → Bins Hierarchy

- Stations contain ordered **Floors**, each floor contains **Disposal Areas**, and each area contains flexible numbers and categories of **Bins**.
- `bin_status.reading_source` distinguishes `LEGACY`, `SIMULATED`, and `HARDWARE` telemetry:
  - `POST /api/admin/telemetry/simulate` (ADMIN JWT required) updates `bin_status` as `SIMULATED` without writing to `sensor_readings` and never overwrites `HARDWARE` rows.
  - `SENSOR_ERROR` preserves the last valid `fill_percentage` (or `NULL`) and renders `N/A` in the UI instead of `0%`.

### 6.3 Required Environment Variables

- **Frontend & Backend**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **Backend Only (Never expose to client/ESP32)**: `SUPABASE_SERVICE_ROLE_KEY`
- **Optional Device Ingestion Auth**: `DEVICE_API_KEY` (when unset or empty, `POST /api/events/log-waste` and `POST /api/telemetry/fill-levels` allow unauthenticated hardware/AI backend ingestion; when set, `X-Device-Key` or `Authorization: Bearer <DEVICE_API_KEY>` is enforced)
- **Optional Station/Bin Disambiguation**: `STATION_CODE_MAP` (e.g. `{"ST-001":"NTHU-SHUIMU"}`), `BIN_MAPPING_JSON` (e.g. `{"NTHU-SHUIMU:plastic":"<bin_uuid>"}`)

### 6.4 Docker & Standalone Pitch Demo (`/demo/`)

- **Docker**: Run `docker compose up --build` to start both `api` (port `8000`) and `web` (port `3000`, `BACKEND_URL=http://api:8000`).
- **Pitch Demo (`/demo/`)**: Standalone read-only page using deterministic sample data (`NTHU-SHUIMU`: Plastic `85%`, Paper `40%`, Metal `15%`, General Waste `SENSOR_ERROR` / `N/A`; `RLS-TEST-STATION`: Plastic `75%` `LEGACY`) with zero database writes.
