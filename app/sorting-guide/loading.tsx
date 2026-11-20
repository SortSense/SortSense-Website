import { PublicHeader } from '@/components/shell/public-header';
import { PublicFooter } from '@/components/shell/public-footer';

export default function SortingGuideLoading() {
  return (
    <div className="site-shell" aria-busy="true" aria-live="polite">
      <PublicHeader />

      <main className="renew-guide">
        {/* Editorial Hero Skeleton */}
        <section className="guide-editorial-hero page-width">
          <div className="guide-editorial-copy space-y-4">
            <div className="h-4 w-32 bg-[#e1e8e1] rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="h-14 w-4/5 bg-[#d7e3da] rounded-xl animate-pulse" />
              <div className="h-14 w-3/5 bg-[#176B45]/20 rounded-xl animate-pulse" />
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-4 w-full bg-[#e1e8e1] rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-[#e1e8e1] rounded animate-pulse" />
            </div>
            <div className="h-12 w-full max-w-[500px] bg-white rounded-xl border border-[#e1e8e1] animate-pulse" />
          </div>

          <div className="guide-editorial-photo bg-[#e5ebe6] min-h-[440px] rounded-[50px_2px_2px_2px] animate-pulse flex items-center justify-center">
            <span className="text-xs text-[#65736a] font-semibold">
              Loading recycling catalog…
            </span>
          </div>
        </section>

        {/* Catalog Section Skeleton */}
        <section className="guide-catalog page-width">
          <div className="renew-section-head mb-8">
            <div className="h-4 w-28 bg-[#d7e3da] rounded animate-pulse" />
            <div className="h-8 w-64 bg-[#202A25]/20 rounded animate-pulse mt-2" />
          </div>

          <div className="guide-tile-grid">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-56 bg-white rounded-xl border border-[#e1e8e1] p-5 flex flex-col justify-between animate-pulse"
              >
                <div className="flex justify-between items-start">
                  <div className="h-3 w-8 bg-[#e1e8e1] rounded" />
                  <div className="w-9 h-9 rounded-lg bg-[#f0f4f0]" />
                </div>
                <div className="space-y-2">
                  <div className="h-5 w-24 bg-[#d7e3da] rounded" />
                  <div className="h-3 w-full bg-[#f4f7f4] rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Focus Panel Skeleton */}
        <section className="guide-focus">
          <div className="page-width guide-focus-grid">
            <aside className="space-y-4">
              <div className="h-3.5 w-28 bg-white/30 rounded-full animate-pulse" />
              <div className="w-20 h-24 rounded-2xl bg-white/20 animate-pulse" />
              <div className="h-9 w-40 bg-white/30 rounded-xl animate-pulse" />
              <div className="h-3.5 w-full bg-white/20 rounded animate-pulse" />
            </aside>

            <div className="focus-guidelines">
              <div className="h-44 bg-white rounded-xl p-5 space-y-3 animate-pulse">
                <div className="h-4 w-32 bg-[#176B45]/20 rounded" />
                <div className="h-3 w-full bg-[#f4f7f4] rounded" />
                <div className="h-3 w-4/5 bg-[#f4f7f4] rounded" />
              </div>

              <div className="h-44 bg-white rounded-xl p-5 space-y-3 animate-pulse">
                <div className="h-4 w-32 bg-[#C84F49]/20 rounded" />
                <div className="h-3 w-full bg-[#f4f7f4] rounded" />
                <div className="h-3 w-4/5 bg-[#f4f7f4] rounded" />
              </div>

              <div className="h-36 bg-white rounded-xl p-5 space-y-2 animate-pulse col-span-full">
                <div className="h-4 w-36 bg-[#38A6A0]/20 rounded" />
                <div className="h-3 w-full bg-[#f4f7f4] rounded" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
