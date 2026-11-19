# SortSense-Website — Repo Context & AI Instructions

> **Repo:** `SortSense-Website` (Owner: Kiyo)
> **Usage:** Place this file in the repo root as `CONTEXT.md` (or `.cursorrules`). It defines this repo's exact endpoints and payloads-
so it connects seamlessly with https://github.com/SortSense/SortSense-Hardware and https://github.com/SortSense/SortSense-AI_backend.

## 1. Role in the SortSense System

This repository hosts the **Cloud API** and **Campus Monitoring Web Dashboard** on **Vercel**:

1. **Python FastAPI Backend (`/api/`):** Ingests ToF bin fill levels from Fabio's ESP32-S3 and verified waste drop logs from Edric's AI/LLM Backend, storing everything in **Supabase (PostgreSQL)**.

2. **Next.js + Tailwind Frontend:** Displays real-time campus bin status, compartment fill bars, manual reset controls, QR-code station provisioning, and daily recycling analytics.

## 2. Tech Stack & Hard Constraints

* **>50% Python Codebase Requirement:** ALL backend API routes MUST be written in **Python (FastAPI)** inside Vercel's `/api/` directory (e.g., `/api/index.py` with `supabase-py`). Do NOT write backend logic in Next.js Node/TypeScript API routes.

* **No WebSockets on Vercel:** All communication uses standard HTTP REST (`GET`/`POST`). The frontend refreshes live data via periodic polling (e.g., SWR or `setInterval` every 5–10s).

* **Frontend:** Next.js, React, Tailwind CSS, Recharts (or Chart.js), Leaflet/Mapbox (or interactive campus SVG map).

* **Standardized Categories (Strict Enum):** `"plastic"`, `"paper"`, `"metal"`, `"general"`.

## 3. Database Schema (Supabase / PostgreSQL)

Its made, if its not given ask for it

## 4. Cloud API Endpoints This Repo OWNS (`/api/...`)

### Hardware & AI Ingestion

1. **`POST /api/telemetry/fill-levels`** *(Called by ESP32-S3)*

   * **Body:**

   ```json
   {
     "station_id": "ST-001",
     "fill_levels": { "plastic": 45, "paper": 80, "metal": 20, "general": 95 }
   }
   ```

   * **Action:** Upsert `station_status` and update `stations.last_seen` / `is_online = true`.

2. **`POST /api/events/log-waste`** *(Called by Edric's AI Backend)*

   * **Body:**

   ```json
   {
     "station_id": "ST-001",
     "waste_category": "plastic",
     "dropped_in_bin": "plastic",
     "confidence": 0.91,
     "is_correct_sort": true
   }
   ```

   * **Action:** Insert row into `drop_events`. Return `201 Created`.

### Frontend Feeders & Controls

3. **`GET /api/dashboard/live-status`**

   * **Response:**

   ```json
   {
     "stations": [
       {
         "station_id": "ST-001",
         "name": "Delta Building 1F",
         "latitude": 24.7956,
         "longitude": 120.9923,
         "is_online": true,
         "max_fill_pct": 95,
         "status_color": "red",
         "fill_levels": { "plastic": 45, "paper": 80, "metal": 20, "general": 95 },
         "updated_at": "2026-11-19T02:30:00Z"
       }
     ]
   }
   ```

   *(Color rule: `< 60` = `"green"`, `60–84` = `"yellow"`, `>= 85` = `"red"`).*

4. **`GET /api/dashboard/analytics`**

   * **Response:**

   ```json
   {
     "total_items_today": 142,
     "sorting_accuracy_pct": 88.5,
     "breakdown": { "plastic": 58, "paper": 41, "metal": 23, "general": 20 }
   }
   ```

5. **`POST /api/bins/provision`** *(QR-code phone GPS onboarding)*

   * **Body:** `{"station_id": "ST-001", "name": "Delta Building 1F", "latitude": 24.7956, "longitude": 120.9923}`

6. **`POST /api/bins/empty`** *(Manual janitor reset)*

   * **Body:** `{"station_id": "ST-001", "compartment": "all"}` *(or `"plastic" | "paper" | "metal" | "general"`)*

## 5. Core Frontend Views

1. **Campus Map:** Shows all stations as Green / Yellow / Red pins based on `status_color`.

2. **Station Detail:** Shows 4 live compartment fill-level progress bars + an **"Empty Bin"** reset button.

3. **Analytics Dashboard:** Daily breakdown bar/pie chart (`plastic`, `paper`, `metal`, `general`) + total sorted today + sorting accuracy %.
