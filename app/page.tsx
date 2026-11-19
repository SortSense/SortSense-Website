import Link from 'next/link';
import {
  Recycle,
  MapPin,
  BarChart3,
  Cpu,
  ArrowRight,
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-sm">
              <Recycle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-black text-gray-900 tracking-tight block">SortSense</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                Smart Campus Waste
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Staff Login
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-sm"
            >
              Open Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            SortSense Cloud Architecture Active
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-gray-900 tracking-tight leading-tight">
            Intelligent Waste Sorting &amp; <span className="text-emerald-700">Campus Monitoring</span>
          </h1>

          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
            Real-time Time-of-Flight fill monitoring, AI classification verification, and centralized campus analytics — powering sustainable university operations.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all hover:shadow-lg"
            >
              <LayoutDashboardIcon className="w-4 h-4" />
              Launch Monitoring Dashboard
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 font-bold text-sm shadow-xs transition-colors"
            >
              Staff Portal
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-5xl mx-auto w-full">
          {/* Card 1 */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Campus Map &amp; Fill Status</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Real-time Green/Yellow/Red station status tracking based on ToF distance sensor measurements with automated janitor collection alerts.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">ESP32 &amp; Edge AI Ingestion</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Standardized HTTP REST telemetry ingestion from Fabio&apos;s ESP32-S3 controllers and Edric&apos;s AI inference backend to Supabase PostgreSQL.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Interactive Recycling Analytics</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Daily sorting accuracy metrics, diversion ratios, and 4-compartment volume breakdown powered by Recharts data visualization.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
          <div className="flex items-center gap-2">
            <Recycle className="w-4 h-4 text-emerald-700" />
            <span>SortSense — Smart Campus Waste Management System</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-gray-400">Owner: Kiyo</span>
            <span>•</span>
            <Link href="/login" className="hover:text-emerald-700">Staff Access</Link>
            <span>•</span>
            <Link href="/dashboard" className="hover:text-emerald-700">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LayoutDashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}
