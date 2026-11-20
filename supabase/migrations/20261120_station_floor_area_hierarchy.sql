-- SortSense Database Migration: Station -> Floors -> Disposal Areas -> Bins Hierarchy
-- Target: Supabase PostgreSQL (public schema)
-- Safety: Transaction-wrapped, idempotent, non-destructive, preserves all existing IDs, telemetry, and drop_events.
-- Deletion policy: ON DELETE RESTRICT (no cascading deletes). Prefer soft deactivation (is_active = false).
--
-- ROLLBACK WARNING:
-- Reverting this migration deletes ALL newly created floor and disposal-area records
-- and their bin assignments. Do NOT perform a rollback after real floor/area hierarchy
-- data has been created unless that data has been backed up first.
--
-- Documented Rollback Procedure (execute manually only if reverting):
-- BEGIN;
--
-- -- Remove triggers
-- DROP TRIGGER IF EXISTS trg_bins_same_station_area ON public.bins;
-- DROP TRIGGER IF EXISTS trg_disposal_areas_same_station ON public.disposal_areas;
-- DROP TRIGGER IF EXISTS trg_floors_same_station ON public.floors;
--
-- -- Remove trigger functions
-- DROP FUNCTION IF EXISTS public.enforce_bin_same_station_area();
-- DROP FUNCTION IF EXISTS public.enforce_area_floor_same_station();
-- DROP FUNCTION IF EXISTS public.enforce_floor_station_consistency();
--
-- -- Remove the new column and index
-- DROP INDEX IF EXISTS public.idx_bins_area_id;
-- ALTER TABLE public.bins DROP COLUMN IF EXISTS area_id;
--
-- -- Remove the new tables
-- DROP TABLE IF EXISTS public.disposal_areas;
-- DROP TABLE IF EXISTS public.floors;
--
-- COMMIT;

BEGIN;

