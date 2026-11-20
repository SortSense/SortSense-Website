'use client';

import React from 'react';
import { UserRole } from './app-sidebar';
import {
  Menu,
  RefreshCw,
  LogOut,
  UserCheck,
} from 'lucide-react';

interface AppHeaderProps {
  role: UserRole;
  userName: string;
  currentViewLabel: string;
  isPolling: boolean;
  lastUpdated: Date;
  onRefresh: () => void;
  onSignOut: () => void;
  onToggleMobileMenu: () => void;
}

export function AppHeader({
  role,
  userName,
  currentViewLabel,
  isPolling,
  lastUpdated,
  onRefresh,
  onSignOut,
  onToggleMobileMenu,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-[#E1E8E1] px-4 sm:px-6 flex items-center justify-between">
      {/* Left Area: Mobile Trigger & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 text-[#65736A] hover:text-[#176B45] hover:bg-[#F2F7F3] rounded-lg lg:hidden"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:inline text-xs font-medium text-[#65736A]">
            {role === 'ADMIN' ? 'Operations' : 'Field Dispatch'}
          </span>
          <span className="hidden sm:inline text-[#E1E8E1]">/</span>
          <span className="text-sm font-bold text-[#202A25] font-display truncate">
            {currentViewLabel}
          </span>
        </div>
      </div>

      {/* Right Area: Controls & Authenticated User */}
      <div className="flex items-center gap-2.5">
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#F7F8F4] border border-[#E1E8E1] text-[11px] text-[#65736A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#48A868]" />
          <span>Sync 5s</span>
          <span className="text-[#E1E8E1]">|</span>
          <span className="font-mono text-[#202A25]">
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        <button
          onClick={onRefresh}
          disabled={isPolling}
          title="Refresh live feeds"
          className="p-2 text-[#65736A] hover:text-[#176B45] hover:bg-[#F2F7F3] rounded-lg transition-colors border border-[#E1E8E1] bg-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-[#176B45]' : ''}`} />
        </button>

        <div className="flex items-center gap-2 pl-2.5 border-l border-[#E1E8E1]">
          <div className="w-7 h-7 rounded-md bg-[#E9F3ED] text-[#176B45] border border-[#CDE3D5] flex items-center justify-center">
            <UserCheck className="w-3.5 h-3.5" />
          </div>
          <div className="hidden sm:block text-left">
            <span className="text-xs font-semibold text-[#202A25] block leading-tight font-display">
              {userName}
            </span>
            <span className="text-[10px] font-mono text-[#65736A] block leading-tight">
              {role}
            </span>
          </div>
        </div>

        <button
          onClick={onSignOut}
          title="Sign out of staff account"
          className="p-2 text-[#65736A] hover:text-[#C84F49] hover:bg-[#FFF0EE] rounded-lg transition-colors border border-[#E1E8E1]"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
