-- SortSense Database Migration (Phase 1): Individual-Bin Telemetry Simulation
-- Target: Supabase PostgreSQL (public schema)
-- Safety: Transaction-wrapped, idempotent, non-destructive.
-- NOTE: Do NOT execute automatically. Review and run manually in Supabase SQL Editor.
--
-- Documented Rollback Procedure (execute manually only if reverting):
-- BEGIN;
--
-- REVOKE ALL ON FUNCTION public.admin_simulate_bin_telemetry(UUID, NUMERIC, TEXT, TIMESTAMPTZ) FROM authenticated;
-- DROP FUNCTION IF EXISTS public.admin_simulate_bin_telemetry(UUID, NUMERIC, TEXT, TIMESTAMPTZ);
--
-- ALTER TABLE public.bin_status DROP CONSTRAINT IF EXISTS chk_bin_status_reading_source;
-- ALTER TABLE public.bin_status DROP COLUMN IF EXISTS reading_source;
--
-- COMMIT;

BEGIN;

-- 1. Add reading_source to public.bin_status to distinguish LEGACY, SIMULATED, and HARDWARE telemetry.
-- Existing records are backfilled as 'LEGACY' and the column default + NOT NULL are enforced explicitly.
ALTER TABLE public.bin_status
    ADD COLUMN IF NOT EXISTS reading_source TEXT;

UPDATE public.bin_status
   SET reading_source = 'LEGACY'
 WHERE reading_source IS NULL;

ALTER TABLE public.bin_status
    ALTER COLUMN reading_source SET DEFAULT 'LEGACY',
    ALTER COLUMN reading_source SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_bin_status_reading_source'
          AND conrelid = 'public.bin_status'::regclass
    ) THEN
        ALTER TABLE public.bin_status
            ADD CONSTRAINT chk_bin_status_reading_source
            CHECK (reading_source IN ('LEGACY', 'SIMULATED', 'HARDWARE'));
    END IF;
END $$;

-- Allow NULL fill_percentage on bin_status so a SENSOR_ERROR on a bin with no prior
-- reading never requires fabricating 0%.
ALTER TABLE public.bin_status
    ALTER COLUMN fill_percentage DROP NOT NULL;

-- 2. Atomic ADMIN-only RPC for simulating individual-bin telemetry
-- - Enforces active ADMIN profile via public.is_admin()
-- - Rejects unknown or inactive bins
-- - Rejects bins that have active physical sensors in public.sensors
-- - Rejects overwriting existing HARDWARE telemetry in public.bin_status
-- - Never inserts into public.sensor_readings
-- - Preserves last valid fill_percentage when operational_status = 'SENSOR_ERROR'
CREATE OR REPLACE FUNCTION public.admin_simulate_bin_telemetry(
    p_bin_id UUID,
    p_fill_percentage NUMERIC DEFAULT NULL,
    p_operational_status TEXT DEFAULT 'NORMAL',
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
    v_bin_active BOOLEAN;
    v_existing_fill NUMERIC;
    v_existing_source TEXT;
    v_has_existing BOOLEAN := false;
    v_target_fill NUMERIC;
    v_now TIMESTAMPTZ := COALESCE(p_measured_at, now());
    v_updated_at TIMESTAMPTZ := now();
BEGIN
    -- 1. Require active ADMIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required to simulate bin telemetry'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Validate required inputs and operational status (explicit NULL guards)
    IF p_bin_id IS NULL THEN
        RAISE EXCEPTION 'p_bin_id is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_operational_status IS NULL OR p_operational_status NOT IN ('NORMAL', 'SENSOR_ERROR') THEN
        RAISE EXCEPTION 'Invalid operational_status %. Must be NORMAL or SENSOR_ERROR', p_operational_status
            USING ERRCODE = '22023';
    END IF;

    -- 3. Verify bin exists and is active
    SELECT b.is_active
      INTO v_bin_active
      FROM public.bins b
     WHERE b.bin_id = p_bin_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bin % not found', p_bin_id
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_bin_active THEN
        RAISE EXCEPTION 'Cannot simulate telemetry for inactive bin %', p_bin_id
            USING ERRCODE = '23514';
    END IF;

    -- 4. Reject simulation for bins with active physical sensors
    IF EXISTS (
        SELECT 1
          FROM public.sensors s
         WHERE s.bin_id = p_bin_id
           AND s.is_active = true
    ) THEN
        RAISE EXCEPTION 'Cannot simulate telemetry for bin % because it has an active physical sensor', p_bin_id
            USING ERRCODE = '23514';
    END IF;

    -- 5. Lock existing bin_status (if any) and prevent overwriting HARDWARE telemetry
    SELECT bs.fill_percentage, bs.reading_source
      INTO v_existing_fill, v_existing_source
      FROM public.bin_status bs
     WHERE bs.bin_id = p_bin_id
       FOR UPDATE;

    IF FOUND THEN
        v_has_existing := true;
        IF v_existing_source = 'HARDWARE' THEN
            RAISE EXCEPTION 'Cannot overwrite existing HARDWARE telemetry for bin % with SIMULATED data', p_bin_id
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 6. Compute fill_percentage without fabricating 0% on SENSOR_ERROR
    IF p_operational_status = 'NORMAL' THEN
        IF p_fill_percentage IS NULL OR p_fill_percentage < 0 OR p_fill_percentage > 100 THEN
            RAISE EXCEPTION 'fill_percentage must be between 0 and 100 for NORMAL status'
                USING ERRCODE = '22023';
        END IF;
        v_target_fill := ROUND(p_fill_percentage, 2);
    ELSE
        -- Preserve last known valid fill percentage if present; otherwise NULL
        v_target_fill := CASE WHEN v_has_existing THEN v_existing_fill ELSE NULL END;
    END IF;

    -- 7. Upsert bin_status atomically (never touches sensor_readings)
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
            'SIMULATED'
        )
        ON CONFLICT (bin_id) DO UPDATE
        SET fill_percentage = EXCLUDED.fill_percentage,
            operational_status = 'NORMAL',
            measured_at = EXCLUDED.measured_at,
            updated_at = EXCLUDED.updated_at,
            reading_source = 'SIMULATED';
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
            'SIMULATED'
        )
        ON CONFLICT (bin_id) DO UPDATE
        SET fill_percentage = EXCLUDED.fill_percentage,
            operational_status = 'SENSOR_ERROR',
            measured_at = EXCLUDED.measured_at,
            updated_at = EXCLUDED.updated_at,
            reading_source = 'SIMULATED';
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

REVOKE ALL ON FUNCTION public.admin_simulate_bin_telemetry(UUID, NUMERIC, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_simulate_bin_telemetry(UUID, NUMERIC, TEXT, TIMESTAMPTZ) TO authenticated;

COMMIT;
