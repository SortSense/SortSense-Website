import { PublicHeader } from "@/components/shell/public-header";

export default function FindBinLoading() {
  return (
    <div className="site-shell" aria-busy="true" aria-live="polite">
      <PublicHeader />
      <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[calc(100vh-76px)] items-start">
          {/* Left 50% Column Skeleton */}
          <section className="flex flex-col min-w-0 lg:h-[calc(100vh-108px)] lg:min-h-[580px]">
            <div className="shrink-0 space-y-3.5 pb-4">
              <div className="h-6 w-60 bg-[#E1E8E1] rounded-full animate-pulse" />
              <div className="space-y-2">
                <div className="h-9 w-72 bg-[#D7E3DA] rounded-xl animate-pulse" />
                <div className="h-4 w-96 max-w-full bg-[#E1E8E1] rounded-md animate-pulse" />
              </div>
              <div className="h-10 w-full bg-[#EDF4EF] rounded-xl border border-[#DCE8E0] animate-pulse" />
              <div className="flex items-center gap-2.5">
                <div className="h-11 flex-1 bg-white rounded-xl border border-[#DCE5DC] animate-pulse" />
                <div className="h-11 w-28 bg-white rounded-xl border border-[#DCE5DC] animate-pulse" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[88, 76, 72, 72, 108].map((w, i) => (
                  <div
                    key={i}
                    style={{ width: `${w}px` }}
                    className="h-9 bg-white rounded-full border border-[#DCE5DC] animate-pulse"
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col rounded-2xl bg-[#F2F5F1] border border-[#E1E8E1] overflow-hidden">
              <div className="shrink-0 px-4 py-3 bg-white border-b border-[#E7EDE7] flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-4 w-24 bg-[#D7E3DA] rounded animate-pulse" />
                  <div className="h-3 w-32 bg-[#E6ECE6] rounded animate-pulse" />
                </div>
                <div className="h-8 w-28 bg-[#F6F8F6] rounded-lg animate-pulse" />
              </div>

              <div className="flex-1 p-3 space-y-3">
                {[1, 2].map((idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-[#E1E8E1] p-4 space-y-3 animate-pulse"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#EAF3ED]" />
                        <div className="space-y-1.5">
                          <div className="h-4 w-32 bg-[#D7E3DA] rounded" />
                          <div className="h-3 w-24 bg-[#E6ECE6] rounded" />
                        </div>
                      </div>
                      <div className="h-5 w-14 bg-[#EAF3ED] rounded-full" />
                    </div>
                    <div className="h-3 w-44 bg-[#E6ECE6] rounded" />
                    <div className="space-y-2 pt-2 border-t border-[#F0F4F0]">
                      <div className="h-6 w-full bg-[#F5F8F5] rounded" />
                      <div className="h-6 w-full bg-[#F5F8F5] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right 50% Column Map Skeleton */}
          <section className="relative flex flex-col h-[520px] lg:h-[calc(100vh-108px)] lg:sticky lg:top-[92px] rounded-2xl overflow-hidden border border-black/5 shadow-sm bg-[#E5EAE5]">
            <div className="w-full h-full flex flex-col items-center justify-center animate-pulse">
              <span className="text-xs text-[#65736A] font-semibold">
                Loading campus map…
              </span>
            </div>
            <div className="pointer-events-none absolute top-3 left-14 inline-flex items-center gap-2 rounded-full bg-white/90 border border-black/10 px-3 py-1.5 text-xs font-semibold text-[#5E6D64] animate-pulse">
              Loading telemetry…
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
