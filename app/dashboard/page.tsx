"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  StationLiveStatus,
  AnalyticsData,
  WasteEvent,
} from "@/components/types";
import { AppSidebar, UserRole } from "@/components/shell/app-sidebar";
import { AppHeader } from "@/components/shell/app-header";
import { StationLocationGrid } from "@/components/ui/station-location-grid";
import { StationInspector } from "@/components/admin/station-inspector";
import { StationManagement } from "@/components/admin/station-management";
import { PriorityQueue } from "@/components/janitor/priority-queue";
import { HardwareDiagnostics } from "@/components/admin/hardware-diagnostics";
import { DisposalHistoryView } from "@/components/admin/disposal-history-view";
import AnalyticsView from "@/components/analytics-view";
import { SortSenseLogo } from "@/components/brand/sort-sense-logo";
import { SpringNumber } from "@/components/motion/spring-primitives";
import { OperationsCard } from "@/components/ui/operations-card";
import {
  AlertCircle,
  Loader2,
  ShieldAlert,
  LogOut,
  ArrowRight,
} from "lucide-react";
import {
  StatusBadge,
  resolveStationOperationalStatus,
} from "@/components/ui/status-badge";

type AuthStatus =
  "loading" | "authenticated" | "unauthenticated" | "inactive" | "invalid_role";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  // Authentication & Profile authorization state
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authenticatedRole, setAuthenticatedRole] = useState<UserRole | null>(
    null,
  );
  const [userName, setUserName] = useState<string>("Staff User");
  const [authError, setAuthError] = useState<string | null>(null);

  // View & UI states
  const [currentView, setCurrentView] = useState<string>("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Live Telemetry & Data states
  const [stations, setStations] = useState<StationLiveStatus[]>([]);
  const [selectedStation, setSelectedStation] =
    useState<StationLiveStatus | null>(null);
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
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          setAuthStatus("unauthenticated");
          router.push("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, full_name, role, is_active")
          .eq("user_id", user.id)
          .single();

        if (profileError || !profile) {
          setAuthStatus("unauthenticated");
          setAuthError(
            "Staff profile not found in database. Contact facility administration.",
          );
          return;
        }

        if (!profile.is_active) {
          setAuthStatus("inactive");
          setAuthError(
            "Your staff account is currently inactive. Contact your supervisor.",
          );
          return;
        }

        const dbRole = profile.role?.toUpperCase();
        if (dbRole !== "ADMIN" && dbRole !== "JANITOR") {
          setAuthStatus("invalid_role");
          setAuthError(
            `Invalid role "${profile.role}" configured. Must be ADMIN or JANITOR.`,
          );
          return;
        }

        const validRole = dbRole as UserRole;
        setAuthenticatedRole(validRole);
        if (validRole === "JANITOR") {
          setCurrentView("janitor-overview");
        } else {
          setCurrentView("overview");
        }
        if (profile.full_name) {
          setUserName(profile.full_name);
        }
        setAuthStatus("authenticated");
      } catch (err) {
        console.warn("Profile fetch note:", err);
        setAuthStatus("unauthenticated");
        setAuthError("Failed to verify authentication credentials.");
      }
    }
    loadProfile();
  }, [supabase, router]);

  // REST polling using Promise.allSettled with in-flight guard and independent resource handling
  const fetchDashboardData = useCallback(
    async (isManual = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (isManual) setIsPolling(true);

      try {
        const isAdmin = authenticatedRole === "ADMIN";
        const {
          data: { session },
        } = await supabase.auth.getSession();

        let activeSession = session;
        const nowEpoch = Math.floor(Date.now() / 1000);
        const isExpiringSoon =
          typeof activeSession?.expires_at === "number" &&
          activeSession.expires_at - nowEpoch < 60;

        if (isAdmin && (!activeSession?.access_token || isExpiringSoon)) {
          const { data: refreshed, error: refreshError } =
            await supabase.auth.refreshSession();
          if (refreshError || !refreshed.session?.access_token) {
            setAuthStatus("unauthenticated");
            router.push("/login");
            return;
          }
          activeSession = refreshed.session;
        }

        const authHeaders: HeadersInit | undefined = activeSession?.access_token
          ? { Authorization: `Bearer ${activeSession.access_token}` }
          : undefined;

        const [statusResult, initialAnalyticsResult, initialEventsResult] =
          await Promise.allSettled([
            fetch("/api/dashboard/live-status", { cache: "no-store" }),
            isAdmin
              ? fetch("/api/dashboard/analytics", {
                  headers: authHeaders,
                  cache: "no-store",
                })
              : Promise.resolve(null),
            isAdmin
              ? fetch("/api/dashboard/recent-events?limit=15", {
                  headers: authHeaders,
                  cache: "no-store",
                })
              : Promise.resolve(null),
          ]);

        let analyticsResult = initialAnalyticsResult;
        let eventsResult = initialEventsResult;

        // Retry a 401 on ADMIN endpoints at most once after refreshing the session
        const analyticsUnauthorized =
          isAdmin &&
          analyticsResult.status === "fulfilled" &&
          analyticsResult.value?.status === 401;
        const eventsUnauthorized =
          isAdmin &&
          eventsResult.status === "fulfilled" &&
          eventsResult.value?.status === 401;

        if (analyticsUnauthorized || eventsUnauthorized) {
          const { data: refreshed, error: refreshError } =
            await supabase.auth.refreshSession();
          const retryToken = refreshed.session?.access_token;
          if (refreshError || !retryToken) {
            setAuthStatus("unauthenticated");
            router.push("/login");
            return;
          }
          const retryHeaders: HeadersInit = {
            Authorization: `Bearer ${retryToken}`,
          };
          const [retryAnalytics, retryEvents] = await Promise.allSettled([
            analyticsUnauthorized
              ? fetch("/api/dashboard/analytics", {
                  headers: retryHeaders,
                  cache: "no-store",
                })
              : Promise.resolve(null),
            eventsUnauthorized
              ? fetch("/api/dashboard/recent-events?limit=15", {
                  headers: retryHeaders,
                  cache: "no-store",
                })
              : Promise.resolve(null),
          ]);
          if (analyticsUnauthorized) analyticsResult = retryAnalytics;
          if (eventsUnauthorized) eventsResult = retryEvents;

          const stillUnauthorized =
            (analyticsUnauthorized &&
              analyticsResult.status === "fulfilled" &&
              analyticsResult.value?.status === 401) ||
            (eventsUnauthorized &&
              eventsResult.status === "fulfilled" &&
              eventsResult.value?.status === 401);
          if (stillUnauthorized) {
            setAuthStatus("unauthenticated");
            router.push("/login");
            return;
          }
        }

        let hasSuccess = false;
        const failedFeeds: string[] = [];

        // 1. Live Stations
        if (statusResult.status === "fulfilled" && statusResult.value.ok) {
          const data = await statusResult.value.json();
          const list: StationLiveStatus[] = data.stations || [];
          setStations(list);

          setSelectedStation((prev) => {
            if (!prev && list.length > 0) return list[0];
            if (prev) {
              return (
                list.find((s) => s.station_id === prev.station_id) ||
                list[0] ||
                null
              );
            }
            return null;
          });
          hasSuccess = true;
        } else {
          failedFeeds.push("station telemetry");
        }

        // 2. Daily Analytics (ADMIN only)
        if (isAdmin) {
          if (
            analyticsResult.status === "fulfilled" &&
            analyticsResult.value &&
            analyticsResult.value.ok
          ) {
            const data = await analyticsResult.value.json();
            setAnalytics(data);
            hasSuccess = true;
          } else {
            failedFeeds.push("recycling analytics");
          }
        }

        // 3. Recent verified drop events (ADMIN only)
        if (isAdmin) {
          if (
            eventsResult.status === "fulfilled" &&
            eventsResult.value &&
            eventsResult.value.ok
          ) {
            const data = await eventsResult.value.json();
            setRecentEvents(data.events || []);
            hasSuccess = true;
          } else {
            failedFeeds.push("disposal activity logs");
          }
        }

        if (hasSuccess) {
          setLastUpdated(new Date());
          if (failedFeeds.length === 0) {
            setErrorMsg(null);
          } else {
            setErrorMsg(
              `Partial update: Could not refresh ${failedFeeds.join(", ")}.`,
            );
          }
        } else {
          setErrorMsg("Failed to update live dashboard feeds.");
        }
      } catch {
        setErrorMsg("Network error communicating with the Cloud API.");
      } finally {
        isFetchingRef.current = false;
        if (isManual) setIsPolling(false);
      }
    },
    [supabase, authenticatedRole, router],
  );

  // Periodic REST polling every 5 seconds (paused when tab hidden, guarded by in-flight ref)
  useEffect(() => {
    if (authStatus !== "authenticated") return;

    let isSubscribed = true;

    const poll = async () => {
      if (!isSubscribed) return;
      if (typeof document !== "undefined" && document.hidden) return;
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
      if (typeof document !== "undefined" && !document.hidden && isSubscribed) {
        poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authStatus, fetchDashboardData]);

  // Handle Sign Out (redirects logged-out users to public home page /)
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Loading state during profile verification
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#F7F8F4] flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-4">
          <SortSenseLogo />
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#202A25]">
          <Loader2 className="w-4 h-4 animate-spin text-[#176B45]" />
          <span>Verifying staff session &amp; role permissions...</span>
        </div>
        <p className="text-xs text-[#65736A] mt-2">
          Connecting to SortSense operations console
        </p>
      </div>
    );
  }

  // Account inactive or invalid role error screen
  if (authStatus === "inactive" || authStatus === "invalid_role") {
    return (
      <div className="min-h-screen bg-[#F7F8F4] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#FADAD7] p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#FFF0EE] text-[#C84F49] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#202A25] font-display">
            Access Denied
          </h2>
          <p className="text-xs text-[#65736A] leading-relaxed">
            {authError ||
              "Your account does not have permission to access the operations console."}
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

  const role: UserRole = authenticatedRole ?? "JANITOR";

  // Strictly enforce role-based view authorization
  const adminViews = new Set([
    "overview",
    "stations",
    "priority",
    "analytics",
    "disposal-history",
  ]);
  const janitorViews = new Set(["janitor-overview", "priority"]);

  const effectiveView =
    role === "ADMIN"
      ? adminViews.has(currentView)
        ? currentView
        : "overview"
      : janitorViews.has(currentView)
        ? currentView
        : "janitor-overview";

  const viewLabels: Record<string, string> = {
    overview: "Overview",
    "janitor-overview": "Overview",
    stations: "Station Management",
    priority: "Priority Queue",
    analytics: "Analytics",
    "disposal-history": "Disposal History",
  };

  const criticalCount = stations.filter((s) => s.status_color === "red").length;
  const onlineCount = stations.filter((s) => s.is_online).length;

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
        <AppHeader
          role={role}
          userName={userName}
          currentViewLabel={viewLabels[effectiveView] ?? "Overview"}
          isPolling={isPolling}
          lastUpdated={lastUpdated}
          onRefresh={() => fetchDashboardData(true)}
          onSignOut={handleSignOut}
          onToggleMobileMenu={() => setIsMobileMenuOpen((v) => !v)}
        />

        {/* Operational Workspace */}
        <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-7xl w-full mx-auto">
          {errorMsg && (
            <div className="px-4 py-2.5 bg-[#FFF0EE] border border-[#FADAD7] rounded-lg text-[#C84F49] text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW: JANITOR Overview                               */}
          {/* ==================================================== */}
          {role === "JANITOR" && effectiveView === "janitor-overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-[#E1E8E1] rounded-lg p-4">
                  <span className="text-[11px] font-semibold text-[#65736A] uppercase tracking-wider block">
                    Monitored Stations
                  </span>
                  <span className="text-2xl font-bold font-mono text-[#202A25] mt-1 block">
                    {stations.length}
                  </span>
                </div>
                <div className="bg-white border border-[#E1E8E1] rounded-lg p-4">
                  <span className="text-[11px] font-semibold text-[#65736A] uppercase tracking-wider block">
                    Online Units
                  </span>
                  <span className="text-2xl font-bold font-mono text-[#176B45] mt-1 block">
                    {onlineCount} / {stations.length}
                  </span>
                </div>
                <div className="bg-white border border-[#E1E8E1] rounded-lg p-4">
                  <span className="text-[11px] font-semibold text-[#65736A] uppercase tracking-wider block">
                    Critical Stations (≥85%)
                  </span>
                  <span className="text-2xl font-bold font-mono text-[#C84F49] mt-1 block">
                    {criticalCount}
                  </span>
                </div>
              </div>

              <OperationsCard
                title="Campus Station Status"
                subtitle="Live compartment fill levels across active stations"
                action={
                  <button
                    onClick={() => setCurrentView("priority")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#176B45] text-white hover:bg-[#0F4C35] transition-colors"
                  >
                    Open Priority Queue
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                }
              >
                {stations.length === 0 ? (
                  <p className="text-xs text-[#65736A] py-4 text-center">
                    No active stations reported.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F7F8F4] text-[#65736A] uppercase tracking-wider font-semibold border-b border-[#E1E8E1]">
                        <tr>
                          <th className="py-2.5 px-3">Station</th>
                          <th className="py-2.5 px-3">Plastic</th>
                          <th className="py-2.5 px-3">Paper</th>
                          <th className="py-2.5 px-3">Metal</th>
                          <th className="py-2.5 px-3">General</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E1E8E1] text-[#202A25]">
                        {stations.map((st) => {
                          const resolved = resolveStationOperationalStatus(st);
                          const fmt = (v: number | null) =>
                            v !== null && v !== undefined ? `${v}%` : "N/A";
                          return (
                            <tr
                              key={st.station_id}
                              className="hover:bg-[#F7F8F4]/60"
                            >
                              <td className="py-3 px-3">
                                <span className="font-semibold block">
                                  {st.name}
                                </span>
                                <span className="font-mono text-[11px] text-[#65736A]">
                                  {st.station_id}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono">
                                {fmt(st.fill_levels.plastic)}
                              </td>
                              <td className="py-3 px-3 font-mono">
                                {fmt(st.fill_levels.paper)}
                              </td>
                              <td className="py-3 px-3 font-mono">
                                {fmt(st.fill_levels.metal)}
                              </td>
                              <td className="py-3 px-3 font-mono">
                                {fmt(st.fill_levels.general)}
                              </td>
                              <td className="py-3 px-3">
                                <StatusBadge
                                  status={resolved.status}
                                  label={resolved.label}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </OperationsCard>
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW: Priority Queue (ADMIN & JANITOR)               */}
          {/* ==================================================== */}
          {effectiveView === "priority" && (
            <PriorityQueue
              stations={stations}
              onRefresh={() => fetchDashboardData(true)}
            />
          )}

          {/* ==================================================== */}
          {/* VIEW: Overview (ADMIN only)                          */}
          {/* ==================================================== */}
          {role === "ADMIN" && effectiveView === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E1E8E1] rounded-xl p-4 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#65736A] uppercase tracking-wider block">
                    Active Stations
                  </span>
                  <span className="text-2xl font-bold font-mono text-[#202A25] mt-1 block">
                    <SpringNumber value={stations.length} />
                  </span>
                </div>
                <div className="bg-white border border-[#E1E8E1] rounded-xl p-4 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#65736A] uppercase tracking-wider block">
                    Online Units
                  </span>
                  <span className="text-2xl font-bold font-mono text-[#176B45] mt-1 block">
                    <SpringNumber value={onlineCount} /> / {stations.length}
                  </span>
                </div>
                <div className="bg-white border border-[#E1E8E1] rounded-xl p-4 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#65736A] uppercase tracking-wider block">
                    Bins ≥80% / Alerts
                  </span>
                  <span className="text-2xl font-bold font-mono text-[#C84F49] mt-1 block">
                    <SpringNumber value={criticalCount} />
                  </span>
                </div>
                <div className="bg-white border border-[#E1E8E1] rounded-xl p-4 shadow-2xs">
                  <span className="text-[11px] font-semibold text-[#65736A] uppercase tracking-wider block">
                    Drops Today
                  </span>
                  <span className="text-2xl font-bold font-mono text-[#202A25] mt-1 block">
                    {analytics ? (
                      <SpringNumber value={analytics.total_items_today} />
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
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

              <DisposalHistoryView events={recentEvents.slice(0, 5)} />
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW: Station Management (ADMIN only)                */}
          {/* ==================================================== */}
          {role === "ADMIN" && effectiveView === "stations" && (
            <div className="space-y-5">
              <StationManagement
                onDashboardRefresh={() => fetchDashboardData(true)}
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
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

              <HardwareDiagnostics stations={stations} />
            </div>
          )}

          {/* ==================================================== */}
          {/* VIEW: Analytics (ADMIN only)                         */}
          {/* ==================================================== */}
          {role === "ADMIN" && effectiveView === "analytics" && (
            <AnalyticsView analytics={analytics} recentEvents={recentEvents} />
          )}

          {/* ==================================================== */}
          {/* VIEW: Disposal History (ADMIN only)                  */}
          {/* ==================================================== */}
          {role === "ADMIN" && effectiveView === "disposal-history" && (
            <DisposalHistoryView events={recentEvents} />
          )}
        </main>
      </div>
    </div>
  );
}
