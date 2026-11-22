import {
  categories,
  type Availability,
  type Bin,
  type CategorySlug,
  type DisposalArea,
  type Floor,
  type Station,
} from '@/lib/categories';
import type { LiveStatusResponse, StationLiveStatus } from '@/components/types';

export interface LiveStationsResult {
  stations: Station[];
  fetchedAt: string;
}

/**
 * Compute Haversine distance in meters between two [lat, lng] coordinates.
 */
export function calculateDistanceMeters(
  from: [number, number],
  to: [number, number],
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to[0] - from[0]);
  const dLon = toRad(to[1] - from[1]);
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Derive individual bin availability from fill percentage and station online state.
 * Aligns with FastAPI backend compute_status_color thresholds (<60, 60-84, >=85).
 */
export function computeBinStatus(fill: number | null, isOnline: boolean): Availability {
  if (!isOnline || fill === null || Number.isNaN(fill)) {
    return 'unknown';
  }
  if (fill >= 85) {
    return 'full';
  }
  if (fill >= 60) {
    return 'nearly-full';
  }
  return 'available';
}

/**
 * Format an ISO timestamp into a concise relative string.
 */
export function formatUpdatedRelative(isoString: string | null): string {
  if (!isoString) {
    return 'No reading';
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return 'No reading';
  }
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec} sec ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return date.toLocaleDateString();
}

const categoryLabels: Record<CategorySlug, string> = {
  plastic: 'Plastic recycling',
  paper: 'Paper recycling',
  metal: 'Metal recycling',
  general: 'General waste',
};

const categoryCodePrefix: Record<CategorySlug, string> = {
  plastic: 'PL',
  paper: 'PA',
  metal: 'ME',
  general: 'GE',
};

/**
 * Map a single StationLiveStatus record from GET /api/dashboard/live-status
 * into the Station model without fabricating missing coordinates or metadata.
 */
export function adaptStation(
  raw: StationLiveStatus,
  userLocation?: [number, number] | null,
): Station {
  const lat = raw.latitude;
  const lng = raw.longitude;
  const hasValidCoordinates =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (lat !== 0 || lng !== 0);

  const coordinates: [number, number] | null = hasValidCoordinates
    ? [lat as number, lng as number]
    : null;

  const updatedText = formatUpdatedRelative(raw.updated_at);

  const floors: Floor[] = (raw.floors ?? []).map((fl) => {
    const areas: DisposalArea[] = (fl.disposal_areas ?? []).map((area) => {
      const areaBins: Bin[] = (area.bins ?? []).map((b) => {
        const slug: CategorySlug = b.category_slug ?? 'general';
        const catMeta = categories.find((c) => c.slug === slug);
        const opStatus = (b.operational_status ?? '').toUpperCase();
        const hasErr = opStatus === 'SENSOR_ERROR' || opStatus === 'OFFLINE';
        const fill =
          !hasErr && typeof b.fill_percentage === 'number' && Number.isFinite(b.fill_percentage)
            ? b.fill_percentage
            : null;
        return {
          id: b.bin_id,
          category: slug,
          label: b.category_name || categoryLabels[slug] || 'Waste bin',
          status: hasErr ? 'unknown' : computeBinStatus(fill, raw.is_online),
          fill,
          updated: b.updated_at ? formatUpdatedRelative(b.updated_at) : updatedText,
          accepts: catMeta?.accepts ?? [],
          capacityLiters: b.capacity_liters,
          areaId: area.area_id,
          areaName: area.area_name,
          floorName: fl.floor_name,
          operationalStatus: b.operational_status ?? null,
          readingSource: b.reading_source ?? null,
        };
      });
      return {
        id: area.area_id,
        name: area.area_name,
        description: area.description ?? undefined,
        bins: areaBins,
      };
    });
    return {
      id: fl.floor_id,
      name: fl.floor_name,
      order: fl.floor_order,
      areas,
    };
  });

  const hierarchicalBins: Bin[] = floors.flatMap((fl) => fl.areas.flatMap((a) => a.bins));

  const bins: Bin[] =
    floors.length > 0
      ? hierarchicalBins
      : categories.map((cat) => {
          const hasErr = Boolean(raw.sensor_error_categories?.includes(cat.slug));
          const rawFill = raw.fill_levels?.[cat.slug];
          const fill =
            !hasErr && typeof rawFill === 'number' && Number.isFinite(rawFill) ? rawFill : null;
          return {
            id: `${raw.station_id}-${categoryCodePrefix[cat.slug]}`,
            category: cat.slug,
            label: categoryLabels[cat.slug],
            status: hasErr ? 'unknown' : computeBinStatus(fill, raw.is_online),
            fill,
            updated: updatedText,
            accepts: cat.accepts,
          };
        });

  let distance: number | undefined;
  let walkTime: number | undefined;
  if (userLocation && coordinates) {
    distance = calculateDistanceMeters(userLocation, coordinates);
    walkTime = Math.max(1, Math.round(distance / 80));
  }

  return {
    id: raw.station_id,
    name: raw.name,
    landmark: raw.location_name ?? undefined,
    description: raw.description ?? undefined,
    imageUrl: raw.image_url ?? null,
    coordinates,
    hasValidCoordinates,
    distance,
    walkTime,
    bins,
    floors: floors.length > 0 ? floors : undefined,
  };
}

/**
 * Fetch live station statuses from FastAPI backend.
 * Throws on HTTP/network failure so the UI can display an explicit offline state.
 */
export async function fetchLiveStations(
  userLocation?: [number, number] | null,
  signal?: AbortSignal,
): Promise<LiveStationsResult> {
  const res = await fetch('/api/dashboard/live-status', {
    cache: 'no-store',
    signal,
  });

  if (!res.ok) {
    throw new Error(`Telemetry service returned HTTP ${res.status}`);
  }

  const data: LiveStatusResponse = await res.json();
  const rawStations = Array.isArray(data.stations) ? data.stations : [];

  return {
    stations: rawStations.map((s) => adaptStation(s, userLocation)),
    fetchedAt: new Date().toISOString(),
  };
}
