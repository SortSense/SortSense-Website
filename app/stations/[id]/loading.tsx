import { PublicHeader } from '@/components/shell/public-header';
import { PublicFooter } from '@/components/shell/public-footer';

export default function StationDetailLoading() {
  return (
    <div className="site-shell" aria-busy="true" aria-live="polite">
      <PublicHeader />

      <main className="station-page page-width">
        {/* Back Link Skeleton */}
        <div className="my-6 inline-flex items-center gap-2">
          <div className="h-4 w-32 bg-[#d7e3da] rounded-md animate-pulse" />
        </div>

        {/* Station Hero Skeleton */}
        <section className="station-hero">
          <div className="station-title space-y-4">
            <div className="h-4 w-36 bg-[#e1e8e1] rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="h-10 w-3/4 bg-[#d7e3da] rounded-xl animate-pulse" />
              <div className="h-10 w-1/2 bg-[#176B45]/20 rounded-xl animate-pulse" />
            </div>
            <div className="space-y-1.5 pt-2">
              <div className="h-3.5 w-full bg-[#e1e8e1] rounded animate-pulse" />
              <div className="h-3.5 w-4/5 bg-[#e1e8e1] rounded animate-pulse" />
            </div>

            <div className="station-meta py-2">
              <div className="h-3.5 w-48 bg-[#e1e8e1] rounded animate-pulse" />
            </div>

            <div className="station-title-actions flex gap-3 pt-2">
              <div className="h-10 w-36 bg-[#176B45]/30 rounded-xl animate-pulse" />
              <div className="h-10 w-36 bg-[#e1e8e1] rounded-xl animate-pulse" />
            </div>
          </div>

          <div className="station-mini-map bg-[#e5eae5] rounded-xl animate-pulse flex items-center justify-center">
            <span className="text-xs text-[#65736a] font-semibold">
              Loading station map…
            </span>
          </div>
        </section>

        {/* Bins Section Skeleton */}
        <section className="bins-section">
          <div className="section-heading flex justify-between items-end mb-6">
            <div className="space-y-2">
              <div className="h-3 w-28 bg-[#d7e3da] rounded animate-pulse" />
              <div className="h-7 w-56 bg-[#202A25]/20 rounded animate-pulse" />
            </div>
            <div className="h-4 w-32 bg-[#e1e8e1] rounded animate-pulse" />
          </div>

          <div className="bin-detail-grid">
            {[1, 2, 3, 4].map((i) => (
              <article key={i} className="bin-detail-card space-y-4 animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-10 rounded-md bg-[#d7e3da]" />
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-16 bg-[#e1e8e1] rounded" />
                      <div className="h-4 w-32 bg-[#d7e3da] rounded" />
                    </div>
                  </div>
                  <div className="h-6 w-20 rounded-full bg-[#eaf3ed]" />
                </div>

                <div className="p-4 bg-[#f6f8f5] rounded-xl space-y-2.5">
                  <div className="flex justify-between items-center">
                    <div className="h-3 w-24 bg-[#e1e8e1] rounded" />
                    <div className="h-5 w-12 bg-[#d7e3da] rounded" />
                  </div>
                  <div className="h-2 w-full bg-[#e5ebe6] rounded-full" />
                  <div className="h-2.5 w-36 bg-[#e1e8e1] rounded" />
                </div>

                <div className="space-y-2 pt-2">
                  <div className="h-3 w-28 bg-[#e1e8e1] rounded" />
                  <div className="flex gap-2">
                    <div className="h-5 w-20 rounded-md bg-[#f0f4f0]" />
                    <div className="h-5 w-24 rounded-md bg-[#f0f4f0]" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Prototype Callout Skeleton */}
        <div className="prototype-callout my-8 h-20 bg-[#edf3ef] rounded-xl animate-pulse" />
      </main>

      <PublicFooter />
    </div>
  );
}
