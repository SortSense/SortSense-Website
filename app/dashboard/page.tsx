'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  StationLiveStatus,
  AnalyticsData,
  WasteEvent,
} from '@/components/types';
import CampusMap from '@/components/campus-map';
import StationDetail from '@/components/station-detail';
import StationCard from '@/components/station-card';
import AnalyticsView from '@/components/analytics-view';
import {
  Recycle,
  LayoutDashboard,
  MapPin,
  BarChart3,
  RefreshCw,
  LogOut,
  AlertCircle,
  Radio,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  // Active view tab: 'overview' (Map + Detail), 'analytics', or 'stations'
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'stations'>('overview');

  // State data
  const [stations, setStations] = useState<StationLiveStatus[]>([]);
  const [selectedStation, setSelectedStation] = useState<StationLiveStatus | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentEvents, setRecentEvents] = useState<WasteEvent[]>([]);

  // Polling & loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch all live data (REST polling)
  const fetchDashboardData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);

    try {
      // 1. Fetch live stations
      const statusRes = await fetch('/api/dashboard/live-status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const stationList: StationLiveStatus[] = statusData.stations || [];
        setStations(stationList);

        // Keep selected station updated or pick first station
        setSelectedStation((prev) => {
          if (!prev && stationList.length > 0) return stationList[0];
          if (prev) {
            const found = stationList.find((s) => s.station_id === prev.station_id);
            return found || stationList[0] || null;
          }
          return null;
        });
      }

      // 2. Fetch daily analytics
      const analyticsRes = await fetch('/api/dashboard/analytics');
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }

      // 3. Fetch recent waste events
      const eventsRes = await fetch('/api/dashboard/recent-events?limit=10');
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setRecentEvents(eventsData.events || []);
      }

      setLastUpdated(new Date());
      setErrorMsg(null);
    } catch (err) {
      console.error('Polling error:', err);
      setErrorMsg('Failed to update live dashboard feeds');
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  // Periodic REST polling every 5 seconds (hard constraint: No WebSockets on Vercel)
  useEffect(() => {
    let isSubscribed = true;

    const poll = async () => {
      if (!isSubscribed) return;
      await fetchDashboardData();
    };

    // Trigger initial poll asynchronously
    const initialTimer = setTimeout(() => {
      poll();
    }, 0);

    const interval = setInterval(() => {
      poll();
    }, 5000);

    return () => {
      isSubscribed = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [fetchDashboardData]);

  // Handle staff sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const criticalCount = stations.filter((s) => s.status_color === 'red').length;
  const warningCount = stations.filter((s) => s.status_color === 'yellow').length;

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-sm">
              <Recycle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-gray-900 tracking-tight">SortSense</h1>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Campus Cloud
                </span>
              </div>
              <p className="text-[11px] text-gray-500">Smart Waste &amp; Recycling Operations</p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Live Polling Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-xs text-gray-600 font-medium">
              <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Polling 5s</span>
              <span className="text-gray-300">•</span>
              <span className="font-mono text-gray-400">
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <button
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing}
              title="Manual Refresh"
              className="p-2 text-gray-600 hover:text-emerald-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-red-700 hover:bg-red-50 border border-gray-200 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 border-t border-gray-100">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Campus Map &amp; Stations
            {criticalCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-100 text-red-700 font-mono">
                {criticalCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Recycling Analytics
          </button>

          <button
            onClick={() => setActiveTab('stations')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'stations'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Station Fleet ({stations.length})
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Overview (Campus Map + Selected Station Detail) */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Campus Map (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                <CampusMap
                  stations={stations}
                  selectedStationId={selectedStation?.station_id || null}
                  onSelectStation={(st) => setSelectedStation(st)}
                />
              </div>

              {/* Right Column: Station Detail (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <StationDetail
                  station={selectedStation}
                  onRefresh={() => fetchDashboardData(true)}
                  onStationUpdated={() => fetchDashboardData(true)}
                />

                {/* Quick Station Selector Carousel / List */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Campus Stations Quick Select
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {stations.map((st) => (
                      <StationCard
                        key={st.station_id}
                        station={st}
                        isSelected={selectedStation?.station_id === st.station_id}
                        onSelect={(s) => setSelectedStation(s)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Analytics & Waste Streams */}
        {activeTab === 'analytics' && (
          <AnalyticsView
            analytics={analytics}
            recentEvents={recentEvents}
            isLoading={isLoading && !analytics}
          />
        )}

        {/* Tab 3: Station Fleet Grid */}
        {activeTab === 'stations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Deployed Station Fleet</h3>
                <p className="text-xs text-gray-500">
                  {stations.length} active SortSense stations across campus
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {criticalCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-semibold">
                    {criticalCount} Critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
                    {warningCount} Warning
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stations.map((st) => (
                <div key={st.station_id} className="relative">
                  <StationCard
                    station={st}
                    isSelected={selectedStation?.station_id === st.station_id}
                    onSelect={(s) => {
                      setSelectedStation(s);
                      setActiveTab('overview');
                    }}
                  />
                </div>
              ))}
            </div>

            {selectedStation && (
              <div className="mt-6">
                <h4 className="text-sm font-bold text-gray-900 mb-3">
                  Selected Station Controls: {selectedStation.name}
                </h4>
                <StationDetail
                  station={selectedStation}
                  onRefresh={() => fetchDashboardData(true)}
                  onStationUpdated={() => fetchDashboardData(true)}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <span>SortSense &copy; {new Date().getFullYear()} — Smart Campus Waste Management System</span>
          <div className="flex items-center gap-4">
            <span>FastAPI Backend (/api/)</span>
            <span>•</span>
            <span>Supabase PostgreSQL</span>
            <span>•</span>
            <span>ESP32-S3 Telemetry</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
