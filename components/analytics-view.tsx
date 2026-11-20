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
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface AnalyticsViewProps {
  analytics: AnalyticsData | null;
  recentEvents?: WasteEvent[];
  isLoading?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Plastic: '#38A6A0',
  Paper: '#D49A3A',
  Metal: '#71849A',
  'General Waste': '#776F68',
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
            <div key={i} className="h-28 bg-[#EFF2EF] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-[#EFF2EF] rounded-xl" />
          <div className="h-72 bg-[#EFF2EF] rounded-xl" />
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
        <div className="bg-white p-5 rounded-xl border border-[#E1E8E1] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#65736A] uppercase tracking-wider block font-display">
              Total Sorted Today
            </span>
            <span className="text-3xl font-extrabold text-[#202A25] mt-1 block font-mono">
              {total_items_today.toLocaleString()}
            </span>
            <span className="text-xs text-[#176B45] font-medium flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Live verified drops
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E9F3ED] text-[#176B45] flex items-center justify-center">
            <Recycle className="w-5 h-5" />
          </div>
        </div>

        {/* Sorting Accuracy */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E8E1] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#65736A] uppercase tracking-wider block font-display">
              Sorting Accuracy
            </span>
            <span className="text-3xl font-extrabold text-[#202A25] mt-1 block font-mono">
              {sorting_accuracy_pct !== null ? `${sorting_accuracy_pct}%` : 'Unavailable'}
            </span>
            <span
              className={`text-xs font-medium flex items-center gap-1 mt-1 ${
                sorting_accuracy_pct === null
                  ? 'text-[#65736A]'
                  : sorting_accuracy_pct >= 85
                  ? 'text-[#176B45]'
                  : sorting_accuracy_pct >= 70
                  ? 'text-[#C48419]'
                  : 'text-[#C84F49]'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              {sorting_accuracy_pct === null
                ? 'Correctness metric not tracked'
                : sorting_accuracy_pct >= 85
                ? 'High Accuracy Standard'
                : 'Requires Guidance'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E9F6F5] text-[#38A6A0] flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* Recycled Items Diverted */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E8E1] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#65736A] uppercase tracking-wider block font-display">
              Recyclables Diverted
            </span>
            <span className="text-3xl font-extrabold text-[#202A25] mt-1 block font-mono">
              {totalRecycled.toLocaleString()}
            </span>
            <span className="text-xs text-[#38A6A0] font-medium flex items-center gap-1 mt-1">
              <Sparkles className="w-3.5 h-3.5" />
              {recyclingRatePct}% diversion ratio
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#FCF5E9] text-[#D49A3A] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* General Waste */}
        <div className="bg-white p-5 rounded-xl border border-[#E1E8E1] shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#65736A] uppercase tracking-wider block font-display">
              General Waste
            </span>
            <span className="text-3xl font-extrabold text-[#202A25] mt-1 block font-mono">
              {breakdown.general.toLocaleString()}
            </span>
            <span className="text-xs text-[#65736A] font-medium flex items-center gap-1 mt-1">
              Non-recyclable volume
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#F4F2F0] text-[#776F68] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Recharts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Daily Category Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-[#E1E8E1] shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#202A25] text-sm font-display">
                Category Breakdown (Daily)
              </h3>
              <p className="text-xs text-[#65736A]">Total verified items per waste stream</p>
            </div>
            <span className="text-xs font-mono bg-[#EFF2EF] text-[#65736A] px-2 py-0.5 rounded font-medium">
              Today
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#65736A' }} stroke="#E1E8E1" />
                <YAxis tick={{ fontSize: 12, fill: '#65736A' }} stroke="#E1E8E1" />
                <Tooltip
                  cursor={{ fill: 'rgba(23, 107, 69, 0.04)' }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #E1E8E1',
                    fontSize: '12px',
                    color: '#202A25',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Stream Distribution */}
        <div className="bg-white p-6 rounded-xl border border-[#E1E8E1] shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#202A25] text-sm font-display">
                Waste Stream Distribution
              </h3>
              <p className="text-xs text-[#65736A]">Proportional volume by compartment</p>
            </div>
            <span className="text-xs font-mono bg-[#E9F3ED] text-[#176B45] px-2 py-0.5 rounded font-semibold">
              Live Ratio
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
                    borderRadius: '8px',
                    border: '1px solid #E1E8E1',
                    fontSize: '12px',
                    color: '#202A25',
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
        <div className="bg-white rounded-xl border border-[#E1E8E1] shadow-2xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#202A25] text-sm font-display">
                Recent AI Verified Drop Events
              </h3>
              <p className="text-xs text-[#65736A]">
                Ingested from Edric&apos;s AI Backend and physical IR break-beam verification
              </p>
            </div>
            <span className="text-xs font-mono bg-[#E9F6F5] text-[#38A6A0] px-2 py-0.5 rounded font-semibold">
              Active Ingestion
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F8F4] text-[#65736A] uppercase tracking-wider font-semibold border-b border-[#E1E8E1] font-display">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Station</th>
                  <th className="py-2.5 px-3">AI Prediction</th>
                  <th className="py-2.5 px-3">Deposited Bin</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E8E1] text-[#202A25]">
                {recentEvents.slice(0, 8).map((evt) => (
                  <tr key={evt.event_id} className="hover:bg-[#E9F3ED]/30 transition-colors">
                    <td className="py-2.5 px-3 text-[#65736A] font-mono text-[11px]">
                      {new Date(evt.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">{evt.station_id}</td>
                    <td className="py-2.5 px-3 capitalize">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[
                                evt.waste_category === 'general'
                                  ? 'General Waste'
                                  : evt.waste_category.charAt(0).toUpperCase() +
                                    evt.waste_category.slice(1)
                              ] || '#71849A',
                          }}
                        />
                        {evt.waste_category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 capitalize text-[#65736A] font-medium">
                      {evt.dropped_in_bin}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">
                      {(evt.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3">
                      {evt.is_correct_sort ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E9F3ED] text-[#176B45] border border-[#CDE3D5]">
                          <CheckCircle2 className="w-3 h-3" />
                          Correct Sort
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF0EE] text-[#C84F49] border border-[#FADAD7]">
                          <XCircle className="w-3 h-3" />
                          Sorting Error
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
