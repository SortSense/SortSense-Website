"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import Link from "next/link";
import {
  availableCount,
  statusLabels,
  type CategorySlug,
  type Station,
} from "@/lib/categories";

const pinIconCache = new Map<string, L.DivIcon>();

function createStationPinIcon(color: string, isSelected: boolean): L.DivIcon {
  const cacheKey = `${color}-${isSelected ? "selected" : "default"}`;
  const cached = pinIconCache.get(cacheKey);
  if (cached) return cached;

  const width = isSelected ? 40 : 32;
  const height = isSelected ? 48 : 40;
  const halo = isSelected
    ? `<span style="position:absolute;top:2px;left:50%;transform:translateX(-50%);width:36px;height:36px;border-radius:9999px;background:${color};opacity:0.22;pointer-events:none;"></span>`
    : "";

  const html = `
    <div style="position:relative;width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 10px rgba(15,40,28,0.28));">
      ${halo}
      <svg width="${width}" height="${height}" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:relative;display:block;">
        <path d="M18 2C9.71573 2 3 8.71573 3 17C3 27.625 18 41.5 18 41.5C18 41.5 33 27.625 33 17C33 8.71573 26.2843 2 18 2Z" fill="${color}" stroke="#FFFFFF" stroke-width="2.5"/>
        <circle cx="18" cy="16.5" r="5.5" fill="#FFFFFF"/>
        <circle cx="18" cy="16.5" r="2.4" fill="${color}"/>
      </svg>
    </div>
  `;

  const icon = L.divIcon({
    html,
    className: "",
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -(height - 4)],
  });
  pinIconCache.set(cacheKey, icon);
  return icon;
}

function MapFocus({ station }: { station: Station | null }) {
  const map = useMap();
  const prevIdRef = useRef<string | null>(station?.id ?? null);

  useEffect(() => {
    if (!station || !station.hasValidCoordinates || !station.coordinates) return;
    if (prevIdRef.current === station.id) {
      map.setView(station.coordinates, map.getZoom(), { animate: false });
    } else {
      prevIdRef.current = station.id;
      map.flyTo(station.coordinates, 17, { duration: 0.6 });
    }
  }, [map, station]);

  return null;
}

function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();

    const rafId = requestAnimationFrame(() => {
      map.invalidateSize();
    });

    const t1 = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    const t2 = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    const t3 = setTimeout(() => {
      map.invalidateSize();
    }, 700);

    let resizeObserver: ResizeObserver | null = null;
    const container = map.getContainer();
    if (typeof ResizeObserver !== "undefined" && container) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
      if (container.parentElement) {
        resizeObserver.observe(container.parentElement);
      }
    }

    const onWindowResize = () => map.invalidateSize();
    window.addEventListener("resize", onWindowResize);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", onWindowResize);
      resizeObserver?.disconnect();
    };
  }, [map]);

  return null;
}

export interface StationMapProps {
  stations: Station[];
  selected: Station | null;
  category: CategorySlug | "all";
  onSelect: (station: Station) => void;
  userLocation?: [number, number] | null;
}

export function StationMap({
  stations,
  selected,
  category,
  onSelect,
  userLocation = null,
}: StationMapProps) {
  const calibratedStations = stations.filter(
    (s): s is Station & { coordinates: [number, number] } =>
      s.hasValidCoordinates && s.coordinates !== null,
  );

  const initialCenter: [number, number] =
    (selected?.hasValidCoordinates && selected.coordinates) ||
    calibratedStations[0]?.coordinates ||
    userLocation ||
    [24.7956, 120.9923];

  return (
    <MapContainer
      center={initialCenter}
      zoom={16}
      scrollWheelZoom
      className="station-map"
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFocus station={selected} />
      <MapResizeHandler />

      {userLocation && (
        <>
          <Circle
            center={userLocation}
            radius={90}
            pathOptions={{ color: "#4388d6", fillOpacity: 0.06, weight: 1 }}
          />
          <CircleMarker
            center={userLocation}
            radius={7}
            pathOptions={{
              color: "#fff",
              fillColor: "#4388d6",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip direction="top">Your current location</Tooltip>
          </CircleMarker>
        </>
      )}

      {calibratedStations.map((station) => {
        const bin =
          category === "all"
            ? undefined
            : station.bins.find((item) => item.category === category);
        const status =
          bin?.status ?? (availableCount(station) ? "available" : "unknown");
        const color =
          status === "available"
            ? "#14532D"
            : status === "nearly-full"
              ? "#C48419"
              : status === "full"
                ? "#C84F49"
                : "#7D8881";

        const isSelected = selected?.id === station.id;
        const pinIcon = createStationPinIcon(color, isSelected);

        return (
          <Marker
            position={station.coordinates}
            icon={pinIcon}
            zIndexOffset={isSelected ? 500 : 100}
            eventHandlers={{ click: () => onSelect(station) }}
            key={station.id}
          >
            <Tooltip direction="top" offset={[0, isSelected ? -44 : -36]}>
              {station.name}
            </Tooltip>
            <Popup>
              <div className="map-popup">
                <strong>
                  {station.name}
                  {station.landmark ? ` — ${station.landmark}` : ""}
                </strong>
                <p>
                  {availableCount(station)} of {station.bins.length} bins
                  available
                </p>
                {bin && (
                  <span>
                    {bin.label}: {statusLabels[bin.status]}
                  </span>
                )}
                <Link href={`/stations/${station.id}`}>View details</Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
