"use client";

import { createClient } from "@/lib/supabase/client";

export const STATION_PHOTOS_BUCKET = "station-photos";
export const MAX_STATION_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export interface StationPhotoValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate a candidate station photo file (.jpg, .png, .webp, max 5MB).
 */
export function validateStationPhotoFile(file: File): StationPhotoValidation {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeOk = ALLOWED_MIME_TYPES.has(file.type.toLowerCase());
  const extOk = ALLOWED_EXTENSIONS.has(ext);

  if (!mimeOk && !extOk) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload a .jpg, .png, or .webp image.",
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: "Selected image file is empty.",
    };
  }

  if (file.size > MAX_STATION_PHOTO_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image is too large (${mb} MB). Maximum allowed size is 5 MB.`,
    };
  }

  return { valid: true };
}

export interface UploadedStationPhoto {
  publicUrl: string;
  storagePath: string;
}

/**
 * Upload a validated station photo to Supabase Storage bucket `station-photos`
 * and return its public URL.
 */
export async function uploadStationPhoto(
  file: File,
  stationCode: string,
): Promise<UploadedStationPhoto> {
  const validation = validateStationPhotoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid station photo file.");
  }

  const supabase = createClient();
  const safePrefix =
    stationCode
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "station";

  const ext =
    EXTENSION_BY_MIME[file.type.toLowerCase()] ||
    file.name.split(".").pop()?.toLowerCase() ||
    "jpg";

  const randomSuffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  const storagePath = `${safePrefix}/${Date.now()}-${randomSuffix}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STATION_PHOTOS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
    });

  if (uploadError) {
    throw new Error(
      uploadError.message ||
        "Failed to upload station photo to Supabase Storage.",
    );
  }

  const { data } = supabase.storage
    .from(STATION_PHOTOS_BUCKET)
    .getPublicUrl(storagePath);

  if (!data?.publicUrl) {
    throw new Error("Photo uploaded but failed to generate a public URL.");
  }

  return {
    publicUrl: data.publicUrl,
    storagePath,
  };
}

/**
 * Best-effort removal of a previously uploaded station photo from `station-photos`.
 */
export async function removeStationPhotoFromStorage(
  publicUrl: string,
): Promise<void> {
  const marker = `/storage/v1/object/public/${STATION_PHOTOS_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;

  const objectPath = decodeURIComponent(
    publicUrl.slice(idx + marker.length).split("?")[0],
  );
  if (!objectPath) return;

  try {
    const supabase = createClient();
    await supabase.storage.from(STATION_PHOTOS_BUCKET).remove([objectPath]);
  } catch {
    // Non-blocking cleanup; database image_url update still proceeds
  }
}
