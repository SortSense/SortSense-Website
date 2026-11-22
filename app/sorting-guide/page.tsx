"use client";
/* eslint-disable @next/next/no-img-element */

import {
  ArrowRight,
  Check,
  ListFilter,
  MapPin,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { categories, type CategorySlug } from "@/lib/categories";
import { PublicHeader } from "@/components/shell/public-header";
import { PublicFooter } from "@/components/shell/public-footer";

const CATEGORY_PREVIEW_MEDIA: Record<
  CategorySlug,
  { imageUrl: string; alt: string; quickTip: string }
> = {
  plastic: {
    imageUrl:
      "https://images.unsplash.com/photo-1571727153934-b9e0059b7ab2?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
    alt: "Clean transparent plastic bottles and rigid containers",
    quickTip: "Rinse out liquids · Keep caps attached",
  },
  paper: {
    imageUrl:
      "https://images.unsplash.com/photo-1654372066379-d8a1c70f7363?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
    alt: "Clean recyclable paper and flattened cardboard boxes",
    quickTip: "Keep dry · Flatten boxes before disposal",
  },
  metal: {
    imageUrl:
      "https://images.unsplash.com/photo-1689555256964-aeabc20d1d3c?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
    alt: "Clean aluminum beverage cans and metal tins",
    quickTip: "Empty residue · Lightly rinse cans",
  },
  general: {
    imageUrl:
      "https://images.unsplash.com/photo-1619540034640-0d41b5e0f6fc?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
    alt: "Everyday non-recyclable waste items",
    quickTip: "Bag loose items · Keep liquids out",
  },
};

function GuideContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initialParam = params.get("category") as CategorySlug | null;

  const [selectedSlug, setSelectedSlug] = useState<CategorySlug | "all">(
    categories.some((item) => item.slug === initialParam)
      ? initialParam!
      : "all",
  );
  const [query, setQuery] = useState("");

  const handleSelectCategory = (slug: CategorySlug | "all") => {
    setSelectedSlug(slug);
    if (slug === "all") {
      router.replace("/sorting-guide");
    } else {
      router.replace(`/sorting-guide?category=${slug}`);
    }
  };

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return categories.filter((item) => {
      const matchesTab = selectedSlug === "all" || item.slug === selectedSlug;
      if (!matchesTab) return false;
      if (!trimmed) return true;
      return `${item.name} ${item.shortDescription} ${item.description} ${item.accepts.join(" ")} ${item.avoids.join(" ")} ${item.preparation}`
        .toLowerCase()
        .includes(trimmed);
    });
  }, [selectedSlug, query]);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Compact Header & Search/Filter Controls */}
      <section className="bg-white rounded-2xl border border-[#DCE5DC] p-4 sm:p-5 shadow-[0_1px_3px_rgba(20,83,45,0.03)] space-y-4">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF4ED] border border-[#D1E6D7] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#14532D]">
            Campus Sorting Reference
          </span>
          <h1 className="font-jakarta text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-[#14231B]">
            Know before you <span className="text-[#14532D]">throw.</span>
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
            Search an item or filter by waste stream to check accepted examples,
            what to keep out, and where to find an available bin nearby.
          </p>
        </div>

        {/* Compact Search Input + Category Filter Pills */}
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <label className="flex-1 min-w-0 md:max-w-sm h-9 px-3 rounded-xl border border-[#DCE5DC] bg-[#F8F9F6] focus-within:bg-white focus-within:border-[#14532D] focus-within:ring-2 focus-within:ring-[#14532D]/10 flex items-center gap-2 transition">
            <Search size={14} className="text-[#7A8A80] shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search an item (e.g. bottle, cardboard, tissues)..."
              className="w-full min-w-0 bg-transparent text-xs text-[#1A2620] placeholder:text-[#8A9890] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="text-[#7A8A80] hover:text-[#1A2620]"
              >
                <X size={13} />
              </button>
            )}
          </label>

          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Filter sorting categories"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedSlug === "all"}
              onClick={() => handleSelectCategory("all")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                selectedSlug === "all"
                  ? "bg-[#14532D] border-[#14532D] text-white shadow-xs"
                  : "bg-white border-[#DCE5DC] text-[#4E5E55] hover:border-[#A7C4B2] hover:text-[#14532D]"
              }`}
            >
              <ListFilter size={12} />
              <span>All categories</span>
            </button>

            {categories.map((cat) => {
              const isActive = selectedSlug === cat.slug;
              return (
                <button
                  key={cat.slug}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleSelectCategory(cat.slug)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    isActive
                      ? "bg-[#14532D] border-[#14532D] text-white shadow-xs"
                      : "bg-white border-[#DCE5DC] text-[#4E5E55] hover:border-[#A7C4B2] hover:text-[#14532D]"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      isActive ? "ring-2 ring-white/45" : ""
                    }`}
                    style={{ backgroundColor: cat.color }}
                  />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Proportional Category Guide Cards Grid */}
      {filtered.length === 0 ? (
        <section className="bg-white rounded-2xl border border-[#DCE5DC] p-10 text-center space-y-2">
          <Search size={24} className="text-[#8FA095] mx-auto" />
          <h2 className="font-jakarta text-base font-bold text-[#14231B]">
            No matching guidance found
          </h2>
          <p className="text-xs text-[#65736A]">
            Try searching for plastic, paper, metal, cans, or general waste.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              handleSelectCategory("all");
            }}
            className="mt-2 inline-flex items-center justify-center h-9 px-4 rounded-full bg-[#EAF3ED] text-[#14532D] text-xs font-bold hover:bg-[#DCECE1] transition-colors"
          >
            Reset filters
          </button>
        </section>
      ) : (
        <section
          aria-label="Waste category guides"
          className={`grid gap-4 ${
            filtered.length === 1
              ? "grid-cols-1 max-w-3xl"
              : "grid-cols-1 md:grid-cols-2"
          }`}
        >
          {filtered.map((category) => {
            const media = CATEGORY_PREVIEW_MEDIA[category.slug];
            return (
              <article
                key={category.slug}
                className="bg-white rounded-2xl border border-[#DCE5DC] p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-[0_1px_3px_rgba(20,83,45,0.03)] hover:border-[#B2CEBC] transition-colors"
              >
                <div className="space-y-3.5">
                  {/* Constrained Category Preview Image */}
                  <div className="relative h-[165px] sm:h-[185px] max-h-[180px] sm:max-h-[200px] w-full rounded-xl overflow-hidden bg-[#E9EFEA] border border-black/5">
                    <img
                      src={media.imageUrl}
                      alt={media.alt}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none" />
                    <span
                      className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs"
                      style={{ backgroundColor: category.color }}
                    >
                      {category.name}
                    </span>
                    <span className="absolute bottom-2.5 left-2.5 right-2.5 text-[11px] font-semibold text-white/95 truncate">
                      {media.quickTip}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <h2 className="font-jakarta text-lg font-semibold text-[#14231B]">
                        {category.name}
                      </h2>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-[#55655C] leading-relaxed">
                      {category.shortDescription}. {category.description}
                    </p>
                  </div>

                  {/* Accepted / Not Accepted Lists */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-[#F2F9F4] border border-[#D8ECE0] p-3 space-y-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#14532D]">
                        <Check size={12} />
                        Accepted
                      </span>
                      <ul className="text-xs space-y-1 text-[#2E4237]">
                        {category.accepts.map((item) => (
                          <li key={item} className="flex items-center gap-1.5">
                            <Check
                              size={11}
                              className="text-[#16A34A] shrink-0"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#FFF6F5] border border-[#F7DCD8] p-3 space-y-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#A63A34]">
                        <X size={12} />
                        Not Accepted
                      </span>
                      <ul className="text-xs space-y-1 text-[#6C3430]">
                        {category.avoids.map((item) => (
                          <li key={item} className="flex items-center gap-1.5">
                            <X size={11} className="text-[#C84F49] shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Compact Preparation Note */}
                  <div className="rounded-xl bg-[#F7F9F7] border border-[#E5ECE6] px-3 py-2 flex items-start gap-2 text-xs text-[#47574E]">
                    <ShieldAlert
                      size={14}
                      className="text-[#14532D] shrink-0 mt-0.5"
                    />
                    <span>
                      <strong className="font-semibold text-[#14231B]">
                        Before disposal:
                      </strong>{" "}
                      {category.preparation}
                    </span>
                  </div>
                </div>

                {/* Compact Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EDF1ED]">
                  <Link
                    href={`/find-bin?category=${category.slug}`}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#14532D] hover:bg-[#0F3F22] text-white text-xs font-semibold transition-colors shadow-xs"
                  >
                    <span>Find {category.name} bin</span>
                    <ArrowRight size={13} />
                  </Link>
                  <Link
                    href="/find-bin"
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-[#DCE5DC] bg-white hover:bg-[#F3F7F4] text-[#14532D] text-xs font-semibold transition-colors"
                  >
                    <MapPin size={13} />
                    <span>View nearby stations</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

export default function SortingGuidePage() {
  return (
    <div className="site-shell min-h-screen flex flex-col bg-[#F8F9F6]">
      <PublicHeader />
      <Suspense
        fallback={
          <div className="route-loading">
            <span />
            <strong>Loading Sorting Guide…</strong>
          </div>
        }
      >
        <GuideContent />
      </Suspense>
      <PublicFooter />
    </div>
  );
}
