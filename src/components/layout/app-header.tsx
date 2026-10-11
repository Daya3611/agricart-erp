'use client';

import React from 'react';
import { PanelLeftClose, PanelLeft, Calendar, Menu } from 'lucide-react';
import { UserProfile } from '@/types';
import { AppBreadcrumbs } from './app-breadcrumbs';
import { NotificationMenu } from './notification-menu';
import { ProfileDropdown } from './profile-dropdown';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

interface AppHeaderProps {
  user: UserProfile;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobileMenu?: () => void;
  title?: string;
  subtitle?: string;
}

export function AppHeader({
  user,
  collapsed,
  onToggleCollapse,
  onOpenMobileMenu,
}: AppHeaderProps) {
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <header className="h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* Left controls: Sidebar toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button (< 1024px) */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop sidebar toggle button (>= 1024px) */}
        <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="bottom">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100/90 hover:text-slate-900 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </Tooltip>

        <div className="h-4 w-[1px] bg-slate-200 hidden lg:block" />

        {/* Breadcrumb Navigation */}
        <AppBreadcrumbs />
      </div>

      {/* Right controls: Date badge, notifications, profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Date Display Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] font-semibold text-slate-600 shadow-2xs">
          <Calendar className="h-3.5 w-3.5 text-emerald-600" />
          <span>{todayFormatted}</span>
        </div>

        {/* Notifications Popover */}
        <NotificationMenu user={user} />

        <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

        {/* User Profile Dropdown */}
        <ProfileDropdown user={user} />
      </div>
    </header>
  );
}
