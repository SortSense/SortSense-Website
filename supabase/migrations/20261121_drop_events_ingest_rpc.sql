-- SortSense Database Migration: Narrowly Scoped Waste Drop Event Ingestion RPC
-- Target: Supabase PostgreSQL (public schema)
-- Safety: Transaction-wrapped, idempotent, preserves all RLS policies.
--
-- Documented Rollback Procedure:
-- BEGIN;
-- REVOKE ALL ON FUNCTION public.ingest_waste_drop_event(UUID, UUID, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ) FROM service_role;
-- DROP FUNCTION IF EXISTS public.ingest_waste_drop_event(UUID, UUID, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ);
-- COMMIT;

BEGIN;

CREATE OR REPLACE FUNCTION public.ingest_waste_drop_event(
    p_actual_bin_id UUID,
    p_classified_category_id UUID DEFAULT NULL,
    p_confidence NUMERIC DEFAULT 0.0,
    p_classified_at TIMESTAMPTZ DEFAULT NULL,
    p_verified_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    event_id UUID,
    actual_bin_id UUID,
    classified_category_id UUID,
    trigger_sensor_id UUID,
    classification_confidence NUMERIC,
    classified_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
    v_trigger_sensor_id UUID;
    v_classified_at TIMESTAMPTZ := COALESCE(p_classified_at, now());
    v_verified_at TIMESTAMPTZ := COALESCE(p_verified_at, now());
    v_new_event_id UUID;
BEGIN
    IF p_actual_bin_id IS NULL THEN
        RAISE EXCEPTION 'p_actual_bin_id is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_confidence IS NULL OR p_confidence < 0 OR p_confidence > 1 THEN
        RAISE EXCEPTION 'p_confidence must be between 0 and 1'
            USING ERRCODE = '22023';
    END IF;

    -- Verify bin and its entire hierarchy (disposal_area, floor, station) are active
    IF NOT EXISTS (
        SELECT 1
          FROM public.bins b
          JOIN public.disposal_areas da ON da.area_id = b.area_id
          JOIN public.floors fl ON fl.floor_id = da.floor_id
          JOIN public.stations st ON st.station_id = fl.station_id
         WHERE b.bin_id = p_actual_bin_id
           AND b.is_active = true
           AND da.is_active = true
           AND fl.is_active = true
           AND st.is_active = true
    ) THEN
        RAISE EXCEPTION 'Active bin % not found in active station hierarchy', p_actual_bin_id
            USING ERRCODE = 'P0002';
    END IF;

    IF p_classified_category_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM public.waste_categories wc
         WHERE wc.category_id = p_classified_category_id
           AND wc.is_active = true
    ) THEN
        RAISE EXCEPTION 'Active waste category % not found', p_classified_category_id
            USING ERRCODE = '22023';
    END IF;

    -- Resolve optional active IR trigger sensor for this bin
    SELECT s.sensor_id
      INTO v_trigger_sensor_id
      FROM public.sensors s
     WHERE s.bin_id = p_actual_bin_id
       AND s.sensor_type = 'IR'
       AND s.is_active = true
     LIMIT 1;

    INSERT INTO public.drop_events (
        actual_bin_id,
        classified_category_id,
        trigger_sensor_id,
        classification_confidence,
        classified_at,
        verified_at
    )
    VALUES (
        p_actual_bin_id,
        p_classified_category_id,
        v_trigger_sensor_id,
        ROUND(p_confidence, 4),
        v_classified_at,
        v_verified_at
    )
    RETURNING drop_events.event_id
      INTO v_new_event_id;

    RETURN QUERY
    SELECT
        de.event_id,
        de.actual_bin_id,
        de.classified_category_id,
        de.trigger_sensor_id,
        de.classification_confidence,
        de.classified_at,
        de.verified_at
    FROM public.drop_events de
    WHERE de.event_id = v_new_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_waste_drop_event(UUID, UUID, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_waste_drop_event(UUID, UUID, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

COMMIT;
