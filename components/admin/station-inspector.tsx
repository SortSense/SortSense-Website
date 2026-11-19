'use client';

import React, { useState } from 'react';
import { StationLiveStatus, WasteCategory } from '@/components/types';
import { OperationsCard } from '@/components/ui/operations-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { FillGauge } from '@/components/ui/fill-gauge';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  RefreshCw,
  QrCode,
  Radio,
  Trash2,
  ShieldAlert,
} from 'lucide-react';

interface StationInspectorProps {
  station: StationLiveStatus | null;
  onRefresh: () => void;
}

export function StationInspector({ station, onRefresh }: StationInspectorProps) {
  const [showProvisionModal, setShowProvisionModal] = useState(false);

  // Provisioning form state
  const [name, setName] = useState(station?.name || '');
  const [lat, setLat] = useState(station?.latitude?.toString() || '');
  const [lng, setLng] = useState(station?.longitude?.toString() || '');
  const [isProvisioning, setIsProvisioning] = useState(false);

  if (!station) {
    return (
      <OperationsCard>
        <div className="p-8 text-center text-[#65736A] space-y-2">
          <Radio className="w-8 h-8 mx-auto text-[#176B45]/40" />
          <h4 className="font-bold text-sm text-[#202A25] font-display">No Station Selected</h4>
          <p className="text-xs max-w-xs mx-auto">
            Select a station from the fleet overview to inspect compartment telemetry and maintenance controls.
          </p>
        </div>
      </OperationsCard>
    );
  }

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProvisioning(true);

    try {
      const res = await fetch('/api/bins/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: station.station_id,
          name,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
        }),
      });

      if (res.ok) {
        setShowProvisionModal(false);
        onRefresh();
      }
    } finally {
      setIsProvisioning(false);
    }
  };

  const categories: WasteCategory[] = ['plastic', 'paper', 'metal', 'general'];

  return (
    <OperationsCard
      title={
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-[#202A25] font-display">{station.name}</span>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#EFF2EF] text-[#65736A] font-medium">
            {station.station_id}
          </span>
        </div>
      }
      subtitle={
        <div className="flex items-center gap-2 text-xs text-[#65736A] mt-1">
          {station.latitude && station.longitude ? (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#176B45]" />
              {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
            </span>
          ) : (
            <span className="italic">Coordinates Pending Provisioning</span>
          )}
          <span>•</span>
          <span>
            Heartbeat:{' '}
            {new Date(station.updated_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      }
      action={
        <div className="flex items-center gap-2">
          <StatusBadge
            status={
              station.status_color === 'red'
                ? 'critical'
                : station.status_color === 'yellow'
                ? 'warning'
                : 'normal'
            }
          />
          <button
            onClick={() => {
              setName(station.name);
              setLat(station.latitude?.toString() || '');
              setLng(station.longitude?.toString() || '');
              setShowProvisionModal(true);
            }}
            title="GPS Provisioning"
            className="p-1.5 rounded-lg border border-[#E1E8E1] hover:bg-[#E9F3ED] text-[#176B45] transition-colors"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* 4 Compartment Fill Gauges */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#65736A] uppercase tracking-wider font-display">
            <span>Compartment Fill Gauges</span>
            <span>Max Fill: {station.max_fill_pct}%</span>
          </div>

          <div className="space-y-3">
            {categories.map((cat) => {
              const pct = station.fill_levels[cat] ?? 0;
              return (
                <div
                  key={cat}
                  className="p-3 rounded-lg border border-[#E1E8E1] bg-[#F7F8F4] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1">
                    <FillGauge category={cat} fillPct={pct} />
                  </div>
                  <div className="shrink-0 flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={true}
                      title="Backend RPC Integration In Progress"
                      className="opacity-50 cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#65736A]" />
                      <span className="text-[11px] text-[#65736A]">Empty (Locked)</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Station-Wide Empty Action */}
        <div className="pt-3 border-t border-[#E1E8E1] space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs text-[#65736A]">Reset all 4 compartments at once:</span>
            <Button
              variant="danger"
              size="sm"
              disabled={true}
              title="Backend RPC Integration In Progress"
              className="opacity-50 cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Empty All Compartments (Locked)</span>
            </Button>
          </div>
          <div className="p-3 rounded-xl bg-[#FFF6E4] border border-[#FDE8BF] text-xs text-[#C48419] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-[#C48419]" />
            <span className="text-[11px] leading-relaxed text-[#874B00]">
              <strong>Backend RPC Integration In Progress:</strong> Reset operations require an authenticated
              PostgreSQL RPC transaction and are currently disabled in the UI.
            </span>
          </div>
        </div>
      </div>

      {/* GPS Provisioning Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E1E8E1] shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E1E8E1] pb-3">
              <h3 className="font-bold text-sm text-[#202A25] font-display flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#176B45]" />
                Station GPS Provisioning
              </h3>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-xs text-[#65736A] hover:text-[#202A25]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#65736A]">
              Calibrate installation coordinates for{' '}
              <strong className="font-mono text-[#202A25]">{station.station_id}</strong>.
            </p>

            <form onSubmit={handleProvision} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#202A25] mb-1">
                  Station Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E1E8E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#202A25] mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-[#E1E8E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#202A25] mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-[#E1E8E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45]"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E8E1]">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowProvisionModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isProvisioning}
                >
                  {isProvisioning ? 'Saving...' : 'Save Coordinates'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </OperationsCard>
  );
}
