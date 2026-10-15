'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PanelLeftClose, PanelLeft, Calendar } from 'lucide-react';
import { UserProfile } from '@/types';
import { AppBreadcrumbs } from './app-breadcrumbs';
import { NotificationMenu } from './notification-menu';
import { ProfileDropdown } from './profile-dropdown';
import { Tooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
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

  const homeHref =
    user.role === 'super_admin' || user.role === 'admin'
      ? '/admin/dashboard'
      : user.role === 'manager'
        ? '/manager/dashboard'
        : '/staff/dashboard';

  const roleLabel =
    user.role === 'super_admin'
      ? 'Super Admin'
      : user.role === 'admin'
        ? 'Admin'
        : user.role === 'manager'
          ? 'Manager'
          : 'Staff';

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200/90 px-3 sm:px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* Left controls: Mobile brand logo, Desktop sidebar toggle & Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Top App Bar: Brand Logo & Title (< 1024px) */}
        <Link
          href={homeHref}
          className="lg:hidden flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg py-1 truncate"
        >
          <div className="relative h-8 w-8 shrink-0 rounded-xl bg-white border border-slate-200 p-0.5 flex items-center justify-center shadow-2xs">
            <Image
              src="/logo.png"
              alt="Agricart Logo"
              width={28}
              height={28}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-extrabold text-sm text-slate-900 leading-tight tracking-tight truncate">
              Agricart
            </span>
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border-emerald-200 shrink-0 hidden xs:inline-flex"
            >
              {roleLabel}
            </Badge>
          </div>
        </Link>

        {/* Desktop sidebar toggle button (>= 1024px) */}
        <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="bottom">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100/90 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </Tooltip>

        <div className="h-4 w-[1px] bg-slate-200 hidden lg:block" />

        {/* Breadcrumb Navigation (Desktop) */}
        <AppBreadcrumbs />
      </div>

      {/* Right controls: Date badge, notifications, profile */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
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
