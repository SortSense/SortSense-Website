'use client';

import React from 'react';
import { AnalyticsData, WasteEvent } from './types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Recycle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface AnalyticsViewProps {
  analytics: AnalyticsData | null;
  recentEvents?: WasteEvent[];
  isLoading?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Plastic: '#3B82F6',
  Paper: '#F59E0B',
  Metal: '#94A3B8',
  'General Waste': '#475569',
};

export default function AnalyticsView({
  analytics,
  recentEvents = [],
  isLoading = false,
}: AnalyticsViewProps) {
  if (isLoading || !analytics) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-gray-100 rounded-2xl" />
          <div className="h-72 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { total_items_today, sorting_accuracy_pct, breakdown } = analytics;

  const totalRecycled = breakdown.plastic + breakdown.paper + breakdown.metal;
  const recyclingRatePct =
    total_items_today > 0 ? ((totalRecycled / total_items_today) * 100).toFixed(1) : '0.0';

  const barData = [
    { name: 'Plastic', count: breakdown.plastic, fill: CATEGORY_COLORS.Plastic },
    { name: 'Paper', count: breakdown.paper, fill: CATEGORY_COLORS.Paper },
    { name: 'Metal', count: breakdown.metal, fill: CATEGORY_COLORS.Metal },
    { name: 'General', count: breakdown.general, fill: CATEGORY_COLORS['General Waste'] },
  ];

  const pieData = [
    { name: 'Plastic', value: breakdown.plastic, color: CATEGORY_COLORS.Plastic },
    { name: 'Paper', value: breakdown.paper, color: CATEGORY_COLORS.Paper },
    { name: 'Metal', value: breakdown.metal, color: CATEGORY_COLORS.Metal },
    { name: 'General Waste', value: breakdown.general, color: CATEGORY_COLORS['General Waste'] },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sorted */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Total Sorted Today
            </span>
            <span className="text-3xl font-extrabold text-gray-900 mt-1 block font-mono">
              {total_items_today.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Live hardware feeds
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Recycle className="w-6 h-6" />
          </div>
        </div>

        {/* Sorting Accuracy */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Sorting Accuracy
            </span>
            <span className="text-3xl font-extrabold text-gray-900 mt-1 block font-mono">
              {sorting_accuracy_pct}%
            </span>
            <span
              className={`text-xs font-medium flex items-center gap-1 mt-1 ${
                sorting_accuracy_pct >= 85
                  ? 'text-emerald-600'
                  : sorting_accuracy_pct >= 70
                  ? 'text-amber-600'
                  : 'text-red-600'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              {sorting_accuracy_pct >= 85 ? 'Campus High Benchmark' : 'Needs User Guidance'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Recycled Items Diverted */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Recyclables Diverted
            </span>
            <span className="text-3xl font-extrabold text-gray-900 mt-1 block font-mono">
              {totalRecycled.toLocaleString()}
            </span>
            <span className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-1">
              <Sparkles className="w-3.5 h-3.5" />
              {recyclingRatePct}% overall diversion
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        {/* General Waste */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              General Waste
            </span>
            <span className="text-3xl font-extrabold text-gray-900 mt-1 block font-mono">
              {breakdown.general.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-1">
              Incineration & Landfill
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Recharts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Daily Category Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Category Breakdown (Daily)</h3>
              <p className="text-xs text-gray-500">Total items deposited per waste stream</p>
            </div>
            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              Today
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie/Donut Chart: Waste Stream Composition */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Waste Stream Distribution</h3>
              <p className="text-xs text-gray-500">Proportional volume by compartment</p>
            </div>
            <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
              Recharts
            </span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live AI Verified Waste Drop Events Feed */}
      {recentEvents && recentEvents.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Recent Waste Drop Events</h3>
              <p className="text-xs text-gray-500">
                Verified logs from Edric&apos;s AI Backend & IR Break-beam sensors
              </p>
            </div>
            <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
              Live Feed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-100">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Station</th>
                  <th className="py-2.5 px-3">AI Prediction</th>
                  <th className="py-2.5 px-3">Deposited Bin</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {recentEvents.slice(0, 8).map((evt) => (
                  <tr key={evt.event_id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 font-mono">
                      {new Date(evt.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">{evt.station_id}</td>
                    <td className="py-2.5 px-3 capitalize">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[
                                evt.waste_category === 'general'
                                  ? 'General Waste'
                                  : evt.waste_category.charAt(0).toUpperCase() +
                                    evt.waste_category.slice(1)
                              ] || '#94a3b8',
                          }}
                        />
                        {evt.waste_category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 capitalize text-gray-600">{evt.dropped_in_bin}</td>
                    <td className="py-2.5 px-3 font-mono">
                      {(evt.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3">
                      {evt.is_correct_sort ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" />
                          Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
                          <XCircle className="w-3 h-3" />
                          Wrong Bin
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