-- 1. Create public.floors
CREATE TABLE IF NOT EXISTS public.floors (
    floor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(station_id) ON DELETE RESTRICT,
    floor_name TEXT NOT NULL,
    floor_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_floors_station_id
    ON public.floors(station_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_floors_station_floor_name
    ON public.floors(station_id, lower(floor_name));

-- 2. Create public.disposal_areas
CREATE TABLE IF NOT EXISTS public.disposal_areas (
    area_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_id UUID NOT NULL REFERENCES public.floors(floor_id) ON DELETE RESTRICT,
    area_name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disposal_areas_floor_id
    ON public.disposal_areas(floor_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_disposal_areas_floor_area_name
    ON public.disposal_areas(floor_id, lower(area_name));

-- 3. Add nullable area_id to public.bins (preserving station_id; NOT NULL not enforced yet)
ALTER TABLE public.bins
    ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.disposal_areas(area_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_bins_area_id
    ON public.bins(area_id);

-- 3b. Cross-station assignment prevention triggers
-- Ensures bins.station_id always matches the station owning bins.area_id -> disposal_areas.floor_id -> floors.station_id.
CREATE OR REPLACE FUNCTION public.enforce_bin_same_station_area()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_area_station_id UUID;
BEGIN
    IF NEW.area_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT f.station_id INTO v_area_station_id
    FROM public.disposal_areas da
    JOIN public.floors f ON f.floor_id = da.floor_id
    WHERE da.area_id = NEW.area_id;

    IF v_area_station_id IS NULL OR v_area_station_id <> NEW.station_id THEN
        RAISE EXCEPTION 'Cross-station assignment rejected: bin station_id (%) does not match disposal area station_id (%)',
            NEW.station_id, v_area_station_id
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bins_same_station_area ON public.bins;
CREATE TRIGGER trg_bins_same_station_area
    BEFORE INSERT OR UPDATE OF station_id, area_id ON public.bins
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_bin_same_station_area();

CREATE OR REPLACE FUNCTION public.enforce_area_floor_same_station()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_station_id UUID;
BEGIN
    IF NEW.floor_id IS NOT DISTINCT FROM OLD.floor_id THEN
        RETURN NEW;
    END IF;

    SELECT f.station_id INTO v_new_station_id
    FROM public.floors f
    WHERE f.floor_id = NEW.floor_id;

    IF EXISTS (
        SELECT 1
        FROM public.bins b
        WHERE b.area_id = NEW.area_id
          AND b.station_id <> v_new_station_id
    ) THEN
        RAISE EXCEPTION 'Cannot move disposal area % to floor % because existing bins belong to a different station',
            NEW.area_id, NEW.floor_id
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disposal_areas_same_station ON public.disposal_areas;
CREATE TRIGGER trg_disposal_areas_same_station
    BEFORE UPDATE OF floor_id ON public.disposal_areas
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_area_floor_same_station();

CREATE OR REPLACE FUNCTION public.enforce_floor_station_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.station_id IS NOT DISTINCT FROM OLD.station_id THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.disposal_areas da
        JOIN public.bins b ON b.area_id = da.area_id
        WHERE da.floor_id = NEW.floor_id
          AND b.station_id <> NEW.station_id
    ) THEN
        RAISE EXCEPTION 'Cannot reassign floor % to station % because dependent bins belong to a different station',
            NEW.floor_id, NEW.station_id
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_floors_same_station ON public.floors;
CREATE TRIGGER trg_floors_same_station
    BEFORE UPDATE OF station_id ON public.floors
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_floor_station_consistency();

-- 4. Enable RLS and configure least-privilege policies for floors and disposal_areas
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disposal_areas ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.floors TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.floors TO authenticated;

GRANT SELECT ON public.disposal_areas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.disposal_areas TO authenticated;

-- Public & non-admin users can only read active floors
DROP POLICY IF EXISTS "Public can read active floors" ON public.floors;
CREATE POLICY "Public can read active floors"
    ON public.floors
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Active ADMIN users (via public.is_admin()) can read both active and inactive floors and manage them
DROP POLICY IF EXISTS "Admins can read all floors" ON public.floors;
CREATE POLICY "Admins can read all floors"
    ON public.floors
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage floors" ON public.floors;
CREATE POLICY "Admins can manage floors"
    ON public.floors
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Public & non-admin users can only read active disposal areas
DROP POLICY IF EXISTS "Public can read active disposal areas" ON public.disposal_areas;
CREATE POLICY "Public can read active disposal areas"
    ON public.disposal_areas
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Active ADMIN users (via public.is_admin()) can read both active and inactive disposal areas and manage them
DROP POLICY IF EXISTS "Admins can read all disposal areas" ON public.disposal_areas;
CREATE POLICY "Admins can read all disposal areas"
    ON public.disposal_areas
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage disposal areas" ON public.disposal_areas;
CREATE POLICY "Admins can manage disposal areas"
    ON public.disposal_areas
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 5. Idempotent backfill for existing stations and unassigned bins
-- Preserves all bins that already have a valid area_id.
-- Handles stations that already have floors but still contain unassigned bins.
-- Uses ON CONFLICT DO NOTHING on unique indexes to guarantee no duplicate placeholders.
DO $$
DECLARE
    st RECORD;
    v_floor_id UUID;
    v_area_id UUID;
BEGIN
    FOR st IN
        SELECT s.station_id
        FROM public.stations s
        WHERE NOT EXISTS (
            SELECT 1 FROM public.floors f WHERE f.station_id = s.station_id
        )
        OR EXISTS (
            SELECT 1 FROM public.bins b WHERE b.station_id = s.station_id AND b.area_id IS NULL
        )
    LOOP
        INSERT INTO public.floors (station_id, floor_name, floor_order, is_active)
        VALUES (st.station_id, 'Unassigned Floor', 0, true)
        ON CONFLICT (station_id, (lower(floor_name))) DO NOTHING;

        SELECT f.floor_id INTO v_floor_id
        FROM public.floors f
        WHERE f.station_id = st.station_id
          AND lower(f.floor_name) = 'unassigned floor'
        LIMIT 1;

        INSERT INTO public.disposal_areas (floor_id, area_name, description, is_active)
        VALUES (
            v_floor_id,
            'Unassigned Area',
            'Placeholder area for existing bins prior to floor/area assignment',
            true
        )
        ON CONFLICT (floor_id, (lower(area_name))) DO NOTHING;

        SELECT da.area_id INTO v_area_id
        FROM public.disposal_areas da
        WHERE da.floor_id = v_floor_id
          AND lower(da.area_name) = 'unassigned area'
        LIMIT 1;

        UPDATE public.bins
        SET area_id = v_area_id
        WHERE station_id = st.station_id
          AND area_id IS NULL;
    END LOOP;
END $$;

COMMIT;
