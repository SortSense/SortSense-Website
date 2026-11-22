"use client";
/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Bot,
  Camera,
  Check,
  ChevronRight,
  Compass,
  Lightbulb,
  LocateFixed,
  MapPin,
  Route,
  ScanLine,
  Signal,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { animated, useSpring } from "@react-spring/web";
import { availableCount, categories } from "@/lib/categories";
import { adaptStation } from "@/lib/station-adapter";
import { PublicHeader } from "@/components/shell/public-header";
import { PublicFooter } from "@/components/shell/public-footer";
import type { LiveStatusResponse, StationLiveStatus } from "@/components/types";

const LOCAL_CAMPUS_PLACEHOLDER = "/images/campus-station-placeholder.svg";
const BINS_STORY_PHOTO =
  "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=85&w=1200";

const categoryVisuals: Record<
  string,
  {
    imageUrl: string;
    alt: string;
    hint: string;
    tintBg: string;
    borderTint: string;
    dotTint: string;
  }
> = {
  plastic: {
    imageUrl:
      "https://images.unsplash.com/photo-1571727153934-b9e0059b7ab2?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
    alt: "Clean transparent plastic bottles and containers",
    hint: "Rinse out liquids · Keep bottle caps attached",
    tintBg: "#F1FAF8",
    borderTint: "#CDEAE4",
    dotTint: "rgba(56, 166, 160, 0.14)",
  },
  paper: {
    imageUrl:
      "https://images.unsplash.com/photo-1654372066379-d8a1c70f7363?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
    alt: "Clean recyclable paper and flattened cardboard boxes",
    hint: "Keep dry · Flatten boxes before disposal",
    tintBg: "#FDF8EE",
    borderTint: "#F1DEC0",
    dotTint: "rgba(212, 154, 58, 0.14)",
  },
  metal: {
    imageUrl:
      "https://images.unsplash.com/photo-1689555256964-aeabc20d1d3c?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
    alt: "Clean aluminum drink cans and metal food containers",
    hint: "Empty residue · Crush cans where possible",
    tintBg: "#F3F6FA",
    borderTint: "#D4DFEC",
    dotTint: "rgba(113, 132, 154, 0.15)",
  },
  general: {
    imageUrl:
      "https://images.unsplash.com/photo-1619540034640-0d41b5e0f6fc?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
    alt: "Everyday non-recyclable items and disposable coffee cup",
    hint: "Food-soiled packaging · Bag messy items",
    tintBg: "#F5F4F2",
    borderTint: "#DFDDD9",
    dotTint: "rgba(119, 111, 104, 0.14)",
  },
};

const walkthroughSteps = [
  {
    id: "scan",
    stepNumber: "01",
    label: "Step 01 / Scan",
    title: "Show the item",
    summary:
      "Hold an item in front of the dedicated camera scanning area beside the bins.",
    icon: ScanLine,
    highlight: "Separate camera scanning zone beside bins",
  },
  {
    id: "guide",
    stepNumber: "02",
    label: "Step 02 / Sort",
    title: "Follow the light",
    summary:
      "The matching category LED indicator lights up directly above the correct bin aperture.",
    icon: Lightbulb,
    highlight: "Illuminated wall-mounted LED above matching bin",
  },
  {
    id: "locate",
    stepNumber: "03",
    label: "Step 03 / Locate",
    title: "Find a station",
    summary:
      "Check nearby campus stations and live compartment availability before you walk.",
    icon: LocateFixed,
    highlight: "Live bin availability & station preview",
  },
];

