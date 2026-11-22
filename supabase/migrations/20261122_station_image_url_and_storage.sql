-- SortSense Database Migration: Station Location Photos (`stations.image_url` + `station-photos` Storage bucket)
-- Target: Supabase PostgreSQL (`public` + `storage` schemas)
-- Safety: Transaction-wrapped, idempotent, preserves all existing station data and RLS policies.
--
-- Documented Rollback Procedure:
-- BEGIN;
-- DROP POLICY IF EXISTS "station_photos_public_read" ON storage.objects;
-- DROP POLICY IF EXISTS "station_photos_admin_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "station_photos_admin_update" ON storage.objects;
-- DROP POLICY IF EXISTS "station_photos_admin_delete" ON storage.objects;
-- ALTER TABLE public.stations DROP COLUMN IF EXISTS image_url;
-- COMMIT;

BEGIN;

-- 1. Add nullable image_url column to public.stations
ALTER TABLE public.stations
    ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.stations.image_url IS
    'Public URL of the real campus location photo for this station (stored in Supabase Storage bucket station-photos).';

-- 2. Ensure public Supabase Storage bucket `station-photos` exists (max 5 MB, JPG/PNG/WebP)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'storage'
          AND table_name = 'buckets'
    ) THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'station-photos',
            'station-photos',
            true,
            5242880,
            ARRAY['image/jpeg', 'image/png', 'image/webp']
        )
        ON CONFLICT (id) DO UPDATE
        SET public = true,
            file_size_limit = 5242880,
            allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
    END IF;
END
$$;

-- 3. Storage RLS policies: public read, active ADMIN insert/update/delete
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'storage'
          AND table_name = 'objects'
    ) THEN
        DROP POLICY IF EXISTS "station_photos_public_read" ON storage.objects;
        CREATE POLICY "station_photos_public_read"
            ON storage.objects
            FOR SELECT
            TO public
            USING (bucket_id = 'station-photos');

        DROP POLICY IF EXISTS "station_photos_admin_insert" ON storage.objects;
        CREATE POLICY "station_photos_admin_insert"
            ON storage.objects
            FOR INSERT
            TO authenticated
            WITH CHECK (
                bucket_id = 'station-photos'
                AND EXISTS (
                    SELECT 1
                    FROM public.profiles p
                    WHERE p.user_id = auth.uid()
                      AND p.is_active = true
                      AND UPPER(p.role) = 'ADMIN'
                )
            );

        DROP POLICY IF EXISTS "station_photos_admin_update" ON storage.objects;
        CREATE POLICY "station_photos_admin_update"
            ON storage.objects
            FOR UPDATE
            TO authenticated
            USING (
                bucket_id = 'station-photos'
                AND EXISTS (
                    SELECT 1
                    FROM public.profiles p
                    WHERE p.user_id = auth.uid()
                      AND p.is_active = true
                      AND UPPER(p.role) = 'ADMIN'
                )
            )
            WITH CHECK (
                bucket_id = 'station-photos'
                AND EXISTS (
                    SELECT 1
                    FROM public.profiles p
                    WHERE p.user_id = auth.uid()
                      AND p.is_active = true
                      AND UPPER(p.role) = 'ADMIN'
                )
            );

        DROP POLICY IF EXISTS "station_photos_admin_delete" ON storage.objects;
        CREATE POLICY "station_photos_admin_delete"
            ON storage.objects
            FOR DELETE
            TO authenticated
            USING (
                bucket_id = 'station-photos'
                AND EXISTS (
                    SELECT 1
                    FROM public.profiles p
                    WHERE p.user_id = auth.uid()
                      AND p.is_active = true
                      AND UPPER(p.role) = 'ADMIN'
                )
            );
    END IF;
END
$$;

COMMIT;
