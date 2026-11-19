'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  StationLiveStatus,
  AnalyticsData,
  WasteEvent,
} from '@/components/types';
import { AppSidebar, UserRole } from '@/components/shell/app-sidebar';
import { AppHeader } from '@/components/shell/app-header';
import { StationLocationGrid } from '@/components/ui/station-location-grid';
import { StationInspector } from '@/components/admin/station-inspector';
import { PriorityQueue } from '@/components/janitor/priority-queue';
import { HardwareDiagnostics } from '@/components/admin/hardware-diagnostics';
import { DisposalHistoryView } from '@/components/admin/disposal-history-view';
import AnalyticsView from '@/components/analytics-view';
import { OperationsCard } from '@/components/ui/operations-card';
import {
  MapPin,
  Users,
  History,
  Wrench,
  Info,
  AlertCircle,
  Database,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  // Role and Profile state (strictly uppercase 'ADMIN' | 'JANITOR')
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [userName, setUserName] = useState<string>('Staff User');
  const [currentView, setCurrentView] = useState<string>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Live Telemetry & Data states
  const [stations, setStations] = useState<StationLiveStatus[]>([]);
  const [selectedStation, setSelectedStation] = useState<StationLiveStatus | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentEvents, setRecentEvents] = useState<WasteEvent[]>([]);

  // Polling state
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load authenticated staff profile from Supabase
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, full_name, role, is_active')
            .eq('user_id', user.id)
            .single();

          if (profile && profile.is_active) {
            const dbRole = profile.role?.toUpperCase();
            if (dbRole === 'JANITOR' || dbRole === 'ADMIN') {
              setRole(dbRole as UserRole);
              if (dbRole === 'JANITOR') {
                setCurrentView('priority');
              }
            }
            if (profile.full_name) {
              setUserName(profile.full_name);
            }
          }
        }
      } catch (err) {
        console.warn('Profile fetch note:', err);
      }
    }
    loadProfile();
  }, [supabase]);

  // REST polling for live station status, analytics, and drop events
  const fetchDashboardData = useCallback(async (isManual = false) => {
    if (isManual) setIsPolling(true);

    try {
      // 1. Live Stations
      const statusRes = await fetch('/api/dashboard/live-status');
      if (statusRes.ok) {
        const data = await statusRes.json();
        const list: StationLiveStatus[] = data.stations || [];
        setStations(list);

        setSelectedStation((prev) => {
          if (!prev && list.length > 0) return list[0];
          if (prev) {
            return list.find((s) => s.station_id === prev.station_id) || list[0] || null;
          }
          return null;
        });
      }

      // 2. Daily Analytics
      const analyticsRes = await fetch('/api/dashboard/analytics');
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }

      // 3. Recent verified drop events
      const eventsRes = await fetch('/api/dashboard/recent-events?limit=15');
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setRecentEvents(data.events || []);
      }

      setLastUpdated(new Date());
      setErrorMsg(null);
    } catch {
      setErrorMsg('Failed to update live dashboard feeds.');
    } finally {
      if (isManual) setIsPolling(false);
    }
  }, []);

  // Periodic REST polling every 5 seconds (Vercel constraint: zero WebSockets)
  useEffect(() => {
    let isSubscribed = true;

    const poll = async () => {
      if (!isSubscribed) return;
      await fetchDashboardData();
    };

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

  // Handle Sign Out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Switch role preview
  const handleRoleToggle = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'JANITOR') {
      setCurrentView('priority');
    } else {
      setCurrentView('overview');
    }
  };

  const criticalCount = stations.filter((s) => s.status_color === 'red').length;

  return (
    <div className="min-h-screen bg-[#F7F8F4] text-[#202A25] flex">
      {/* Sidebar Navigation */}
      <AppSidebar
        role={role}
        currentView={currentView}
        onSelectView={setCurrentView}
        criticalCount={criticalCount}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Header */}
        <AppHeader
          role={role}
          userName={userName}
          isPolling={isPolling}
          lastUpdated={lastUpdated}
          onRefresh={() => fetchDashboardData(true)}
          onSignOut={handleSignOut}
          onToggleMobileMenu={() => setIsMobileMenuOpen((v) => !v)}
          onToggleRolePreview={handleRoleToggle}
        />

        {/* Operational Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {errorMsg && (
            <div className="p-3 bg-[#FFF0EE] border border-[#FADAD7] rounded-xl text-[#C84F49] text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW: Janitor Priority Bins (Default for JANITOR) */}
          {/* ==================================================== */}
          {currentView === 'priority' && (
            <PriorityQueue
              stations={stations}
              onRefresh={() => fetchDashboardData(true)}
            />
          )}

          {/* ==================================================== */}
          {/* VIEW: System Overview (Default for ADMIN) */}
          {/* ==================================================== */}
          {currentView === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Station Fleet Grid (7 cols) */}
                <div className="lg:col-span-7">
                  <StationLocationGrid
                    stations={stations}
                    selectedStationId={selectedStation?.station_id || null}
                    onSelectStation={(st) => setSelectedStation(st)}
                  />
                </div>

                {/* Selected Station Inspector (5 cols) */}
                <div className="lg:col-span-5">
                  <StationInspector
                    station={selectedStation}
                    onRefresh={() => fetchDashboardData(true)}
                  />
                </div>
              </div>

              {/* Bottom Quick Analytics & Drop Stream */}
              <DisposalHistoryView events={recentEvents.slice(0, 5)} />
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW: Station Fleet & Bins */}
          {/* ==================================================== */}
          {currentView === 'stations' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7">
                  <StationLocationGrid
                    stations={stations}
                    selectedStationId={selectedStation?.station_id || null}
                    onSelectStation={(st) => setSelectedStation(st)}
                  />
                </div>
                <div className="lg:col-span-5">
                  <StationInspector
                    station={selectedStation}
                    onRefresh={() => fetchDashboardData(true)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW: Recycling Analytics */}
          {/* ==================================================== */}
          {currentView === 'analytics' && (
            <AnalyticsView
              analytics={analytics}
              recentEvents={recentEvents}
            />
          )}

          {/* ==================================================== */}
          {/* VIEW: AI Verified Disposal History */}
          {/* ==================================================== */}
          {currentView === 'disposal-history' && (
            <DisposalHistoryView events={recentEvents} />
          )}

          {/* ==================================================== */}
          {/* VIEW: Sensor Diagnostics */}
          {/* ==================================================== */}
          {currentView === 'sensors' && (
            <HardwareDiagnostics stations={stations} />
          )}

          {/* ==================================================== */}
          {/* VIEW: Campus Locations (Database Entity) */}
          {/* ==================================================== */}
          {currentView === 'locations' && (
            <OperationsCard
              title={
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#176B45]" />
                  <span>Campus Locations Registry</span>
                </div>
              }
              subtitle="Registered physical zones and building departments from the Supabase locations table"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stations.map((st) => (
                    <div
                      key={st.station_id}
                      className="p-4 rounded-xl border border-[#E1E8E1] bg-[#F7F8F4] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-[#202A25] font-display">
                          {st.name}
                        </h4>
                        <span className="font-mono text-xs text-[#176B45] font-bold">
                          {st.station_id}
                        </span>
                      </div>
                      <p className="text-xs text-[#65736A]">
                        {st.latitude && st.longitude
                          ? `Coordinates: ${st.latitude.toFixed(4)}, ${st.longitude.toFixed(4)}`
                          : 'Coordinates: Awaiting GPS Provisioning'}
                      </p>
                      <div className="text-[11px] text-[#65736A] pt-1">
                        Capacity: 4 Monitored Compartments (Plastic, Paper, Metal, General)
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-white border border-[#E1E8E1] text-xs text-[#65736A] flex items-start gap-2">
                  <Database className="w-4 h-4 text-[#176B45] shrink-0 mt-0.5" />
                  <p>
                    <strong>Database Architecture:</strong> Locations are grouped in the{' '}
                    <code>public.locations</code> table. Each location maps to one or more units in{' '}
                    <code>public.stations</code>. Additions require administrative database authorization.
                  </p>
                </div>
              </div>
            </OperationsCard>
          )}

          {/* ==================================================== */}
          {/* PENDING BACKEND VIEWS (Honest Architecture) */}
          {/* ==================================================== */}
          {currentView === 'staff' && (
            <OperationsCard
              title={
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#176B45]" />
                  <span>Staff Account Administration</span>
                </div>
              }
              subtitle="User access management linked to Supabase Auth and profiles entity"
            >
              <div className="p-6 text-center space-y-3 bg-[#F7F8F4] rounded-xl border border-[#E1E8E1]">
                <Info className="w-6 h-6 text-[#176B45] mx-auto" />
                <h4 className="font-bold text-sm text-[#202A25] font-display">
                  Administrative Endpoint Pending
                </h4>
                <p className="text-xs text-[#65736A] max-w-md mx-auto leading-relaxed">
                  Managing staff profiles (assigning <code>ADMIN</code> vs <code>JANITOR</code> roles and toggle of{' '}
                  <code>is_active</code>) requires administrative service-role operations. This view is reserved for
                  the upcoming staff management API module.
                </p>
              </div>
            </OperationsCard>
          )}

          {currentView === 'my-history' && (
            <OperationsCard
              title={
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#176B45]" />
                  <span>Personal Emptying History</span>
                </div>
              }
              subtitle="Historical maintenance records logged in bin_emptying_events"
            >
              <div className="p-6 text-center space-y-3 bg-[#F7F8F4] rounded-xl border border-[#E1E8E1]">
                <Info className="w-6 h-6 text-[#176B45] mx-auto" />
                <h4 className="font-bold text-sm text-[#202A25] font-display">
                  Backend Query Integration In Progress
                </h4>
                <p className="text-xs text-[#65736A] max-w-md mx-auto leading-relaxed">
                  Emptying activities recorded via the Priority Queue are securely written to{' '}
                  <code>bin_emptying_events</code>. A dedicated authenticated query endpoint will display your
                  individual shift audit trail once deployed.
                </p>
              </div>
            </OperationsCard>
          )}

          {currentView === 'report-fault' && (
            <OperationsCard
              title={
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#9A3412]" />
                  <span>Report Sensor or Hardware Fault</span>
                </div>
              }
              subtitle="Log hardware issues for physical inspection by engineering staff"
            >
              <div className="p-6 text-center space-y-3 bg-[#F7F8F4] rounded-xl border border-[#E1E8E1]">
                <Info className="w-6 h-6 text-[#176B45] mx-auto" />
                <h4 className="font-bold text-sm text-[#202A25] font-display">
                  Maintenance Ticket Endpoint Pending
                </h4>
                <p className="text-xs text-[#65736A] max-w-md mx-auto leading-relaxed">
                  Hardware fault tickets will connect directly to maintenance dispatch. If a ToF sensor is currently
                  occluded or malfunctioning, note it during collection in the Priority Queue.
                </p>
              </div>
            </OperationsCard>
          )}
        </main>
      </div>
    </div>
  );
}