function formatTwoDigits(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function pickPrimaryCampusStation(
  list: StationLiveStatus[],
): StationLiveStatus | null {
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => {
    const aCal =
      typeof a.latitude === "number" &&
      typeof a.longitude === "number" &&
      (a.latitude !== 0 || a.longitude !== 0);
    const bCal =
      typeof b.latitude === "number" &&
      typeof b.longitude === "number" &&
      (b.latitude !== 0 || b.longitude !== 0);
    if (aCal !== bCal) return aCal ? -1 : 1;

    const aTest = /\btest\b/i.test(a.name) || /\btest\b/i.test(a.station_id);
    const bTest = /\btest\b/i.test(b.name) || /\btest\b/i.test(b.station_id);
    if (aTest !== bTest) return aTest ? 1 : -1;

    const aHasImg = Boolean(a.image_url);
    const bHasImg = Boolean(b.image_url);
    if (aHasImg !== bHasImg) return aHasImg ? -1 : 1;

    if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return sorted[0] ?? null;
}

export default function HomePage() {
  const [selectedItem, setSelectedItem] = useState("plastic");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [liveData, setLiveData] = useState<LiveStatusResponse | null>(null);
  const [failedImgUrl, setFailedImgUrl] = useState<string | null>(null);

  // Smooth @react-spring/web transition when switching categories in Part E
  const [categoryPanelSpring, categorySpringApi] = useSpring(() => ({
    opacity: 1,
    y: 0,
    config: { tension: 240, friction: 24 },
  }));

  const handleSelectCategory = (slug: string) => {
    if (slug === selectedItem) return;
    setSelectedItem(slug);
    categorySpringApi.start({
      from: { opacity: 0.25, y: 10 },
      to: { opacity: 1, y: 0 },
    });
  };

  useEffect(() => {
    let active = true;
    async function loadLiveCampusData() {
      try {
        const res = await fetch("/api/dashboard/live-status", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: LiveStatusResponse = await res.json();
        if (active) {
          setLiveData(data);
        }
      } catch {
        // Keep graceful local fallback when telemetry service is unreachable
      }
    }
    loadLiveCampusData();
    return () => {
      active = false;
    };
  }, []);

  const primaryRawStation = useMemo(
    () => pickPrimaryCampusStation(liveData?.stations ?? []),
    [liveData],
  );

  const primaryStation = useMemo(
    () => (primaryRawStation ? adaptStation(primaryRawStation) : null),
    [primaryRawStation],
  );

  const heroImageSrc =
    primaryRawStation?.image_url && failedImgUrl !== primaryRawStation.image_url
      ? primaryRawStation.image_url
      : LOCAL_CAMPUS_PLACEHOLDER;

  // Real database-backed metrics for Part B Mission Strip
  const liveMetrics = useMemo(() => {
    const stations = liveData?.stations ?? [];
    const activeStationsCount =
      typeof liveData?.total_active_stations === "number"
        ? liveData.total_active_stations
        : stations.length;

    const derivedCategories = new Set<string>();
    let derivedCompartments = 0;
    stations.forEach((st) => {
      const floorBins = (st.floors ?? []).flatMap((fl) =>
        (fl.disposal_areas ?? []).flatMap((a) => a.bins ?? []),
      );
      if (floorBins.length > 0) {
        derivedCompartments += floorBins.length;
        floorBins.forEach((b) => {
          const key = (
            b.category_id ||
            b.category_slug ||
            b.category_name ||
            ""
          )
            .trim()
            .toLowerCase();
          if (key) derivedCategories.add(key);
        });
      } else {
        derivedCompartments += 4;
        ["plastic", "paper", "metal", "general"].forEach((k) =>
          derivedCategories.add(k),
        );
      }
    });

    const wasteCategoriesCount =
      typeof liveData?.total_waste_categories === "number" &&
      liveData.total_waste_categories > 0
        ? liveData.total_waste_categories
        : derivedCategories.size;

    const monitoredCompartmentsCount =
      typeof liveData?.total_monitored_compartments === "number" &&
      liveData.total_monitored_compartments > 0
        ? liveData.total_monitored_compartments
        : derivedCompartments;

    const dropEventsCount =
      typeof liveData?.total_drop_events === "number"
        ? liveData.total_drop_events
        : null;

    return {
      loaded: liveData !== null,
      activeStationsCount,
      wasteCategoriesCount,
      monitoredCompartmentsCount,
      dropEventsCount,
    };
  }, [liveData]);

  const selected =
    categories.find((item) => item.slug === selectedItem) ?? categories[0];
  const currentVisual =
    categoryVisuals[selected.slug] ?? categoryVisuals.plastic;
  const currentStep = walkthroughSteps[activeStepIndex];

  const heroAvailableBins = primaryStation ? availableCount(primaryStation) : 0;
  const heroTotalBins = primaryStation ? primaryStation.bins.length : 0;
  const heroAvailabilitySummary = primaryStation
    ? heroAvailableBins > 0
      ? `${primaryStation.landmark ? `${primaryStation.landmark} · ` : ""}${heroAvailableBins} of ${heroTotalBins} bins available`
      : `${primaryStation.landmark ? `${primaryStation.landmark} · ` : ""}${heroTotalBins} monitored compartments`
    : "Live campus telemetry syncing…";

  return (
    <div className="site-shell">
      <PublicHeader />

      <main className="renew-home">
        {/* ============================================================ */}
        {/* PART A: HERO SECTION WITH REAL STATION PHOTO & LIVE CARD     */}
        {/* ============================================================ */}
        <section className="renew-hero page-width" aria-label="Introduction">
          <div className="renew-hero-bg-accent" aria-hidden="true">
            <svg
              className="hero-leaf-motif"
              viewBox="0 0 400 400"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M360 40C240 40 80 180 80 320C80 360 120 400 160 400C300 400 360 200 360 40Z"
                fill="rgba(23, 107, 69, 0.035)"
              />
              <path
                d="M360 40C250 150 160 280 160 400"
                stroke="rgba(72, 168, 104, 0.12)"
                strokeWidth="2"
                strokeDasharray="4 6"
              />
            </svg>
          </div>

          <div className="renew-hero-copy">
            <span className="renew-kicker">
              <i /> Smarter Sorting. Better Choices.
            </span>
            <h1>
              Every waste
              <br />
              has its <em>place.</em>
            </h1>
            <p>
              One clear system for knowing what goes where—and where to find the
              right bin nearby on campus.
            </p>
            <div className="renew-actions">
              <Link
                className="button button-primary button-large hero-primary-cta"
                href="/find-bin"
              >
                <span>Find a Bin</span>
                <ArrowRight size={18} className="cta-arrow-icon" />
              </Link>
              <a className="renew-text-action" href="#process">
                <span>See how it works</span>
                <ArrowDown size={16} />
              </a>
            </div>
            <div className="renew-microcopy">
              <span>
                <Check size={13} /> No account needed
              </span>
              <span>
                <Check size={13} /> Public campus access
              </span>
              <span>
                <Check size={13} /> Live bin telemetry
              </span>
            </div>
          </div>

          <div className="renew-hero-media">
            <img
              src={heroImageSrc}
              onError={() => {
                if (primaryRawStation?.image_url) {
                  setFailedImgUrl(primaryRawStation.image_url);
                }
              }}
              alt={
                primaryRawStation
                  ? `${primaryRawStation.name} campus recycling station`
                  : "SortSense campus smart sorting station"
              }
              loading="eager"
            />
            <div className="media-scrim" />

            <div className="hero-live-card">
              <span className="live-card-icon" aria-hidden="true">
                <MapPin size={19} />
              </span>
              <div className="min-w-0">
                <small>NEAREST STATION</small>
                <strong className="truncate">
                  {primaryRawStation
                    ? primaryRawStation.name
                    : "Campus Station"}
                </strong>
                <span className="truncate">{heroAvailabilitySummary}</span>
              </div>
              <Link
                href={
                  primaryRawStation
                    ? `/stations/${encodeURIComponent(primaryRawStation.station_id)}`
                    : "/find-bin"
                }
                className="hero-live-card-link"
                aria-label={
                  primaryRawStation
                    ? `Inspect live station details for ${primaryRawStation.name}`
                    : "Open the campus bin locator"
                }
              >
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="hero-scan-chip">
              <span className="sensor-live-dot" aria-hidden="true" />
              <Signal size={14} />
              <span>Live Campus Telemetry</span>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* PART B: LIVE DATABASE-BACKED IMPACT & MISSION STRIP          */}
        {/* ============================================================ */}
        <section className="renew-stat-band" aria-label="System statistics">
          <div className="page-width">
            <p>
              SortSense turns live campus sensing into{" "}
              <strong>one clear next step.</strong>
            </p>
            <div>
              <span>
                <strong>
                  {liveMetrics.loaded
                    ? formatTwoDigits(liveMetrics.wasteCategoriesCount)
                    : "—"}
                </strong>{" "}
                waste{" "}
                {liveMetrics.wasteCategoriesCount === 1
                  ? "category"
                  : "categories"}
              </span>
              <span>
                <strong>
                  {liveMetrics.loaded
                    ? formatTwoDigits(liveMetrics.activeStationsCount)
                    : "—"}
                </strong>{" "}
                active{" "}
                {liveMetrics.activeStationsCount === 1 ? "station" : "stations"}
              </span>
              <span>
                <strong>01</strong> mission
              </span>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* PART C: EQUALIZED-HEIGHT INTERACTIVE WORKFLOW WALKTHROUGH    */}
        {/* ============================================================ */}
        <section
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
          id="process"
          aria-label="How SortSense Works"
        >
          <div className="renew-section-head">
            <span className="renew-index">01</span>
            <div>
              <span className="renew-kicker">
                <i /> From confusion to confidence
              </span>
              <h2>A simpler path from item to bin.</h2>
            </div>
            <p>
              The physical station guides sorting in person. The web app helps
              you locate available bins before you walk.
            </p>
          </div>

          {/* Equalized 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-stretch gap-6">
            {/* Left Column: 3 Equal-Height Step Cards Flush with Right Panel */}
            <div
              className="flex flex-col justify-between gap-4 h-full"
              role="tablist"
              aria-label="Product workflow steps"
            >
              {walkthroughSteps.map((step, idx) => {
                const Icon = step.icon;
                const isSelected = activeStepIndex === idx;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    id={`tab-${step.id}`}
                    aria-selected={isSelected}
                    aria-controls={`panel-${step.id}`}
                    onClick={() => setActiveStepIndex(idx)}
                    className={`flex-1 flex items-center gap-4 w-full text-left rounded-2xl border px-5 py-5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white border-[#14532D] shadow-[0_8px_24px_rgba(20,83,45,0.09)] ring-1 ring-[#14532D]/10"
                        : "bg-white border-[#E1E8E1] hover:border-[#A9C9B6] hover:bg-[#FCFDFC]"
                    }`}
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`font-jakarta text-lg font-extrabold ${
                          isSelected ? "text-[#14532D]" : "text-[#A4B4AB]"
                        }`}
                      >
                        {step.stepNumber}
                      </span>
                      <span
                        className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-[#14532D] text-white"
                            : "bg-[#EEF5F1] text-[#14532D]"
                        }`}
                      >
                        <Icon size={18} />
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#2E8A57] mb-0.5">
                        {step.label}
                      </span>
                      <h3 className="font-jakarta text-base font-bold text-[#14231B] leading-snug">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-xs text-[#617067] leading-relaxed">
                        {step.summary}
                      </p>
                    </div>

                    <ChevronRight
                      size={18}
                      className={`shrink-0 transition-transform ${
                        isSelected
                          ? "text-[#14532D] translate-x-0.5"
                          : "text-[#A4B4AB]"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Right Column: Fixed Min-Height Interactive Console */}
            <div
              className="min-h-[440px] lg:min-h-[460px] h-full flex flex-col justify-between rounded-2xl border border-[#DCE5DC] bg-white p-6 shadow-[0_12px_32px_rgba(20,60,40,0.04)] overflow-hidden"
              role="tabpanel"
              id={`panel-${currentStep.id}`}
              aria-labelledby={`tab-${currentStep.id}`}
            >
              <div className="flex items-center justify-between gap-3 pb-3.5 mb-4 border-b border-[#E8EFE9]">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#EEF6F1] px-3 py-1.5 text-[11px] font-bold text-[#14532D]">
                  <Sparkles size={13} /> {currentStep.highlight}
                </span>
                <span className="text-[11px] font-bold text-[#65736A] shrink-0">
                  Step {activeStepIndex + 1} of 3
                </span>
              </div>

              {/* PREVIEW 1: Camera Scanner Beside Bins */}
              {activeStepIndex === 0 && (
                <div className="flex-1 flex flex-col justify-between gap-4 animate-fade-in">
                  <div className="scanner-booth">
                    <div className="scanner-camera-head">
                      <div className="camera-lens">
                        <Camera size={18} />
                      </div>
                      <span className="camera-label">
                        AI Scanning Camera Area
                      </span>
                      <span className="status-live-pill">Standby Scanning</span>
                    </div>

                    <div className="scanner-viewfinder">
                      <div className="viewfinder-frame">
                        <span className="corner top-left" />
                        <span className="corner top-right" />
                        <span className="corner bottom-left" />
                        <span className="corner bottom-right" />
                        <div className="scan-laser-line" />

                        <div className="scanned-item-silhouette">
                          <div className="bottle-graphic">
                            <span className="bottle-neck" />
                            <span className="bottle-body">
                              <i>PET</i>
                            </span>
                          </div>
                        </div>

                        <div className="detection-floating-chip">
                          <Check size={13} />
                          <strong>Detected: Plastic Drink Bottle</strong>
                          <small>Confidence 94% · Recyclable PET #1</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="scanner-info-strip">
                    <strong>Separate Optical Scanning Console</strong>
                    <p>
                      Item presented to the camera beside the bins. Vision model
                      estimates classification before disposal.
                    </p>
                  </div>
                </div>
              )}

              {/* PREVIEW 2: Wall-Mounted Indicator Light & 4 Bins */}
              {activeStepIndex === 1 && (
                <div className="flex-1 flex flex-col justify-between gap-4 animate-fade-in">
                  <div className="wall-indicator-strip">
                    <span className="wall-cue-label">
                      Wall-Mounted Indicator Cues:
                    </span>
                    <div className="indicator-leds-row">
                      <div className="led-cue active-cue cue-plastic">
                        <div className="led-lamp">
                          <span className="lamp-glow" />
                          <Lightbulb size={16} />
                        </div>
                        <span className="led-name">Plastic</span>
                        <span className="led-state">MATCHED</span>
                      </div>

                      <div className="led-cue cue-paper">
                        <div className="led-lamp unlit" />
                        <span className="led-name">Paper</span>
                        <span className="led-state">Standby</span>
                      </div>

                      <div className="led-cue cue-metal">
                        <div className="led-lamp unlit" />
                        <span className="led-name">Metal</span>
                        <span className="led-state">Standby</span>
                      </div>

                      <div className="led-cue cue-general">
                        <div className="led-lamp unlit" />
                        <span className="led-name">General</span>
                        <span className="led-state">Standby</span>
                      </div>
                    </div>
                  </div>

                  <div className="four-bins-array" aria-hidden="true">
                    <div className="demo-bin-card is-active-bin">
                      <div className="bin-beacon-beam" />
                      <div className="bin-aperture-lid lid-plastic" />
                      <div className="bin-body">
                        <strong>Plastic</strong>
                        <span className="bin-fill-tag fill-ok">42% full</span>
                      </div>
                    </div>

                    <div className="demo-bin-card">
                      <div className="bin-aperture-lid lid-paper" />
                      <div className="bin-body">
                        <strong>Paper</strong>
                        <span className="bin-fill-tag fill-warn">78% full</span>
                      </div>
                    </div>

                    <div className="demo-bin-card">
                      <div className="bin-aperture-lid lid-metal" />
                      <div className="bin-body">
                        <strong>Metal</strong>
                        <span className="bin-fill-tag fill-alert">
                          94% full
                        </span>
                      </div>
                    </div>

                    <div className="demo-bin-card">
                      <div className="bin-aperture-lid lid-general" />
                      <div className="bin-body">
                        <strong>General</strong>
                        <span className="bin-fill-tag fill-ok">35% full</span>
                      </div>
                    </div>
                  </div>

                  <div className="scanner-info-strip">
                    <strong>Simple Physical Cueing</strong>
                    <p>
                      No moving robotic parts. Four ordinary bins equipped with
                      internal ToF fill sensors and wall-mounted LEDs for
                      instant clarity.
                    </p>
                  </div>
                </div>
              )}

              {/* PREVIEW 3: Live Campus Station Preview */}
              {activeStepIndex === 2 && (
                <div className="flex-1 flex flex-col justify-between gap-4 animate-fade-in">
                  <div className="preview-station-card">
                    <div className="preview-station-header">
                      <div className="station-avatar">
                        <MapPin size={20} />
                      </div>
                      <div className="min-w-0">
                        <span className="station-kicker">
                          Active Campus Station
                        </span>
                        <h4 className="truncate">
                          {primaryRawStation
                            ? `${primaryRawStation.name}${primaryRawStation.location_name ? ` — ${primaryRawStation.location_name}` : ""}`
                            : "Campus Smart Station"}
                        </h4>
                        <div className="station-pills">
                          <span>
                            <Route size={12} />{" "}
                            {primaryRawStation?.station_id || "Live ToF Feed"}
                          </span>
                          <span>
                            <Compass size={12} /> Public campus access
                          </span>
                        </div>
                      </div>
                      <span className="status-pill status-ready">
                        {primaryStation && heroAvailableBins > 0
                          ? `${heroAvailableBins} Available`
                          : "Live Telemetry"}
                      </span>
                    </div>

                    <div className="mini-bins-status-grid">
                      {(["plastic", "paper", "metal", "general"] as const).map(
                        (slug) => {
                          const liveFill =
                            primaryRawStation?.fill_levels?.[slug] ?? null;
                          const label =
                            slug.charAt(0).toUpperCase() + slug.slice(1);
                          const hasReading =
                            typeof liveFill === "number" &&
                            Number.isFinite(liveFill);
                          const barClass = !hasReading
                            ? "bg-[#CBD5E1]"
                            : liveFill >= 80
                              ? "fill-full"
                              : liveFill >= 50
                                ? "fill-nearly-full"
                                : "fill-available";
                          const badgeClass = !hasReading
                            ? "text-[#65736A]"
                            : liveFill >= 80
                              ? "badge-danger"
                              : liveFill >= 50
                                ? "badge-warning"
                                : "badge-available";
                          const badgeText = !hasReading
                            ? "Offline / N/A"
                            : liveFill >= 80
                              ? `Critical (${Math.round(liveFill)}%)`
                              : liveFill >= 50
                                ? `Filling (${Math.round(liveFill)}%)`
                                : `Available (${Math.round(liveFill)}%)`;

                          return (
                            <div className="mini-bin-row" key={slug}>
                              <div
                                className={`category-indicator cat-${slug}`}
                              />
                              <span className="bin-category-name">{label}</span>
                              <div className="meter-track">
                                <div
                                  className={`meter-bar ${barClass}`}
                                  style={{
                                    width: hasReading
                                      ? `${Math.min(100, Math.max(0, liveFill))}%`
                                      : "0%",
                                  }}
                                />
                              </div>
                              <span className={`bin-badge ${badgeClass}`}>
                                {badgeText}
                              </span>
                            </div>
                          );
                        },
                      )}
                    </div>

                    <div className="preview-action-row">
                      <Link
                        href="/find-bin"
                        className="button button-primary button-compact"
                      >
                        <span>Explore Campus Map</span>
                        <ArrowRight size={14} />
                      </Link>
                      <small>Live campus station telemetry</small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* PART D: COMPACT & BALANCED DARK GREEN PHILOSOPHY SECTION     */}
        {/* ============================================================ */}
        <section
          className="bg-[#14532D] text-white py-14 lg:py-16"
          aria-label="Philosophy"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div className="relative w-full h-[280px] sm:h-[320px] lg:h-[360px] max-h-[340px] lg:max-h-[360px] rounded-2xl overflow-hidden shadow-lg border border-white/10">
              <img
                src={BINS_STORY_PHOTO}
                alt="A row of neatly separated recycling bins on campus"
                loading="lazy"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D3A20]/50 via-transparent to-transparent pointer-events-none" />
            </div>

            <div className="space-y-4">
              <span className="renew-kicker light">
                <i /> Useful technology, quietly working
              </span>

              <h2 className="font-jakarta text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight leading-tight text-white">
                Not another dashboard. A better decision.
              </h2>

              <p className="text-sm text-[#C3D6CC] leading-relaxed max-w-md">
                SortSense brings the information people actually need to the
                surface: the likely category, the correct destination, and
                whether there is room when they arrive.
              </p>

              <div className="divide-y divide-white/12 border-y border-white/12">
                <div className="py-2.5 flex items-start gap-3">
                  <Bot
                    size={18}
                    className="text-[#D8ED8F] shrink-0 mt-0.5"
                  />
                  <div>
                    <strong className="block text-sm font-bold text-white">
                      Recognize
                    </strong>
                    <span className="text-xs text-[#B3C8BD]">
                      AI suggests a likely category in the camera area.
                    </span>
                  </div>
                </div>

                <div className="py-2.5 flex items-start gap-3">
                  <Lightbulb
                    size={18}
                    className="text-[#D8ED8F] shrink-0 mt-0.5"
                  />
                  <div>
                    <strong className="block text-sm font-bold text-white">
                      Guide
                    </strong>
                    <span className="text-xs text-[#B3C8BD]">
                      LEDs make the next action immediately visible.
                    </span>
                  </div>
                </div>

                <div className="py-2.5 flex items-start gap-3">
                  <MapPin
                    size={18}
                    className="text-[#D8ED8F] shrink-0 mt-0.5"
                  />
                  <div>
                    <strong className="block text-sm font-bold text-white">
                      Locate
                    </strong>
                    <span className="text-xs text-[#B3C8BD]">
                      Live availability helps choose a station before walking.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <Link
                  href="/find-bin"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D8ED8F] hover:text-white transition-colors"
                >
                  <span>Explore the locator</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* PART E: COMPACT & ENRICHED "WHAT ARE YOU HOLDING?" SECTION   */}
        {/* ============================================================ */}
        <section
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16"
          aria-label="Category sorting preview"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
            <div className="flex items-start gap-4">
              <span className="font-jakarta text-xs font-extrabold text-[#97A69D] pt-1">
                02
              </span>
              <div>
                <span className="renew-kicker">
                  <i /> Start with the item
                </span>
                <h2 className="mt-1.5 font-jakarta text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-[#14231B]">
                  What are you holding?
                </h2>
              </div>
            </div>

            <Link
              href="/sorting-guide"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#14532D] hover:text-[#0F3F22] transition-colors"
            >
              <span>Full sorting guide</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="max-w-6xl mx-auto rounded-2xl border border-[#DCE5DC] bg-white shadow-[0_10px_28px_rgba(20,83,45,0.04)] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {/* Compact Left Category Tabs */}
            <div
              className="lg:col-span-4 flex flex-col divide-y divide-[#E7EDE7] border-b lg:border-b-0 lg:border-r border-[#E1E8E1] bg-[#FAFBF9]"
              role="tablist"
              aria-label="Waste category options"
            >
              {categories.map((category, index) => {
                const isSelected = selectedItem === category.slug;
                return (
                  <button
                    key={category.slug}
                    type="button"
                    role="tab"
                    id={`cat-tab-${category.slug}`}
                    aria-selected={isSelected}
                    aria-controls={`cat-panel-${category.slug}`}
                    onClick={() => handleSelectCategory(category.slug)}
                    className={`relative flex-1 flex items-center gap-3.5 py-3.5 px-5 text-sm text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#14532D] text-white"
                        : "bg-transparent text-[#1A2620] hover:bg-[#F1F6F2]"
                    }`}
                  >
                    {/* Active Indicator Bar */}
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-opacity ${
                        isSelected ? "opacity-100" : "opacity-0"
                      }`}
                      style={{
                        backgroundColor: isSelected
                          ? "#D8ED8F"
                          : category.color,
                      }}
                    />

                    <span
                      className={`font-mono text-xs font-bold ${
                        isSelected ? "text-[#D8ED8F]" : "text-[#8D9D93]"
                      }`}
                    >
                      0{index + 1}
                    </span>

                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        isSelected ? "ring-2 ring-white/40" : ""
                      }`}
                      style={{ backgroundColor: category.color }}
                    />

                    <div className="flex-1 min-w-0">
                      <strong className="block font-jakarta text-sm font-bold leading-snug">
                        {category.name}
                      </strong>
                      <span
                        className={`block text-[11px] truncate ${
                          isSelected ? "text-[#CBE0D4]" : "text-[#6B7A71]"
                        }`}
                      >
                        {category.shortDescription}
                      </span>
                    </div>

                    <ArrowRight
                      size={15}
                      className={`shrink-0 transition-transform ${
                        isSelected
                          ? "text-white translate-x-0.5"
                          : "text-[#9AB0A2]"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Enriched Right Category Detail Panel with @react-spring/web Transition */}
            <div
              className="lg:col-span-8 relative transition-colors duration-300"
              role="tabpanel"
              id={`cat-panel-${selected.slug}`}
              aria-labelledby={`cat-tab-${selected.slug}`}
              style={{
                backgroundColor: currentVisual.tintBg,
                backgroundImage: `radial-gradient(${currentVisual.dotTint} 1px, transparent 1px)`,
                backgroundSize: "16px 16px",
              }}
            >
              <animated.div
                style={categoryPanelSpring}
                className="p-6 sm:p-7 grid grid-cols-1 md:grid-cols-12 gap-6 items-center h-full"
              >
                {/* Framed Preview Card for Category Photo + Preparation Tip */}
                <div className="md:col-span-5">
                  <div
                    className="rounded-2xl bg-white p-2.5 border shadow-sm space-y-2.5"
                    style={{ borderColor: currentVisual.borderTint }}
                  >
                    <div className="relative h-44 sm:h-48 w-full rounded-xl overflow-hidden bg-[#E5EAE6]">
                      <img
                        key={selected.slug}
                        src={currentVisual.imageUrl}
                        alt={currentVisual.alt}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
                      <span
                        className="absolute top-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs"
                        style={{ backgroundColor: selected.color }}
                      >
                        {selected.name}
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#F7F9F7] border border-[#E8EFE9] px-3 py-2 text-[11px] font-semibold text-[#3C4F44] text-center">
                      {currentVisual.hint}
                    </div>
                  </div>
                </div>

                {/* Category Guidance + Accepted Chips + Avoid Note + Compact Actions */}
                <div className="md:col-span-7 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: selected.color }}
                    />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#14532D]">
                      Campus Sorting Guidance
                    </span>
                  </div>

                  <div>
                    <h3 className="font-jakarta text-xl sm:text-2xl font-extrabold text-[#14231B] leading-tight">
                      {selected.name}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-[#55655C] leading-relaxed">
                      {selected.shortDescription}. {selected.preparation}
                    </p>
                  </div>

                  {/* Accepted Examples */}
                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#14532D]">
                      Accepted Examples
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.accepts.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 rounded-full bg-white border border-[#DCE5DC] px-2.5 py-1 text-[11px] font-semibold text-[#2E3F35] shadow-2xs"
                        >
                          <Check size={11} className="text-[#16A34A]" />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Compact Avoid / Not Accepted Quick Note */}
                  <div className="rounded-xl bg-white/85 border border-[#F3D8D4] px-3 py-2 flex items-start gap-2">
                    <AlertTriangle
                      size={13}
                      className="text-[#C84F49] shrink-0 mt-0.5"
                    />
                    <div className="text-[11px] leading-snug text-[#7E342F]">
                      <strong className="font-bold uppercase tracking-wide text-[10px] mr-1.5">
                        Avoid / Not Accepted:
                      </strong>
                      <span>{selected.avoids.join(" · ")}</span>
                    </div>
                  </div>

                  {/* Compact Side-by-Side Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <Link
                      href={`/sorting-guide?category=${selected.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#14532D] hover:bg-[#0F3F22] text-white text-xs font-bold py-2 px-4 transition-colors shadow-xs"
                    >
                      <span>Read full {selected.name} guide</span>
                      <ArrowRight size={13} />
                    </Link>

                    <Link
                      href={`/find-bin?category=${selected.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#C8D8CE] bg-white hover:bg-[#F2F7F3] text-[#14532D] text-xs font-bold py-2 px-4 transition-colors"
                    >
                      <span>Find {selected.name} bin</span>
                    </Link>
                  </div>
                </div>
              </animated.div>
            </div>
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <section
            className="rounded-2xl bg-[#10442B] text-white px-6 py-7 sm:px-8 sm:py-8 shadow-[0_12px_30px_rgba(16,68,43,0.14)] flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            aria-label="Call to action"
          >
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-[#D8ED8F]">
                <span className="h-[2px] w-4 rounded-full bg-current" />
                The next right choice is nearby
              </span>
              <h2 className="font-jakarta text-xl sm:text-2xl font-bold leading-tight mt-1 text-white">
                Ready to find your bin?
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-[#B8CFC3] leading-relaxed max-w-md">
              Choose a waste category, compare real-time availability, and open
              directions to an active station across campus.
            </p>

            <Link
              href="/find-bin"
              className="shrink-0 inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-[#D8ED8F] hover:bg-[#CBE578] text-[#0F3F22] text-xs sm:text-sm font-semibold shadow-xs transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap"
            >
              <span>Find a Bin</span>
              <ArrowRight size={15} />
            </Link>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
