import { PublicHeader } from '@/components/shell/public-header';

export default function FindBinLoading() {
  return (
    <div className="site-shell" aria-busy="true" aria-live="polite">
      <PublicHeader />
      <main className="locator-page">
        {/* Header Skeleton */}
        <div className="locator-header page-width">
          <div className="space-y-3">
            <div className="h-4 w-32 bg-[#e1e8e1] rounded-full animate-pulse" />
            <div className="h-9 w-72 bg-[#d7e3da] rounded-xl animate-pulse" />
            <div className="h-4 w-96 max-w-full bg-[#e1e8e1] rounded-md animate-pulse" />
          </div>
          <div className="h-14 w-72 max-w-full bg-[#eef3ef] rounded-xl border border-[#e1e8e1] animate-pulse" />
        </div>

        {/* Toolbar Skeleton */}
        <div className="locator-toolbar page-width">
          <div className="h-11 flex-1 bg-white rounded-xl border border-[#e1e8e1] animate-pulse" />
          <div className="h-11 w-28 bg-white rounded-xl border border-[#e1e8e1] animate-pulse" />
        </div>

        {/* Category Pills Skeleton */}
        <div className="category-bar page-width">
          {[80, 72, 68, 68, 96].map((w, i) => (
            <div
              key={i}
              style={{ width: `${w}px` }}
              className="h-8 bg-white rounded-lg border border-[#e1e8e1] shrink-0 animate-pulse"
            />
          ))}
        </div>

        {/* Workspace Split Skeleton */}
        <section className="locator-workspace">
          {/* Station Panel Skeleton */}
          <div className="station-panel">
            <div className="panel-summary">
              <div className="space-y-1.5">
                <div className="h-3.5 w-20 bg-[#d7e3da] rounded animate-pulse" />
                <div className="h-2.5 w-28 bg-[#e1e8e1] rounded animate-pulse" />
              </div>
              <div className="h-7 w-28 bg-[#f6f8f6] rounded-md animate-pulse" />
            </div>

            <div className="station-scroll">
              {/* Highlight Card Skeleton */}
              <div className="h-40 bg-[#176B45]/20 rounded-xl border border-[#176B45]/30 p-4 space-y-3 animate-pulse">
                <div className="h-3 w-28 bg-[#D8ED8F]/40 rounded-full" />
                <div className="h-5 w-48 bg-white/40 rounded" />
                <div className="h-3 w-36 bg-white/30 rounded" />
              </div>

              {/* Station Card Skeletons */}
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-[#e1e8e1] p-4 space-y-3 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#eaf3ed]" />
                      <div className="space-y-1.5">
                        <div className="h-4 w-32 bg-[#d7e3da] rounded" />
                        <div className="h-2.5 w-20 bg-[#e1e8e1] rounded" />
                      </div>
                    </div>
                    <div className="h-3 w-12 bg-[#e1e8e1] rounded" />
                  </div>
                  <div className="h-2.5 w-40 bg-[#e1e8e1] rounded" />
                  <div className="space-y-2 pt-2 border-t border-[#f0f4f0]">
                    <div className="h-4 w-full bg-[#f4f7f4] rounded" />
                    <div className="h-4 w-full bg-[#f4f7f4] rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Map Panel Skeleton */}
          <div className="map-panel">
            <div className="station-map flex flex-col items-center justify-center bg-[#e5eae5] animate-pulse">
              <span className="text-xs text-[#65736a] font-semibold">
                Loading campus map…
              </span>
            </div>
            <div className="map-demo-notice animate-pulse opacity-60">
              Loading telemetry…
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
