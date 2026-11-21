-- SortSense Database Migration: Atomic Staff Bin Emptying RPC (ADMIN + JANITOR)
-- Target: Supabase PostgreSQL (public schema)
-- Safety: Transaction-wrapped, idempotent, preserves all RLS policies.
--
-- Documented Rollback Procedure:
-- BEGIN;
-- REVOKE ALL ON FUNCTION public.staff_empty_bins(TEXT, TEXT, TEXT) FROM authenticated;
-- DROP FUNCTION IF EXISTS public.staff_empty_bins(TEXT, TEXT, TEXT);
-- COMMIT;

BEGIN;

CREATE OR REPLACE FUNCTION public.staff_empty_bins(
    p_station_code TEXT,
    p_compartment TEXT DEFAULT 'all',
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
    station_code TEXT,
    compartment TEXT,
    emptied_count INTEGER,
    emptied_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
    v_user_id UUID := auth.uid();
    v_role TEXT;
    v_is_active BOOLEAN;
    v_station_id UUID;
    v_station_active BOOLEAN;
    v_now TIMESTAMPTZ := now();
    v_count INTEGER := 0;
    v_bin RECORD;
    v_before NUMERIC;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to empty bins'
            USING ERRCODE = '42501';
    END IF;

    SELECT UPPER(p.role), p.is_active
      INTO v_role, v_is_active
      FROM public.profiles p
     WHERE p.user_id = v_user_id;

    IF NOT FOUND OR NOT COALESCE(v_is_active, false) OR v_role NOT IN ('ADMIN', 'JANITOR') THEN
        RAISE EXCEPTION 'Active ADMIN or JANITOR role required to empty bins'
            USING ERRCODE = '42501';
    END IF;

    IF p_station_code IS NULL OR btrim(p_station_code) = '' THEN
        RAISE EXCEPTION 'p_station_code is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_compartment IS NULL OR lower(btrim(p_compartment)) NOT IN ('all', 'plastic', 'paper', 'metal', 'general') THEN
        RAISE EXCEPTION 'Invalid compartment %. Must be all, plastic, paper, metal, or general', p_compartment
            USING ERRCODE = '22023';
    END IF;

    SELECT s.station_id, s.is_active
      INTO v_station_id, v_station_active
      FROM public.stations s
     WHERE s.station_code = btrim(p_station_code);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Station % not found', p_station_code
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_station_active THEN
        RAISE EXCEPTION 'Station % is inactive', p_station_code
            USING ERRCODE = '23514';
    END IF;

    FOR v_bin IN
        SELECT b.bin_id
          FROM public.bins b
          JOIN public.disposal_areas da ON da.area_id = b.area_id
          JOIN public.floors fl ON fl.floor_id = da.floor_id
          JOIN public.waste_categories wc ON wc.category_id = b.category_id
         WHERE b.station_id = v_station_id
           AND b.is_active = true
           AND da.is_active = true
           AND fl.is_active = true
           AND wc.is_active = true
           AND (
               lower(btrim(p_compartment)) = 'all'
               OR (lower(btrim(p_compartment)) = 'plastic' AND lower(wc.category_name) LIKE 'plastic%')
               OR (lower(btrim(p_compartment)) = 'paper' AND lower(wc.category_name) LIKE 'paper%')
               OR (lower(btrim(p_compartment)) = 'metal' AND lower(wc.category_name) LIKE 'metal%')
               OR (lower(btrim(p_compartment)) = 'general' AND lower(wc.category_name) LIKE 'general%')
           )
         ORDER BY b.bin_id
           FOR UPDATE OF b
    LOOP
        SELECT bs.fill_percentage
          INTO v_before
          FROM public.bin_status bs
         WHERE bs.bin_id = v_bin.bin_id
           FOR UPDATE;

        INSERT INTO public.bin_emptying_events (
            bin_id,
            emptied_by,
            fill_percentage_before,
            emptied_at,
            notes
        )
        VALUES (
            v_bin.bin_id,
            v_user_id,
            CASE WHEN v_before IS NOT NULL AND v_before >= 0 AND v_before <= 100 THEN v_before ELSE NULL END,
            v_now,
            NULLIF(btrim(COALESCE(p_notes, '')), '')
        );

        INSERT INTO public.bin_status (
            bin_id,
            fill_percentage,
            operational_status,
            measured_at,
            updated_at
        )
        VALUES (
            v_bin.bin_id,
            0.0,
            'NORMAL',
            v_now,
            v_now
        )
        ON CONFLICT (bin_id) DO UPDATE
        SET fill_percentage = 0.0,
            operational_status = 'NORMAL',
            measured_at = EXCLUDED.measured_at,
            updated_at = EXCLUDED.updated_at;

        v_count := v_count + 1;
    END LOOP;

    IF v_count = 0 THEN
        RAISE EXCEPTION 'No active % bins found for station %', p_compartment, p_station_code
            USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
    SELECT
        btrim(p_station_code),
        lower(btrim(p_compartment)),
        v_count,
        v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_empty_bins(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_empty_bins(TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
