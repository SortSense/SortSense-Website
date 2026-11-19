'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Loader2,
  ShieldAlert,
  LogOut,
} from 'lucide-react';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'inactive' | 'invalid_role';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  // Authentication & Profile authorization state
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authenticatedRole, setAuthenticatedRole] = useState<UserRole | null>(null);
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [userName, setUserName] = useState<string>('Staff User');
  const [authError, setAuthError] = useState<string | null>(null);

  // View & UI states
  const [currentView, setCurrentView] = useState<string>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Live Telemetry & Data states
  const [stations, setStations] = useState<StationLiveStatus[]>([]);
  const [selectedStation, setSelectedStation] = useState<StationLiveStatus | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentEvents, setRecentEvents] = useState<WasteEvent[]>([]);

  // Polling state & In-flight guard
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  // Load authenticated staff profile from Supabase with strict authorization validation
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          setAuthStatus('unauthenticated');
          router.push('/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, full_name, role, is_active')
          .eq('user_id', user.id)
          .single();

        if (profileError || !profile) {
          setAuthStatus('unauthenticated');
          setAuthError('Staff profile not found in database. Contact facility administration.');
          return;
        }

        if (!profile.is_active) {
          setAuthStatus('inactive');
          setAuthError('Your staff account is currently inactive. Contact your supervisor.');
          return;
        }

        const dbRole = profile.role?.toUpperCase();
        if (dbRole !== 'ADMIN' && dbRole !== 'JANITOR') {
          setAuthStatus('invalid_role');
          setAuthError(`Invalid role "${profile.role}" configured. Must be ADMIN or JANITOR.`);
          return;
        }

        const validRole = dbRole as UserRole;
        setAuthenticatedRole(validRole);
        setRole(validRole);
        if (validRole === 'JANITOR') {
          setCurrentView('priority');
        } else {
          setCurrentView('overview');
        }
        if (profile.full_name) {
          setUserName(profile.full_name);
        }
        setAuthStatus('authenticated');
      } catch (err) {
        console.warn('Profile fetch note:', err);
        setAuthStatus('unauthenticated');
        setAuthError('Failed to verify authentication credentials.');
      }
    }
    loadProfile();
  }, [supabase, router]);

  // REST polling using Promise.allSettled with in-flight guard and independent resource handling
  const fetchDashboardData = useCallback(async (isManual = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (isManual) setIsPolling(true);

    try {
      const [statusResult, analyticsResult, eventsResult] = await Promise.allSettled([
        fetch('/api/dashboard/live-status'),
        fetch('/api/dashboard/analytics'),
        fetch('/api/dashboard/recent-events?limit=15'),
      ]);

      let hasSuccess = false;
      const failedFeeds: string[] = [];

      // 1. Live Stations
      if (statusResult.status === 'fulfilled' && statusResult.value.ok) {
        const data = await statusResult.value.json();
        const list: StationLiveStatus[] = data.stations || [];
        setStations(list);

        setSelectedStation((prev) => {
          if (!prev && list.length > 0) return list[0];
          if (prev) {
            return list.find((s) => s.station_id === prev.station_id) || list[0] || null;
          }
          return null;
        });
        hasSuccess = true;
      } else {
        failedFeeds.push('station telemetry');
      }

      // 2. Daily Analytics
      if (analyticsResult.status === 'fulfilled' && analyticsResult.value.ok) {
        const data = await analyticsResult.value.json();
        setAnalytics(data);
        hasSuccess = true;
      } else {
        failedFeeds.push('recycling analytics');
      }

      // 3. Recent verified drop events
      if (eventsResult.status === 'fulfilled' && eventsResult.value.ok) {
        const data = await eventsResult.value.json();
        setRecentEvents(data.events || []);
        hasSuccess = true;
      } else {
        failedFeeds.push('disposal activity logs');
      }

      if (hasSuccess) {
        setLastUpdated(new Date());
        if (failedFeeds.length === 0) {
          setErrorMsg(null);
        } else {
          setErrorMsg(`Partial update: Could not refresh ${failedFeeds.join(', ')}.`);
        }
      } else {
        setErrorMsg('Failed to update live dashboard feeds.');
      }
    } catch {
      setErrorMsg('Network error communicating with the Cloud API.');
    } finally {
      isFetchingRef.current = false;
      if (isManual) setIsPolling(false);
    }
  }, []);

  // Periodic REST polling every 5 seconds (paused when tab hidden, guarded by in-flight ref)
  useEffect(() => {
    if (authStatus !== 'authenticated') return;

    let isSubscribed = true;

    const poll = async () => {
      if (!isSubscribed) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      await fetchDashboardData();
    };

    // Initial poll
    poll();

    // 5-second interval
    const interval = setInterval(() => {
      poll();
    }, 5000);

    // Refresh immediately when user returns to this browser tab
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && isSubscribed) {
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authStatus, fetchDashboardData]);

  // Handle Sign Out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Switch role preview (strictly restricted to authenticated ADMIN users)
  const handleRoleToggle = (newRole: UserRole) => {
    if (authenticatedRole !== 'ADMIN') return;
    setRole(newRole);
    if (newRole === 'JANITOR') {
      setCurrentView('priority');
    } else {
      setCurrentView('overview');
    }
  };

  // Loading state during profile verification
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#F7F8F4] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#176B45] text-white flex items-center justify-center font-bold text-xl shadow-md mb-4">
          S
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#202A25]">
          <Loader2 className="w-4 h-4 animate-spin text-[#176B45]" />
          <span>Verifying staff session &amp; role permissions...</span>
        </div>
        <p className="text-xs text-[#65736A] mt-2">Connecting to SortSense operations console</p>
      </div>
    );
  }

  // Account inactive or invalid role error screen
  if (authStatus === 'inactive' || authStatus === 'invalid_role') {
    return (
      <div className="min-h-screen bg-[#F7F8F4] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#FADAD7] p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#FFF0EE] text-[#C84F49] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#202A25] font-display">Access Denied</h2>
          <p className="text-xs text-[#65736A] leading-relaxed">
            {authError || 'Your account does not have permission to access the operations console.'}
          </p>
          <div className="pt-2">
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#EFF2EF] text-[#202A25] hover:bg-[#E1E8E1] transition-colors flex items-center gap-2 mx-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out &amp; Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Strictly enforce that Janitors can never see admin views even if requested
  const effectiveView =
    role === 'JANITOR' &&
    (currentView === 'overview' ||
      currentView === 'sensors' ||
      currentView === 'analytics' ||
      currentView === 'disposal-history' ||
      currentView === 'locations' ||
      currentView === 'staff')
      ? 'priority'
      : currentView;

  const criticalCount = stations.filter((s) => s.status_color === 'red').length;

  return (
    <div className="min-h-screen bg-[#F7F8F4] text-[#202A25] flex">
      {/* Sidebar Navigation */}
      <AppSidebar
        role={role}
        currentView={effectiveView}
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
          authenticatedRole={authenticatedRole}
          userName={userName}
          isPolling={isPolling}
          lastUpdated={lastUpdated}
          onRefresh={() => fetchDashboardData(true)}
          onSignOut={handleSignOut}
          onToggleMobileMenu={() => setIsMobileMenuOpen((v) => !v)}
          onToggleRolePreview={authenticatedRole === 'ADMIN' ? handleRoleToggle : undefined}
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
          {effectiveView === 'priority' && (
            <PriorityQueue
              stations={stations}
              onRefresh={() => fetchDashboardData(true)}
            />
          )}

          {/* ==================================================== */}
          {/* VIEW: System Overview (Default for ADMIN) */}
          {/* ==================================================== */}
          {effectiveView === 'overview' && (
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
          {effectiveView === 'stations' && (
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
          {effectiveView === 'analytics' && (
            <AnalyticsView
              analytics={analytics}
              recentEvents={recentEvents}
            />
          )}

          {/* ==================================================== */}
          {/* VIEW: AI Verified Disposal History */}
          {/* ==================================================== */}
          {effectiveView === 'disposal-history' && (
            <DisposalHistoryView events={recentEvents} />
          )}

          {/* ==================================================== */}
          {/* VIEW: Sensor Diagnostics */}
          {/* ==================================================== */}
          {effectiveView === 'sensors' && (
            <HardwareDiagnostics stations={stations} />
          )}

          {/* ==================================================== */}
          {/* VIEW: Campus Locations (Database Entity) */}
          {/* ==================================================== */}
          {effectiveView === 'locations' && (
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
          {effectiveView === 'staff' && (
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

          {effectiveView === 'my-history' && (
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

          {effectiveView === 'report-fault' && (
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
