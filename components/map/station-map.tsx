'use client';

import { useEffect, useRef } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import Link from 'next/link';
import {
  availableCount,
  statusLabels,
  type CategorySlug,
  type Station,
} from '@/lib/categories';

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
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
      if (container.parentElement) {
        resizeObserver.observe(container.parentElement);
      }
    }

    const onWindowResize = () => map.invalidateSize();
    window.addEventListener('resize', onWindowResize);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', onWindowResize);
      resizeObserver?.disconnect();
    };
  }, [map]);

  return null;
}

export interface StationMapProps {
  stations: Station[];
  selected: Station | null;
  category: CategorySlug | 'all';
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
      style={{ width: '100%', height: '100%' }}
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
            pathOptions={{ color: '#4388d6', fillOpacity: 0.06, weight: 1 }}
          />
          <CircleMarker
            center={userLocation}
            radius={7}
            pathOptions={{
              color: '#fff',
              fillColor: '#4388d6',
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
          category === 'all'
            ? undefined
            : station.bins.find((item) => item.category === category);
        const status =
          bin?.status ?? (availableCount(station) ? 'available' : 'unknown');
        const color =
          status === 'available'
            ? '#176B45'
            : status === 'nearly-full'
              ? '#C48419'
              : status === 'full'
                ? '#C84F49'
                : '#7D8881';

        const isSelected = selected?.id === station.id;

        return (
          <CircleMarker
            center={station.coordinates}
            eventHandlers={{ click: () => onSelect(station) }}
            key={station.id}
            radius={isSelected ? 14 : 10}
            pathOptions={{
              color: '#fff',
              fillColor: color,
              fillOpacity: 1,
              weight: isSelected ? 4 : 3,
            }}
          >
            <Popup>
              <div className="map-popup">
                <strong>
                  {station.name}
                  {station.landmark ? ` — ${station.landmark}` : ''}
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
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
