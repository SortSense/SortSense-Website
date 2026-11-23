"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  StationLiveStatus,
  AnalyticsData,
  WasteEvent,
  WasteCategory,
} from "@/components/types";
import { PublicHeader } from "@/components/shell/public-header";
import { StationLocationGrid } from "@/components/ui/station-location-grid";
import { StationInspector } from "@/components/admin/station-inspector";
import { StationManagement } from "@/components/admin/station-management";
import { PriorityQueue } from "@/components/janitor/priority-queue";
import { HardwareDiagnostics } from "@/components/admin/hardware-diagnostics";
import { DisposalHistoryView } from "@/components/admin/disposal-history-view";
import AnalyticsView from "@/components/analytics-view";
import { StationTelemetryControl } from "@/components/janitor/station-telemetry-control";
import {
  PriorityPickupWidget,
  RecentAiEventsWidget,
} from "@/components/janitor/bento-side-panels";
import { computeFleetSensorHealth } from "@/lib/sensor-health";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Cpu,
  FileCheck2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

type UserRole = "ADMIN" | "JANITOR";
type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "inactive"
  | "invalid_role";

const COMPARTMENTS: WasteCategory[] = ["plastic", "paper", "metal", "general"];

function sortStationsPriority(list: StationLiveStatus[]): StationLiveStatus[] {
  return [...list].sort((a, b) => {
    const aCalibrated =
      typeof a.latitude === "number" &&
      typeof a.longitude === "number" &&
      (a.latitude !== 0 || a.longitude !== 0);
    const bCalibrated =
      typeof b.latitude === "number" &&
      typeof b.longitude === "number" &&
      (b.latitude !== 0 || b.longitude !== 0);
    if (aCalibrated !== bCalibrated) return aCalibrated ? -1 : 1;

    const aTest =
      /\btest\b/i.test(a.name) || /\btest\b/i.test(a.station_id);
    const bTest =
      /\btest\b/i.test(b.name) || /\btest\b/i.test(b.station_id);
    if (aTest !== bTest) return aTest ? 1 : -1;

    if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Authentication & Profile authorization state
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authenticatedRole, setAuthenticatedRole] = useState<UserRole | null>(
    null,
  );
  const [userName, setUserName] = useState<string>("Staff User");
  const [authError, setAuthError] = useState<string | null>(null);

  // View & Station Filter States
  const [currentView, setCurrentView] = useState<string>("overview");
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [focusedStationId, setFocusedStationId] = useState<string | null>(null);

  // Live Telemetry & Data states
  const [stations, setStations] = useState<StationLiveStatus[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentEvents, setRecentEvents] = useState<WasteEvent[]>([]);

  // Polling, Toast & In-flight guard
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  // Auto-dismiss top toast after 5 seconds
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 5000);
    return () => clearTimeout(t);
  }, [toastMsg]);

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

        setAuthenticatedRole(dbRole as UserRole);
        setCurrentView("overview");
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
              ? fetch("/api/dashboard/recent-events?limit=20", {
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
              ? fetch("/api/dashboard/recent-events?limit=20", {
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
          const prioritized = sortStationsPriority(data.stations || []);
          setStations(prioritized);
          setFocusedStationId((prev) => {
            if (prev && prioritized.some((s) => s.station_id === prev)) {
              return prev;
            }
            return prioritized[0]?.station_id ?? null;
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

    poll();

    const interval = setInterval(() => {
      poll();
    }, 5000);

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

  // Scoped stations & events based on top Station Selector dropdown
  const scopedStations = useMemo(() => {
    if (stationFilter === "all") return stations;
    const match = stations.filter((s) => s.station_id === stationFilter);
    return match.length > 0 ? match : stations;
  }, [stations, stationFilter]);

  const scopedEvents = useMemo(() => {
    if (stationFilter === "all") return recentEvents;
    return recentEvents.filter((evt) => evt.station_id === stationFilter);
  }, [recentEvents, stationFilter]);

  const activeStation = useMemo(() => {
    if (stationFilter !== "all") {
      return (
        stations.find((s) => s.station_id === stationFilter) ??
        stations[0] ??
        null
      );
    }
    return (
      stations.find((s) => s.station_id === focusedStationId) ??
      stations[0] ??
      null
    );
  }, [stations, stationFilter, focusedStationId]);

  // KPI computations (actual configured bins via computeFleetSensorHealth; never assumes 4 slots/station)
  const kpi = useMemo(() => {
    const totalStations = scopedStations.length;
    const onlineStations = scopedStations.filter(
      (s) => s.is_online && !s.is_stale,
    ).length;

    const sensorHealth = computeFleetSensorHealth(scopedStations);

    let criticalBins = 0;
    scopedStations.forEach((st) => {
      COMPARTMENTS.forEach((cat) => {
        const fill = st.fill_levels[cat];
        const hasErr = Boolean(st.sensor_error_categories?.includes(cat));
        if (
          !hasErr &&
          fill !== null &&
          fill !== undefined &&
          !Number.isNaN(fill) &&
          fill >= 80
        ) {
          criticalBins += 1;
        }
      });
    });

    const eventsLogged =
      stationFilter === "all" && analytics
        ? analytics.total_items_today
        : scopedEvents.length;

    const avgConfidence =
      scopedEvents.length > 0
        ? Math.round(
            (scopedEvents.reduce(
              (sum, evt) =>
                sum + (evt.confidence <= 1 ? evt.confidence * 100 : evt.confidence),
              0,
            ) /
              scopedEvents.length),
          )
        : null;

    return {
      totalStations,
      onlineStations,
      criticalBins,
      totalBins: sensorHealth.totalBins,
      activeToF: sensorHealth.activeToF,
      offlineOrNa: sensorHealth.offlineOrNa,
      cachedReadings: sensorHealth.cachedReadings,
      eventsLogged,
      avgConfidence,
    };
  }, [scopedStations, scopedEvents, analytics, stationFilter]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Loading state during profile verification
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#F8F9F6] flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#14532D] text-white flex items-center justify-center font-bold text-xl shadow-md mb-4 font-jakarta">
            S
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#14231B]">
            <Loader2 className="w-4 h-4 animate-spin text-[#14532D]" />
            <span>Verifying staff session &amp; role permissions...</span>
          </div>
          <p className="text-xs text-[#65736A] mt-2">
            Connecting to SortSense Operations Console
          </p>
        </div>
      </div>
    );
  }

  // Account inactive or invalid role error screen
  if (authStatus === "inactive" || authStatus === "invalid_role") {
    return (
      <div className="min-h-screen bg-[#F8F9F6] flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-[#FADAD7] p-8 max-w-md w-full text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#FFF0EE] text-[#C84F49] flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#14231B] font-jakarta">
              Access Denied
            </h2>
            <p className="text-xs text-[#65736A] leading-relaxed">
              {authError ||
                "Your account does not have permission to access the operations console."}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 text-xs font-semibold rounded-full bg-[#EFF2EF] text-[#14231B] hover:bg-[#E1E8E1] transition-colors inline-flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out &amp; Return Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const role: UserRole = authenticatedRole ?? "JANITOR";
  const isAdmin = role === "ADMIN";

  const navTabs = isAdmin
    ? [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        {
          id: "priority",
          label: "Priority Queue",
          icon: AlertOctagon,
          badge: kpi.criticalBins > 0 ? kpi.criticalBins : undefined,
        },
        { id: "stations", label: "Station Management", icon: Radio },
        { id: "analytics", label: "Analytics", icon: BarChart3 },
        { id: "disposal-history", label: "Disposal History", icon: FileCheck2 },
      ]
    : [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        {
          id: "priority",
          label: "Priority Queue",
          icon: AlertOctagon,
          badge: kpi.criticalBins > 0 ? kpi.criticalBins : undefined,
        },
      ];

  const allowedTabIds = new Set(navTabs.map((t) => t.id));
  const effectiveView = allowedTabIds.has(currentView)
    ? currentView
    : "overview";

  return (
    <div className="min-h-screen bg-[#F8F9F6] text-[#1A2620] flex flex-col">
      {/* Shared Public Navbar (avatar popover + rounded-full Find a Bin untouched) */}
      <PublicHeader />

      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Global Emptying Confirmation Toast */}
        {toastMsg && (
          <div
            role="status"
            className="rounded-2xl bg-[#14532D] text-white px-4 py-3 text-xs font-semibold shadow-md flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#A7F3D0]" />
              {toastMsg}
            </span>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="text-white/75 hover:text-white text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="px-4 py-2.5 bg-[#FFF0EE] border border-[#FADAD7] rounded-2xl text-[#B93832] text-xs font-medium flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* 1. COMPACT OPERATIONS HEADER BAR (HorizonHub Structure)      */}
        {/* ============================================================ */}
        <section className="bg-white rounded-2xl border border-[#E5EAE4] px-5 py-4 shadow-[0_1px_3px_rgba(20,83,45,0.03)] space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Greeting + Role Badge + Live Telemetry Pill */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-jakarta text-xl sm:text-2xl font-extrabold tracking-tight text-[#14231B]">
                  Operations Console
                </h1>

                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border ${
                    role === "ADMIN"
                      ? "bg-[#E9F4EC] text-[#14532D] border-[#CBE4D3]"
                      : "bg-[#FFF6E4] text-[#9A6310] border-[#FDE8BF]"
                  }`}
                >
                  {role}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F8F4] border border-[#D8E8DD] px-2.5 py-0.5 text-[11px] font-semibold text-[#14532D]">
                  <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-pulse" />
                  Live Campus Telemetry
                </span>
              </div>

              <p className="text-xs text-[#617067] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>
                  Welcome back, <strong className="text-[#1A2620]">{userName}</strong>
                </span>
                <span className="text-[#D4DDD6]">•</span>
                <span className="font-mono text-[11px]">
                  {lastUpdated
                    ? `Synced ${lastUpdated.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })} (5s auto)`
                    : "Syncing live telemetry…"}
                </span>
              </p>
            </div>

            {/* Right: Station Selector Dropdown + Manual Refresh */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="relative">
                <select
                  aria-label="Filter by station"
                  value={stationFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStationFilter(val);
                    if (val !== "all") {
                      setFocusedStationId(val);
                    }
                  }}
                  className="appearance-none h-10 pl-3.5 pr-9 rounded-full border border-[#DCE5DC] bg-[#F8F9F6] hover:bg-white text-xs font-semibold text-[#1A2620] focus:outline-none focus:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/12 cursor-pointer transition-colors"
                >
                  <option value="all">
                    All Stations ({stations.length})
                  </option>
                  {stations.map((st) => (
                    <option key={st.station_id} value={st.station_id}>
                      {st.station_id} — {st.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#5E6D64] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>

              <button
                type="button"
                onClick={() => fetchDashboardData(true)}
                disabled={isPolling}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-[#DCE5DC] bg-white hover:bg-[#F3F7F4] text-xs font-semibold text-[#14532D] transition-colors disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isPolling ? "animate-spin" : ""}`}
                />
                <span>{isPolling ? "Refreshing…" : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* Segmented View Tabs inside Operations Header */}
          <div
            className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-[#EFF3EE]"
            role="tablist"
            aria-label="Operations Console sections"
          >
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = effectiveView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setCurrentView(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-[#14532D] text-white shadow-xs"
                      : "bg-transparent text-[#55655C] hover:bg-[#F2F6F2] hover:text-[#14532D]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono ${
                        isActive
                          ? "bg-white text-[#C84F49]"
                          : "bg-[#FFF0EE] text-[#C84F49] border border-[#FAD6D2]"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ============================================================ */}
        {/* 2. 4-CARD KPI STRIP (HorizonHub Structure)                   */}
        {/* ============================================================ */}
        {effectiveView === "overview" && (
          <>
            <section
              aria-label="Key operational indicators"
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
            >
              {/* KPI 1: Active Stations Online */}
              <div className="bg-white rounded-2xl border border-[#E5EAE4] p-4 sm:p-5 shadow-[0_1px_2px_rgba(20,83,45,0.03)] flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#5E6D64]">
                    Active Stations Online
                  </span>
                  <span className="h-8 w-8 rounded-xl bg-[#EEF5F0] text-[#14532D] flex items-center justify-center">
                    <Radio className="w-4 h-4" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-jakarta text-2xl font-extrabold tracking-tight text-[#14231B] tabular-nums">
                    {kpi.onlineStations} / {kpi.totalStations}
                  </span>
                  <span className="text-xs font-semibold text-[#5E6D64]">
                    Online
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      kpi.onlineStations > 0
                        ? "bg-[#16A34A] animate-pulse"
                        : "bg-[#9CA8A0]"
                    }`}
                  />
                  <span
                    className={
                      kpi.onlineStations > 0
                        ? "text-[#14532D]"
                        : "text-[#65736A]"
                    }
                  >
                    {kpi.onlineStations > 0
                      ? "Live heartbeat active"
                      : "Awaiting station heartbeat"}
                  </span>
                </div>
              </div>

              {/* KPI 2: Critical Bins (>= 80%) */}
              <div
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-[0_1px_2px_rgba(20,83,45,0.03)] flex flex-col justify-between gap-3 ${
                  kpi.criticalBins > 0
                    ? "border-[#F7CBC5]"
                    : "border-[#E5EAE4]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#5E6D64]">
                    Critical Bins (≥80%)
                  </span>
                  <span
                    className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                      kpi.criticalBins > 0
                        ? "bg-[#FFF0EE] text-[#C84F49]"
                        : "bg-[#EEF5F0] text-[#14532D]"
                    }`}
                  >
                    <AlertOctagon className="w-4 h-4" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-jakarta text-2xl font-extrabold tracking-tight tabular-nums ${
                      kpi.criticalBins > 0
                        ? "text-[#B93832]"
                        : "text-[#14231B]"
                    }`}
                  >
                    {kpi.criticalBins}
                  </span>
                  <span className="text-xs font-semibold text-[#5E6D64]">
                    {kpi.criticalBins === 1 ? "compartment" : "compartments"}
                  </span>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                      kpi.criticalBins > 0
                        ? "bg-[#FFF0EE] text-[#B93832] border-[#FAD6D2]"
                        : "bg-[#E9F4EC] text-[#14532D] border-[#CBE4D3]"
                    }`}
                  >
                    {kpi.criticalBins > 0
                      ? "Emptying required"
                      : "All compartments healthy"}
                  </span>
                </div>
              </div>

              {/* KPI 3: AI Events Logged */}
              <div className="bg-white rounded-2xl border border-[#E5EAE4] p-4 sm:p-5 shadow-[0_1px_2px_rgba(20,83,45,0.03)] flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#5E6D64]">
                    AI Events Logged
                  </span>
                  <span className="h-8 w-8 rounded-xl bg-[#EEF5F0] text-[#14532D] flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-jakarta text-2xl font-extrabold tracking-tight text-[#14231B] tabular-nums">
                    {isAdmin ? kpi.eventsLogged.toLocaleString() : "—"}
                  </span>
                  <span className="text-xs font-semibold text-[#5E6D64]">
                    {isAdmin
                      ? stationFilter === "all"
                        ? "today"
                        : "recent"
                      : "admin metric"}
                  </span>
                </div>
                <div>
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF5F0] border border-[#D4E7D9] px-2.5 py-0.5 text-[11px] font-bold text-[#14532D]">
                      <Activity className="w-3 h-3" />
                      {kpi.avgConfidence !== null
                        ? `Avg ${kpi.avgConfidence}% AI confidence`
                        : "Awaiting AI drop events"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-[#F3F6F3] border border-[#E1E8E1] px-2.5 py-0.5 text-[11px] font-semibold text-[#65736A]">
                      Field dispatch view
                    </span>
                  )}
                </div>
              </div>

              {/* KPI 4: Sensor Health */}
              <div className="bg-white rounded-2xl border border-[#E5EAE4] p-4 sm:p-5 shadow-[0_1px_2px_rgba(20,83,45,0.03)] flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#5E6D64]">
                    Sensor Health
                  </span>
                  <span className="h-8 w-8 rounded-xl bg-[#EEF5F0] text-[#14532D] flex items-center justify-center">
                    <Cpu className="w-4 h-4" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-jakarta text-2xl font-extrabold tracking-tight text-[#14231B] tabular-nums">
                    {kpi.activeToF} / {kpi.totalBins}
                  </span>
                  <span className="text-xs font-semibold text-[#5E6D64]">
                    Active ToF
                  </span>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                      kpi.totalBins === 0
                        ? "bg-[#EFF2EF] text-[#65736A] border-[#E1E8E1]"
                        : kpi.offlineOrNa > 0
                          ? "bg-[#FFF6E4] text-[#9A6310] border-[#FDE8BF]"
                          : "bg-[#E9F4EC] text-[#14532D] border-[#CBE4D3]"
                    }`}
                  >
                    {kpi.totalBins === 0
                      ? "No bins configured"
                      : kpi.offlineOrNa > 0
                        ? `${kpi.offlineOrNa} offline / N/A`
                        : "All sensors reporting"}
                  </span>
                </div>
              </div>
            </section>

            {/* ======================================================== */}
            {/* 3. BENTO MAIN GRID (Energy Community SaaS Structure)     */}
            {/* ======================================================== */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left / Primary Column (lg:col-span-7): Station Telemetry & Unlocked Emptying */}
              <div className="lg:col-span-7 min-w-0">
                <StationTelemetryControl
                  station={activeStation}
                  stations={stations}
                  showStationPills={stationFilter === "all"}
                  onSelectStation={(id) => setFocusedStationId(id)}
                  onRefresh={() => fetchDashboardData(true)}
                  onEmptySuccess={(msg) => setToastMsg(msg)}
                />
              </div>

              {/* Right Column (lg:col-span-5): Priority Pickup Queue & Live AI Activity Feed */}
              <div className="lg:col-span-5 min-w-0 space-y-5">
                <PriorityPickupWidget
                  stations={scopedStations}
                  onRefresh={() => fetchDashboardData(true)}
                  onSelectStation={(id) => setFocusedStationId(id)}
                  onQuickEmptyToast={(msg) => setToastMsg(msg)}
                />

                <RecentAiEventsWidget
                  events={scopedEvents}
                  canViewEvents={isAdmin}
                />
              </div>
            </section>
          </>
        )}

        {/* ============================================================ */}
        {/* SECONDARY TAB VIEWS (Preserving Full Admin & Janitor Suite)  */}
        {/* ============================================================ */}
        {effectiveView === "priority" && (
          <PriorityQueue
            stations={scopedStations}
            onRefresh={() => fetchDashboardData(true)}
          />
        )}

        {isAdmin && effectiveView === "stations" && (
          <div className="space-y-5">
            <StationManagement
              onDashboardRefresh={() => fetchDashboardData(true)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7">
                <StationLocationGrid
                  stations={stations}
                  selectedStationId={activeStation?.station_id || null}
                  onSelectStation={(st) => setFocusedStationId(st.station_id)}
                />
              </div>
              <div className="lg:col-span-5">
                <StationInspector
                  station={activeStation}
                  onRefresh={() => fetchDashboardData(true)}
                />
              </div>
            </div>

            <HardwareDiagnostics stations={stations} />
          </div>
        )}

        {isAdmin && effectiveView === "analytics" && (
          <AnalyticsView analytics={analytics} recentEvents={scopedEvents} />
        )}

        {isAdmin && effectiveView === "disposal-history" && (
          <DisposalHistoryView events={scopedEvents} />
        )}
      </main>
    </div>
  );
}
