import { PublicHeader } from "@/components/shell/public-header";
import { PublicFooter } from "@/components/shell/public-footer";

export default function StationDetailLoading() {
  return (
    <div
      className="site-shell min-h-screen flex flex-col bg-[#F8F9F6]"
      aria-busy="true"
      aria-live="polite"
    >
      <PublicHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-5">
        <div className="h-4 w-32 bg-[#D7E3DA] rounded animate-pulse mb-2" />

        {/* Compact Hero Skeleton */}
        <section className="bg-white rounded-2xl border border-[#DCE5DC] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-pulse">
          <div className="flex-1 space-y-3">
            <div className="h-5 w-48 bg-[#E1E8E1] rounded-full" />
            <div className="h-7 w-72 max-w-full bg-[#D7E3DA] rounded-lg" />
            <div className="h-3.5 w-60 bg-[#E6ECE6] rounded" />
            <div className="flex gap-2 pt-1">
              <div className="h-9 w-32 bg-[#14532D]/25 rounded-full" />
              <div className="h-9 w-32 bg-[#E6ECE6] rounded-full" />
            </div>
          </div>
          <div className="h-[170px] sm:h-[185px] w-full lg:w-[320px] rounded-xl bg-[#E5EAE5] flex items-center justify-center">
            <span className="text-xs text-[#65736A] font-semibold">
              Loading station map…
            </span>
          </div>
        </section>

        {/* 4-Column Bins Grid Skeleton */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-6 w-44 bg-[#D7E3DA] rounded animate-pulse" />
            <div className="h-6 w-32 bg-white border border-[#DCE5DC] rounded-full animate-pulse" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[#DCE5DC] p-3.5 space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-[#D7E3DA] rounded" />
                  <div className="h-5 w-16 bg-[#EAF3ED] rounded-full" />
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 w-14 bg-[#E1E8E1] rounded" />
                    <div className="h-5 w-10 bg-[#D7E3DA] rounded" />
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full" />
                  <div className="h-2.5 w-28 bg-[#E6ECE6] rounded" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-28 bg-[#EFF2EF] rounded" />
                  <div className="h-3 w-24 bg-[#EFF2EF] rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
