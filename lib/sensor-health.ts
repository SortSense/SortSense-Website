import type { LiveBinItem, StationLiveStatus } from "@/components/types";

export interface StationSensorHealth {
  stationId: string;
  isLive: boolean;
  totalBins: number;
  activeToF: number;
  offlineOrNa: number;
  cachedReadings: number;
  sensorErrors: number;
  simulatedReadings: number;
  legacyReadings: number;
}

export interface FleetSensorHealth {
  totalBins: number;
  activeToF: number;
  offlineOrNa: number;
  cachedReadings: number;
  sensorErrors: number;
  simulatedReadings: number;
  legacyReadings: number;
  perStation: Record<string, StationSensorHealth>;
}

/**
 * Extract all active configured bins from a station's hierarchical
 * floors -> disposal_areas -> bins structure (never assuming 4 slots per station).
 */
export function getStationConfiguredBins(
  station: StationLiveStatus,
): LiveBinItem[] {
  const bins: LiveBinItem[] = [];
  for (const floor of station.floors ?? []) {
    for (const area of floor.disposal_areas ?? []) {
      for (const bin of area.bins ?? []) {
        if (bin.is_active !== false) {
          bins.push(bin);
        }
      }
    }
  }
  return bins;
}

/**
 * Determine whether a station is actively reporting fresh telemetry.
 */
export function isStationLive(station: StationLiveStatus): boolean {
  return station.is_online === true && station.is_stale !== true;
}

/**
 * Determine whether an individual configured bin has a valid, non-error fill reading
 * regardless of staleness or reading source.
 */
export function hasCachedBinReading(bin: LiveBinItem): boolean {
  const opStatus = (bin.operational_status ?? "").toUpperCase();
  if (opStatus === "SENSOR_ERROR" || opStatus === "OFFLINE") {
    return false;
  }
  return (
    bin.fill_percentage !== null &&
    bin.fill_percentage !== undefined &&
    Number.isFinite(bin.fill_percentage)
  );
}

/**
 * A bin counts as an "Active ToF" sensor ONLY when:
 *  a) its station is live (is_online === true && is_stale !== true),
 *  b) fill_percentage is non-null and finite,
 *  c) operational_status !== "SENSOR_ERROR" (and not "OFFLINE"),
 *  d) reading_source === "HARDWARE" (excluding SIMULATED and LEGACY rows).
 */
export function isBinActiveToF(
  bin: LiveBinItem,
  station: StationLiveStatus,
): boolean {
  if (!isStationLive(station)) {
    return false;
  }
  if (!hasCachedBinReading(bin)) {
    return false;
  }
  return (bin.reading_source ?? "").toUpperCase() === "HARDWARE";
}

/**
 * Compute sensor health metrics for a single station using its actual configured bins.
 */
export function computeStationSensorHealth(
  station: StationLiveStatus,
): StationSensorHealth {
  const isLive = isStationLive(station);
  const configuredBins = getStationConfiguredBins(station);

  let activeToF = 0;
  let cachedReadings = 0;
  let sensorErrors = 0;
  let simulatedReadings = 0;
  let legacyReadings = 0;

  for (const bin of configuredBins) {
    const opStatus = (bin.operational_status ?? "").toUpperCase();
    const source = (bin.reading_source ?? "").toUpperCase();

    if (opStatus === "SENSOR_ERROR") {
      sensorErrors += 1;
      continue;
    }

    const hasReading = hasCachedBinReading(bin);
    if (hasReading) {
      cachedReadings += 1;
      if (source === "SIMULATED") {
        simulatedReadings += 1;
      } else if (source === "LEGACY") {
        legacyReadings += 1;
      } else if (isLive && source === "HARDWARE") {
        activeToF += 1;
      }
    }
  }

  const totalBins = configuredBins.length;
  const offlineOrNa = totalBins - activeToF;

  return {
    stationId: station.station_id,
    isLive,
    totalBins,
    activeToF,
    offlineOrNa,
    cachedReadings,
    sensorErrors,
    simulatedReadings,
    legacyReadings,
  };
}

/**
 * Compute fleet-wide sensor health metrics across the given stations.
 */
export function computeFleetSensorHealth(
  stations: StationLiveStatus[],
): FleetSensorHealth {
  const perStation: Record<string, StationSensorHealth> = {};
  let totalBins = 0;
  let activeToF = 0;
  let cachedReadings = 0;
  let sensorErrors = 0;
  let simulatedReadings = 0;
  let legacyReadings = 0;

  for (const station of stations) {
    const metrics = computeStationSensorHealth(station);
    perStation[station.station_id] = metrics;
    totalBins += metrics.totalBins;
    activeToF += metrics.activeToF;
    cachedReadings += metrics.cachedReadings;
    sensorErrors += metrics.sensorErrors;
    simulatedReadings += metrics.simulatedReadings;
    legacyReadings += metrics.legacyReadings;
  }

  return {
    totalBins,
    activeToF,
    offlineOrNa: totalBins - activeToF,
    cachedReadings,
    sensorErrors,
    simulatedReadings,
    legacyReadings,
    perStation,
  };
}
