import Link from "next/link";
import {
  AlertTriangle,
  FlaskConical,
  Layers,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { PublicHeader } from "@/components/shell/public-header";
import { PublicFooter } from "@/components/shell/public-footer";
import { PITCH_DEMO_STATIONS, type DemoBin } from "@/lib/demo-data";

function fillBarColor(bin: DemoBin): string {
  if (bin.operationalStatus === "SENSOR_ERROR" || bin.fillPercentage === null) {
    return "bg-slate-300";
  }
  if (bin.fillPercentage >= 85) return "bg-red-500";
  if (bin.fillPercentage >= 60) return "bg-amber-500";
  return "bg-[#48A868]";
}

export default function PitchDemoPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8F4] text-[#111827]">
      <PublicHeader />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <FlaskConical className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-[#111827]">
                    SortSense Pitch Demo Mode
                  </h1>
                  <span className="inline-flex items-center rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                    Deterministic Sample Data · Read-Only
                  </span>
                </div>
                <p className="mt-1 text-sm text-amber-900/90">
                  Standalone fallback view for live presentations. Displays
                  simulated individual-bin states without executing any Supabase
                  reads or writes.
                </p>
              </div>
            </div>
            <Link
              href="/find-bin"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#176B45] px-4 py-2 text-sm font-semibold text-white hover:bg-[#125637] transition"
            >
              Open Live Station Finder
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          {PITCH_DEMO_STATIONS.map((station) => (
            <section
              key={station.stationCode}
              className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E7EB] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-[#111827]">
                      {station.stationName}
                    </h2>
                    <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 font-mono text-xs text-[#4B5563]">
                      {station.stationCode}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-[#4B5563]">
                    <MapPin className="h-4 w-4 text-[#38A6A0]" />
                    {station.locationName} — {station.description}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0FDF4] px-3 py-1 text-xs font-semibold text-[#176B45]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Zero DB Writes
                </span>
              </div>

              {station.floors.map((floor) => (
                <div key={floor.floorId} className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#1F2937]">
                    <Layers className="h-4 w-4 text-[#176B45]" />
                    {floor.floorName}
                  </div>

                  {floor.disposalAreas.map((area) => (
                    <div
                      key={area.areaId}
                      className="space-y-3 pl-3 border-l-2 border-[#48A868]/40"
                    >
                      <h3 className="text-sm font-semibold text-[#176B45]">
                        {area.areaName}
                      </h3>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {area.bins.map((bin) => {
                          const isError =
                            bin.operationalStatus === "SENSOR_ERROR";
                          return (
                            <article
                              key={bin.binId}
                              className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-bold text-[#111827]">
                                    {bin.categoryName}
                                  </div>
                                  <div className="text-xs text-[#6B7280]">
                                    {bin.capacityLiters}L capacity
                                  </div>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                    bin.readingSource === "SIMULATED"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {bin.readingSource === "SIMULATED"
                                    ? "Simulated (Test Data)"
                                    : bin.readingSource}
                                </span>
                              </div>

                              <div>
                                <div className="flex items-baseline justify-between text-xs text-[#4B5563]">
                                  <span>Fill level</span>
                                  <strong className="text-base text-[#111827]">
                                    {isError || bin.fillPercentage === null
                                      ? "N/A"
                                      : `${bin.fillPercentage}%`}
                                  </strong>
                                </div>
                                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                                  <div
                                    className={`h-full rounded-full ${fillBarColor(bin)}`}
                                    style={{
                                      width: `${isError || bin.fillPercentage === null ? 0 : bin.fillPercentage}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              {isError ? (
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  SENSOR_ERROR · Reading unavailable
                                </div>
                              ) : (
                                <div className="text-xs font-medium text-[#166534]">
                                  Status: {bin.operationalStatus}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
