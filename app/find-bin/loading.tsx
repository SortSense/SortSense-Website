import { PublicHeader } from "@/components/shell/public-header";

export default function FindBinLoading() {
  return (
    <div
      className="site-shell lg:h-screen lg:overflow-hidden"
      aria-busy="true"
      aria-live="polite"
    >
      <PublicHeader />
      <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-4 lg:h-[calc(100vh-82px)] lg:overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:h-full lg:min-h-0">
          {/* Left 50% Column Skeleton */}
          <section className="flex flex-col min-w-0 lg:h-full lg:overflow-hidden">
            <div className="shrink-0 space-y-2 pb-2.5">
              <div className="h-5 w-52 bg-[#E1E8E1] rounded-full animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-7 w-64 bg-[#D7E3DA] rounded-xl animate-pulse" />
                <div className="h-3.5 w-80 max-w-full bg-[#E1E8E1] rounded-md animate-pulse" />
              </div>
              <div className="h-8 w-full bg-[#EDF4EF] rounded-xl border border-[#DCE8E0] animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-9 flex-1 bg-white rounded-xl border border-[#DCE5DC] animate-pulse" />
                <div className="h-9 w-24 bg-white rounded-xl border border-[#DCE5DC] animate-pulse" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[80, 68, 64, 64, 96].map((w, i) => (
                  <div
                    key={i}
                    style={{ width: `${w}px` }}
                    className="h-7 bg-white rounded-full border border-[#DCE5DC] animate-pulse"
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col rounded-2xl bg-[#F2F5F1] border border-[#E1E8E1] overflow-hidden">
              <div className="shrink-0 px-3.5 py-2 bg-white border-b border-[#E7EDE7] flex items-center justify-between">
                <div className="h-4 w-44 bg-[#D7E3DA] rounded animate-pulse" />
                <div className="h-7 w-24 bg-[#F6F8F6] rounded-lg animate-pulse" />
              </div>

              <div className="flex-1 min-h-0 p-2.5 space-y-2.5 overflow-hidden">
                {[1, 2].map((idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-[#E1E8E1] p-3.5 space-y-2.5 animate-pulse"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#EAF3ED]" />
                        <div className="space-y-1">
                          <div className="h-3.5 w-28 bg-[#D7E3DA] rounded" />
                          <div className="h-2.5 w-20 bg-[#E6ECE6] rounded" />
                        </div>
                      </div>
                      <div className="h-5 w-14 bg-[#EAF3ED] rounded-full" />
                    </div>
                    <div className="h-2.5 w-36 bg-[#E6ECE6] rounded" />
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <div className="h-6 bg-[#F5F8F5] rounded" />
                      <div className="h-6 bg-[#F5F8F5] rounded" />
                      <div className="h-6 bg-[#F5F8F5] rounded" />
                      <div className="h-6 bg-[#F5F8F5] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right 50% Column Map Skeleton */}
          <section className="relative flex flex-col h-[480px] lg:h-full lg:min-h-0 rounded-2xl overflow-hidden border border-black/5 shadow-sm bg-[#E5EAE5]">
            <div className="w-full h-full flex flex-col items-center justify-center animate-pulse">
              <span className="text-xs text-[#65736A] font-semibold">
                Loading campus map…
              </span>
            </div>
            <div className="pointer-events-none absolute top-3 left-14 inline-flex items-center gap-2 rounded-full bg-white/90 border border-black/10 px-3 py-1 text-xs font-semibold text-[#5E6D64] animate-pulse">
              Loading telemetry…
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
