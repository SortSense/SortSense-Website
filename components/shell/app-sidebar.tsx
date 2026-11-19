'use client';

import React from 'react';
import {
  LayoutDashboard,
  Radio,
  MapPin,
  Cpu,
  BarChart3,
  FileCheck2,
  Users,
  AlertOctagon,
  History,
  Wrench,
  ShieldAlert,
  HardHat,
} from 'lucide-react';

export type UserRole = 'ADMIN' | 'JANITOR';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  badge?: string;
  isUrgent?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

interface AppSidebarProps {
  role: UserRole;
  currentView: string;
  onSelectView: (view: string) => void;
  criticalCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function AppSidebar({
  role,
  currentView,
  onSelectView,
  criticalCount,
  isOpenMobile = false,
  onCloseMobile,
}: AppSidebarProps) {
  // Navigation for ADMIN role
  const adminNav: NavGroup[] = [
    {
      group: 'Campus Operations',
      items: [
        { id: 'overview', label: 'System Overview', icon: LayoutDashboard },
        { id: 'stations', label: 'Station Fleet & Bins', icon: Radio },
        { id: 'locations', label: 'Campus Locations', icon: MapPin },
      ],
    },
    {
      group: 'Hardware & IoT',
      items: [
        { id: 'sensors', label: 'Sensor Diagnostics', icon: Cpu, badge: 'Hardware' },
      ],
    },
    {
      group: 'Data & Governance',
      items: [
        { id: 'analytics', label: 'Recycling Analytics', icon: BarChart3 },
        { id: 'disposal-history', label: 'AI Verified Drops', icon: FileCheck2 },
        { id: 'staff', label: 'Staff Management', icon: Users, badge: 'Pending API' },
      ],
    },
  ];

  // Navigation for JANITOR role
  const janitorNav: NavGroup[] = [
    {
      group: 'Operational Tasks',
      items: [
        {
          id: 'priority',
          label: 'Priority Bins',
          icon: AlertOctagon,
          count: criticalCount > 0 ? criticalCount : undefined,
          isUrgent: criticalCount > 0,
        },
        { id: 'stations', label: 'Campus Stations', icon: Radio },
      ],
    },
    {
      group: 'Maintenance Records',
      items: [
        { id: 'my-history', label: 'My Emptying History', icon: History, badge: 'Pending API' },
        { id: 'report-fault', label: 'Report Sensor Fault', icon: Wrench, badge: 'Pending API' },
      ],
    },
  ];

  const navGroups = role === 'ADMIN' ? adminNav : janitorNav;

  const handleNavClick = (viewId: string) => {
    onSelectView(viewId);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-[#E1E8E1] flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand / Logo Area */}
        <div className="h-16 px-5 border-b border-[#E1E8E1] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#176B45] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              S
            </div>
            <div>
              <span className="font-bold text-base text-[#202A25] font-display block leading-none">
                Sort<span className="text-[#176B45]">Sense</span>
              </span>
              <span className="text-[10px] text-[#65736A] uppercase tracking-wider block font-semibold mt-0.5">
                Ops Console
              </span>
            </div>
          </div>

          {/* Role Pill */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider ${
              role === 'ADMIN'
                ? 'bg-[#E9F3ED] text-[#176B45] border border-[#CDE3D5]'
                : 'bg-[#FFF6E4] text-[#C48419] border border-[#FDE8BF]'
            }`}
          >
            {role === 'ADMIN' ? (
              <>
                <ShieldAlert className="w-3 h-3 shrink-0" />
                ADMIN
              </>
            ) : (
              <>
                <HardHat className="w-3 h-3 shrink-0" />
                JANITOR
              </>
            )}
          </span>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              <span className="px-3 text-[10px] font-bold text-[#65736A] uppercase tracking-wider block mb-1.5 font-display">
                {group.group}
              </span>

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#176B45] text-white shadow-xs font-semibold'
                        : 'text-[#65736A] hover:bg-[#E9F3ED] hover:text-[#176B45]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#65736A]'}`} />
                      <span>{item.label}</span>
                    </div>

                    {/* Badge or Count */}
                    {item.count !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                          isActive
                            ? 'bg-white text-[#C84F49]'
                            : 'bg-[#FFF0EE] text-[#C84F49] border border-[#FADAD7]'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}

                    {item.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-[#EFF2EF] text-[#65736A]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="p-4 border-t border-[#E1E8E1] text-[11px] text-[#65736A] space-y-1">
          <div className="flex items-center justify-between font-mono">
            <span>Supabase Auth</span>
            <span className="text-[#176B45] font-semibold">Active</span>
          </div>
          <div className="flex items-center justify-between font-mono">
            <span>FastAPI Server</span>
            <span className="text-[#176B45] font-semibold">Online</span>
          </div>
        </div>
      </aside>
    </>
  );
}
