-- SortSense Database Migration: Hardware ToF Fill-Level Ingestion RPC
-- Target: Supabase PostgreSQL (public schema)
-- Safety: Transaction-wrapped, idempotent, preserves RLS.
--
-- Documented Rollback Procedure:
-- BEGIN;
-- REVOKE ALL ON FUNCTION public.ingest_bin_fill_level(UUID, NUMERIC, TEXT, NUMERIC, TIMESTAMPTZ) FROM service_role;
-- DROP FUNCTION IF EXISTS public.ingest_bin_fill_level(UUID, NUMERIC, TEXT, NUMERIC, TIMESTAMPTZ);
-- COMMIT;

BEGIN;

CREATE OR REPLACE FUNCTION public.ingest_bin_fill_level(
    p_bin_id UUID,
    p_fill_percentage NUMERIC DEFAULT NULL,
    p_operational_status TEXT DEFAULT 'NORMAL',
    p_distance_mm NUMERIC DEFAULT NULL,
    p_measured_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    bin_id UUID,
    fill_percentage NUMERIC,
    operational_status TEXT,
    measured_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    reading_source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
    v_sensor_id UUID;
    v_existing_fill NUMERIC;
    v_has_existing BOOLEAN := false;
    v_target_fill NUMERIC;
    v_now TIMESTAMPTZ := COALESCE(p_measured_at, now());
    v_updated_at TIMESTAMPTZ := now();
BEGIN
    IF p_bin_id IS NULL THEN
        RAISE EXCEPTION 'p_bin_id is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_operational_status IS NULL OR p_operational_status NOT IN ('NORMAL', 'SENSOR_ERROR') THEN
        RAISE EXCEPTION 'Invalid operational_status %. Must be NORMAL or SENSOR_ERROR', p_operational_status
            USING ERRCODE = '22023';
    END IF;

    -- Verify bin and hierarchy are active
    IF NOT EXISTS (
        SELECT 1
          FROM public.bins b
          JOIN public.disposal_areas da ON da.area_id = b.area_id
          JOIN public.floors fl ON fl.floor_id = da.floor_id
          JOIN public.stations st ON st.station_id = fl.station_id
         WHERE b.bin_id = p_bin_id
           AND b.is_active = true
           AND da.is_active = true
           AND fl.is_active = true
           AND st.is_active = true
    ) THEN
        RAISE EXCEPTION 'Active bin % not found in active station hierarchy', p_bin_id
            USING ERRCODE = 'P0002';
    END IF;

    SELECT bs.fill_percentage
      INTO v_existing_fill
      FROM public.bin_status bs
     WHERE bs.bin_id = p_bin_id
       FOR UPDATE;

    IF FOUND THEN
        v_has_existing := true;
    END IF;

    IF p_operational_status = 'NORMAL' THEN
        IF p_fill_percentage IS NULL OR p_fill_percentage < 0 OR p_fill_percentage > 100 THEN
            RAISE EXCEPTION 'fill_percentage must be between 0 and 100 for NORMAL status'
                USING ERRCODE = '22023';
        END IF;
        v_target_fill := ROUND(p_fill_percentage, 2);
    ELSE
        -- Never fabricate 0% on SENSOR_ERROR; preserve last valid fill or NULL
        v_target_fill := CASE WHEN v_has_existing THEN v_existing_fill ELSE NULL END;
    END IF;

    -- Record historical ToF measurement in sensor_readings if an active TOF sensor is registered
    SELECT s.sensor_id
      INTO v_sensor_id
      FROM public.sensors s
     WHERE s.bin_id = p_bin_id
       AND s.sensor_type = 'TOF'
       AND s.is_active = true
     LIMIT 1;

    IF v_sensor_id IS NOT NULL THEN
        UPDATE public.sensors
           SET last_read_at = v_now
         WHERE sensor_id = v_sensor_id;

        IF p_operational_status = 'NORMAL' THEN
            INSERT INTO public.sensor_readings (
                sensor_id,
                distance_mm,
                fill_percentage,
                recorded_at
            )
            VALUES (
                v_sensor_id,
                CASE WHEN p_distance_mm IS NOT NULL AND p_distance_mm >= 0 THEN p_distance_mm ELSE NULL END,
                v_target_fill,
                v_now
            );
        END IF;
    END IF;

    -- Upsert bin_status as HARDWARE (overwrites SIMULATED/LEGACY, respects newer HARDWARE measured_at)
    IF p_operational_status = 'NORMAL' THEN
        INSERT INTO public.bin_status (
            bin_id,
            fill_percentage,
            operational_status,
            measured_at,
            updated_at,
            reading_source
        )
        VALUES (
            p_bin_id,
            v_target_fill,
            'NORMAL',
            v_now,
            v_updated_at,
            'HARDWARE'
        )
        ON CONFLICT (bin_id) DO UPDATE
        SET fill_percentage = EXCLUDED.fill_percentage,
            operational_status = 'NORMAL',
            measured_at = EXCLUDED.measured_at,
            updated_at = EXCLUDED.updated_at,
            reading_source = 'HARDWARE'
        WHERE bin_status.reading_source <> 'HARDWARE'
           OR bin_status.measured_at IS NULL
           OR EXCLUDED.measured_at >= bin_status.measured_at;
    ELSE
        INSERT INTO public.bin_status (
            bin_id,
            fill_percentage,
            operational_status,
            measured_at,
            updated_at,
            reading_source
        )
        VALUES (
            p_bin_id,
            v_target_fill,
            'SENSOR_ERROR',
            v_now,
            v_updated_at,
            'HARDWARE'
        )
        ON CONFLICT (bin_id) DO UPDATE
        SET fill_percentage = EXCLUDED.fill_percentage,
            operational_status = 'SENSOR_ERROR',
            measured_at = EXCLUDED.measured_at,
            updated_at = EXCLUDED.updated_at,
            reading_source = 'HARDWARE'
        WHERE bin_status.reading_source <> 'HARDWARE'
           OR bin_status.measured_at IS NULL
           OR EXCLUDED.measured_at >= bin_status.measured_at;
    END IF;

    RETURN QUERY
    SELECT
        bs.bin_id,
        bs.fill_percentage,
        bs.operational_status::TEXT,
        bs.measured_at,
        bs.updated_at,
        bs.reading_source
    FROM public.bin_status bs
    WHERE bs.bin_id = p_bin_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_bin_fill_level(UUID, NUMERIC, TEXT, NUMERIC, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_bin_fill_level(UUID, NUMERIC, TEXT, NUMERIC, TIMESTAMPTZ) TO service_role;

COMMIT;
