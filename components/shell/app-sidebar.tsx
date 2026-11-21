"use client";

import React from "react";
import { SortSenseLogo } from "@/components/brand/sort-sense-logo";
import {
  LayoutDashboard,
  Radio,
  BarChart3,
  FileCheck2,
  AlertOctagon,
} from "lucide-react";

export type UserRole = "ADMIN" | "JANITOR";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
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
  const adminNav: NavGroup[] = [
    {
      group: "Operations",
      items: [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "stations", label: "Station Management", icon: Radio },
        {
          id: "priority",
          label: "Priority Queue",
          icon: AlertOctagon,
          count: criticalCount > 0 ? criticalCount : undefined,
        },
      ],
    },
    {
      group: "Intelligence",
      items: [
        { id: "analytics", label: "Analytics", icon: BarChart3 },
        { id: "disposal-history", label: "Disposal History", icon: FileCheck2 },
      ],
    },
  ];

  const janitorNav: NavGroup[] = [
    {
      group: "Field Operations",
      items: [
        { id: "janitor-overview", label: "Overview", icon: LayoutDashboard },
        {
          id: "priority",
          label: "Priority Queue",
          icon: AlertOctagon,
          count: criticalCount > 0 ? criticalCount : undefined,
        },
      ],
    },
  ];

  const navGroups = role === "ADMIN" ? adminNav : janitorNav;

  const handleNavClick = (viewId: string) => {
    onSelectView(viewId);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-[#E1E8E1] flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-14 px-5 border-b border-[#E1E8E1] flex items-center justify-between">
          <SortSenseLogo
            href="/dashboard"
            subtitle={role === "ADMIN" ? "Operations" : "Field Dispatch"}
          />

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
              role === "ADMIN"
                ? "bg-[#E9F3ED] text-[#176B45] border-[#CDE3D5]"
                : "bg-[#FFF6E4] text-[#94600D] border-[#FDE8BF]"
            }`}
          >
            {role}
          </span>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
          aria-label="Dashboard navigation"
        >
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-[#176B45] text-white font-semibold"
                        : "text-[#65736A] hover:bg-[#F2F7F3] hover:text-[#176B45]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-[#65736A]"}`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.count !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                          isActive
                            ? "bg-white text-[#C84F49]"
                            : "bg-[#FFF0EE] text-[#C84F49] border border-[#FADAD7]"
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3.5 border-t border-[#E1E8E1] bg-[#F7F8F4] text-[11px] text-[#65736A]">
          <div className="flex items-center justify-between font-mono">
            <span>Telemetry</span>
            <span className="text-[#176B45] font-semibold">Live REST</span>
          </div>
        </div>
      </aside>
    </>
  );
}
