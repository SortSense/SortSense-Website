'use client';

import React from 'react';
import { UserRole } from './app-sidebar';
import {
  Menu,
  RefreshCw,
  LogOut,
  Radio,
  UserCheck,
  Shield,
  HardHat,
} from 'lucide-react';

interface AppHeaderProps {
  role: UserRole;
  userName: string;
  isPolling: boolean;
  lastUpdated: Date;
  onRefresh: () => void;
  onSignOut: () => void;
  onToggleMobileMenu: () => void;
  onToggleRolePreview?: (newRole: UserRole) => void;
}

export function AppHeader({
  role,
  userName,
  isPolling,
  lastUpdated,
  onRefresh,
  onSignOut,
  onToggleMobileMenu,
  onToggleRolePreview,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-[#E1E8E1] px-4 sm:px-6 flex items-center justify-between">
      {/* Left Area: Mobile Trigger & View Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 text-[#65736A] hover:text-[#176B45] hover:bg-[#E9F3ED] rounded-lg lg:hidden"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-semibold text-[#65736A]">Campus Operations</span>
          <span className="text-[#E1E8E1]">/</span>
          <span className="text-xs font-bold text-[#202A25] font-display">
            {role === 'ADMIN' ? 'Facility Management Console' : 'Janitor Task Dispatch'}
          </span>
        </div>
      </div>

      {/* Right Area: Controls & Profile */}
      <div className="flex items-center gap-3">
        {/* Polling Pulse Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F7F8F4] border border-[#E1E8E1] text-xs text-[#65736A] font-medium">
          <Radio className="w-3.5 h-3.5 text-[#176B45] animate-pulse" />
          <span>Polling 5s</span>
          <span className="text-[#E1E8E1]">•</span>
          <span className="font-mono text-[11px] text-[#65736A]">
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Manual Refresh */}
        <button
          onClick={onRefresh}
          disabled={isPolling}
          title="Refresh live feeds"
          className="p-2 text-[#65736A] hover:text-[#176B45] hover:bg-[#E9F3ED] rounded-lg transition-colors border border-[#E1E8E1] bg-white shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-[#176B45]' : ''}`} />
        </button>

        {/* Role Preview Switcher (Allows testing Admin and Janitor views) */}
        {onToggleRolePreview && (
          <div className="hidden md:flex items-center bg-[#EFF2EF] p-0.5 rounded-lg text-[11px] font-semibold">
            <button
              onClick={() => onToggleRolePreview('ADMIN')}
              className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                role === 'ADMIN'
                  ? 'bg-white text-[#176B45] shadow-2xs'
                  : 'text-[#65736A] hover:text-[#202A25]'
              }`}
            >
              <Shield className="w-3 h-3" />
              ADMIN
            </button>
            <button
              onClick={() => onToggleRolePreview('JANITOR')}
              className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                role === 'JANITOR'
                  ? 'bg-white text-[#C48419] shadow-2xs'
                  : 'text-[#65736A] hover:text-[#202A25]'
              }`}
            >
              <HardHat className="w-3 h-3" />
              JANITOR
            </button>
          </div>
        )}

        {/* User Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#E1E8E1]">
          <div className="w-7 h-7 rounded-full bg-[#E9F3ED] text-[#176B45] border border-[#CDE3D5] flex items-center justify-center font-bold text-xs">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="hidden sm:block text-left">
            <span className="text-xs font-bold text-[#202A25] block leading-tight font-display">
              {userName}
            </span>
            <span className="text-[10px] font-mono text-[#65736A] block leading-tight">
              {role}
            </span>
          </div>
        </div>

        {/* Sign Out Button */}
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
