"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Search,
  Sparkles,
} from "lucide-react";
import type { StationLiveStatus, WasteCategory } from "@/components/types";

interface SortItemRule {
  label: string;
  keywords: string[];
  category: WasteCategory;
  categoryLabel: string;
  tip: string;
}

const CAMPUS_SORT_ITEMS: SortItemRule[] = [
  {
    label: "Plastic Bottle",
    keywords: ["bottle", "pet", "plastic", "water", "tea", "drink"],
    category: "plastic",
    categoryLabel: "Plastic",
    tip: "Empty liquids and keep the cap attached.",
  },
  {
    label: "Coffee Cup",
    keywords: ["coffee", "cup", "boba", "lid", "straw", "paper cup"],
    category: "general",
    categoryLabel: "General",
    tip: "Plastic-lined cups and used straws go in General Waste.",
  },
  {
    label: "Aluminum Can",
    keywords: ["can", "aluminum", "soda", "beer", "metal", "tin"],
    category: "metal",
    categoryLabel: "Metal",
    tip: "Rinse residue and lightly crush if possible.",
  },
  {
    label: "Food Wrapper",
    keywords: ["wrapper", "snack", "foil", "bag", "tissue", "napkin", "food"],
    category: "general",
    categoryLabel: "General",
    tip: "Food-soiled wrappers and tissues belong in General Waste.",
  },
  {
    label: "Cardboard",
    keywords: ["cardboard", "box", "paper", "flyer", "notebook", "receipt"],
    category: "paper",
    categoryLabel: "Paper",
    tip: "Keep dry and flatten boxes before depositing.",
  },
];

const QUICK_CHIPS = CAMPUS_SORT_ITEMS.map((item) => item.label);

interface QuickSortLookupProps {
  stations: StationLiveStatus[];
  loading: boolean;
}

export function QuickSortLookup({ stations, loading }: QuickSortLookupProps) {
  const [query, setQuery] = useState("");
  const [selectedChip, setSelectedChip] = useState<string>("Plastic Bottle");

  const activeQuery = (query.trim() || selectedChip).toLowerCase();

  const matchedRule = useMemo(() => {
    const exact = CAMPUS_SORT_ITEMS.find(
      (item) => item.label.toLowerCase() === activeQuery,
    );
    if (exact) return exact;
    const partial = CAMPUS_SORT_ITEMS.find(
      (item) =>
        item.label.toLowerCase().includes(activeQuery) ||
        item.keywords.some(
          (kw) => activeQuery.includes(kw) || kw.includes(activeQuery),
        ),
    );
    return partial ?? null;
  }, [activeQuery]);

  const shuimuStation = useMemo(() => {
    return (
      stations.find((s) => s.station_id === "NTHU-SHUIMU") ??
      stations[0] ??
      null
    );
  }, [stations]);

  const shuimuStatus = useMemo(() => {
    if (!matchedRule || !shuimuStation) return null;
    const cat = matchedRule.category;
    const fill = shuimuStation.fill_levels[cat];
    const hasErr = shuimuStation.sensor_error_categories?.includes(cat);

    if (hasErr || fill === null || fill === undefined) {
      return {
        state: "unavailable" as const,
        text: `${shuimuStation.name} (${shuimuStation.station_id}): Sensor Offline / N/A`,
      };
    }
    if (fill >= 80) {
      return {
        state: "full" as const,
        text: `${shuimuStation.name} (${shuimuStation.station_id}): ${fill}% full — nearly full`,
      };
    }
    return {
      state: "available" as const,
      text: `${shuimuStation.name} (${shuimuStation.station_id}): ${fill}% full — space available`,
    };
  }, [matchedRule, shuimuStation]);

  return (
    <section className="page-width my-10" aria-label="Quick Sort Lookup">
      <div className="rounded-3xl border border-[#DCE5DC] bg-white p-5 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#176B45]">
              <Sparkles className="w-3.5 h-3.5" />
              Student Quick Sort Lookup
            </span>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold text-[#202A25] font-display">
              Not sure which bin to use?
            </h2>
          </div>
          <Link
            href="/sorting-guide"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#176B45] hover:underline min-h-[44px] px-2"
          >
            Full Sorting Guide <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-[#65736A] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an item (e.g. Plastic Bottle, Coffee Cup, Aluminum Can, Cardboard)..."
            aria-label="Search waste item for sorting guidance"
            className="w-full min-h-[48px] rounded-2xl border border-[#DCE5DC] bg-[#F7F8F4] pl-11 pr-4 text-sm text-[#202A25] placeholder:text-[#65736A] focus:border-[#176B45] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#176B45]/15"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_CHIPS.map((chip) => {
            const isSelected = !query.trim() && selectedChip === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedChip(chip);
                }}
                className={`min-h-[44px] rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                  isSelected
                    ? "bg-[#176B45] text-white shadow-xs"
                    : "border border-[#DCE5DC] bg-[#F7F8F4] text-[#202A25] hover:bg-[#E9F3ED]"
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>

        {matchedRule ? (
          <div className="rounded-2xl border border-[#DCE5DC] bg-[#F7F8F4] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#65736A]">
                  Use compartment:
                </span>
                <span className="rounded-full bg-[#176B45] px-3 py-0.5 text-xs font-bold text-white">
                  {matchedRule.categoryLabel}
                </span>
              </div>
              <p className="text-sm text-[#202A25] font-medium">
                {matchedRule.tip}
              </p>
              {loading ? (
                <div className="h-4 w-56 rounded bg-[#E1E8E1] animate-pulse" />
              ) : (
                shuimuStatus && (
                  <p
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      shuimuStatus.state === "available"
                        ? "text-[#176B45]"
                        : shuimuStatus.state === "full"
                          ? "text-amber-700"
                          : "text-[#65736A]"
                    }`}
                  >
                    {shuimuStatus.state === "available" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    {shuimuStatus.text}
                  </p>
                )
              )}
            </div>

            {shuimuStation && (
              <Link
                href={`/stations/${encodeURIComponent(shuimuStation.station_id)}`}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-white border border-[#DCE5DC] px-4 py-2 text-xs font-semibold text-[#176B45] hover:bg-[#E9F3ED] transition shrink-0"
              >
                View {shuimuStation.name}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#DCE5DC] bg-[#F7F8F4] p-4 text-sm text-[#65736A]">
            No exact match for &ldquo;{query}&rdquo;. Try checking our{" "}
            <Link
              href="/sorting-guide"
              className="font-semibold text-[#176B45] underline"
            >
              full sorting guide
            </Link>{" "}
            or use <strong>General</strong> for food-soiled items.
          </div>
        )}
      </div>
    </section>
  );
}
