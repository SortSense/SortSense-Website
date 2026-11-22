import { PublicHeader } from "@/components/shell/public-header";
import { PublicFooter } from "@/components/shell/public-footer";

export default function SortingGuideLoading() {
  return (
    <div
      className="site-shell min-h-screen flex flex-col bg-[#F8F9F6]"
      aria-busy="true"
      aria-live="polite"
    >
      <PublicHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Compact Header Skeleton */}
        <section className="bg-white rounded-2xl border border-[#DCE5DC] p-4 sm:p-5 space-y-4 animate-pulse">
          <div className="space-y-2">
            <div className="h-4 w-36 bg-[#E1E8E1] rounded-full" />
            <div className="h-8 w-64 bg-[#D7E3DA] rounded-xl" />
            <div className="h-4 w-96 max-w-full bg-[#E6ECE6] rounded" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="h-9 w-72 max-w-full bg-[#F2F5F2] rounded-xl border border-[#DCE5DC]" />
            {[90, 72, 68, 68, 102].map((w, i) => (
              <div
                key={i}
                style={{ width: `${w}px` }}
                className="h-8 bg-white rounded-full border border-[#DCE5DC]"
              />
            ))}
          </div>
        </section>

        {/* 2-Column Guide Cards Skeleton */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-[#DCE5DC] p-4 sm:p-5 space-y-3.5 animate-pulse"
            >
              <div className="h-[165px] sm:h-[185px] w-full rounded-xl bg-[#E5EAE5]" />
              <div className="space-y-2">
                <div className="h-5 w-28 bg-[#D7E3DA] rounded" />
                <div className="h-3.5 w-full bg-[#E6ECE6] rounded" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="h-24 bg-[#F2F9F4] rounded-xl" />
                <div className="h-24 bg-[#FFF6F5] rounded-xl" />
              </div>
              <div className="flex gap-2 pt-2">
                <div className="h-9 w-36 bg-[#14532D]/20 rounded-full" />
                <div className="h-9 w-36 bg-[#E6ECE6] rounded-full" />
              </div>
            </div>
          ))}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
