'use client';

import React, { useState } from 'react';
import { StationLiveStatus, WasteCategory } from './types';
import { Trash2, RefreshCw, MapPin, CheckCircle2, AlertTriangle, AlertCircle, QrCode } from 'lucide-react';

interface StationDetailProps {
  station: StationLiveStatus | null;
  onRefresh?: () => void;
  onStationUpdated?: () => void;
}

const CATEGORY_CONFIG: Record<
  WasteCategory,
  { label: string; accentColor: string; bgAccent: string; barColor: string }
> = {
  plastic: {
    label: 'Plastic',
    accentColor: 'text-blue-600',
    bgAccent: 'bg-blue-50 border-blue-200',
    barColor: 'bg-blue-500',
  },
  paper: {
    label: 'Paper',
    accentColor: 'text-amber-600',
    bgAccent: 'bg-amber-50 border-amber-200',
    barColor: 'bg-amber-500',
  },
  metal: {
    label: 'Metal',
    accentColor: 'text-slate-600',
    bgAccent: 'bg-slate-50 border-slate-200',
    barColor: 'bg-slate-500',
  },
  general: {
    label: 'General Waste',
    accentColor: 'text-gray-600',
    bgAccent: 'bg-gray-50 border-gray-200',
    barColor: 'bg-gray-600',
  },
};

export default function StationDetail({
  station,
  onRefresh,
  onStationUpdated,
}: StationDetailProps) {
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [showProvisionModal, setShowProvisionModal] = useState(false);

  // Provisioning form state
  const [provName, setProvName] = useState(station?.name || '');
  const [provLat, setProvLat] = useState(station?.latitude.toString() || '24.7956');
  const [provLng, setProvLng] = useState(station?.longitude.toString() || '120.9923');
  const [isProvisioning, setIsProvisioning] = useState(false);

  if (!station) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-gray-200 shadow-sm min-h-[350px]">
        <MapPin className="w-12 h-12 text-gray-300 mb-3" />
        <h3 className="text-lg font-semibold text-gray-700">No Station Selected</h3>
        <p className="text-sm text-gray-500 max-w-sm mt-1">
          Select a station pin from the campus map or the list to view live compartment fill levels and maintenance controls.
        </p>
      </div>
    );
  }

  // Emptying disabled pending authenticated atomic RPC backend
  const handleEmptyBin = async () => {
    setResetMessage('Backend RPC Integration In Progress: Emptying is temporarily disabled.');
    setTimeout(() => setResetMessage(null), 4000);
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProvisioning(true);

    try {
      const res = await fetch('/api/bins/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: station.station_id,
          name: provName,
          latitude: parseFloat(provLat),
          longitude: parseFloat(provLng),
        }),
      });

      if (res.ok) {
        setShowProvisionModal(false);
        if (onRefresh) onRefresh();
        if (onStationUpdated) onStationUpdated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProvisioning(false);
    }
  };

  const getStatusBadge = (color: 'green' | 'yellow' | 'red') => {
    switch (color) {
      case 'red':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
            <AlertCircle className="w-3.5 h-3.5" />
            Critical (≥85%)
          </span>
        );
      case 'yellow':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning (60-84%)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Normal (&lt;60%)
          </span>
        );
    }
  };

  const categories: WasteCategory[] = ['plastic', 'paper', 'metal', 'general'];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">{station.name}</h2>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
              {station.station_id}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                station.is_online ? 'text-emerald-600' : 'text-gray-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  station.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                }`}
              />
              {station.is_online ? 'Online' : 'Offline'}
            </span>
          </div>

          <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            GPS: {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
            <span className="text-gray-300">•</span>
            Last seen: {new Date(station.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {getStatusBadge(station.status_color)}
          <button
            onClick={() => setShowProvisionModal(true)}
            title="Station Provisioning / Calibration"
            className="p-2 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-gray-200 transition-colors"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {resetMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {resetMessage}
        </div>
      )}

      {/* Compartment Fill Progress Bars */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <span>Compartment Fill Levels</span>
          <span>Max Fill: {station.max_fill_pct}%</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat) => {
            const pct = station.fill_levels[cat] ?? 0;
            const config = CATEGORY_CONFIG[cat];
            const isCritical = pct >= 85;
            const isWarning = pct >= 60 && pct < 85;

            return (
              <div
                key={cat}
                className={`p-4 rounded-xl border transition-all ${
                  isCritical
                    ? 'border-red-300 bg-red-50/40'
                    : isWarning
                    ? 'border-yellow-200 bg-yellow-50/20'
                    : 'border-gray-100 bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${config.barColor}`} />
                    <span className="text-sm font-semibold text-gray-800">{config.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold font-mono ${
                        isCritical ? 'text-red-600' : isWarning ? 'text-yellow-700' : 'text-gray-700'
                      }`}
                    >
                      {pct}%
                    </span>

                    <button
                      onClick={() => handleEmptyBin()}
                      disabled={true}
                      title="Backend RPC Integration In Progress"
                      className="text-xs text-gray-300 p-1 rounded cursor-not-allowed opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCritical
                        ? 'bg-red-500'
                        : isWarning
                        ? 'bg-yellow-500'
                        : config.barColor
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>

                <div className="flex justify-between items-center mt-2 text-[11px] text-gray-400 font-medium">
                  <span>ToF Distance Sensor</span>
                  <span>{isCritical ? 'Needs Collection' : isWarning ? 'Nearing Full' : 'OK'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset Action Button Bar */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          Janitor maintenance: manually mark compartments as collected and emptied.
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleEmptyBin()}
            disabled={true}
            title="Backend RPC Integration In Progress"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gray-400 cursor-not-allowed shadow-sm opacity-60"
          >
            <RefreshCw className="w-4 h-4" />
            Empty All Compartments (Locked)
          </button>
        </div>
      </div>

      {/* QR Provisioning Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-600" />
                Station GPS Provisioning
              </h3>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Update the installation coordinates for <span className="font-mono font-bold">{station.station_id}</span> via smartphone GPS onboarding or manual entry.
            </p>

            <form onSubmit={handleProvision} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Station Name</label>
                <input
                  type="text"
                  value={provName}
                  onChange={(e) => setProvName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={provLat}
                    onChange={(e) => setProvLat(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={provLng}
                    onChange={(e) => setProvLng(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProvisioning}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50"
                >
                  {isProvisioning ? 'Saving...' : 'Save Coordinates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
