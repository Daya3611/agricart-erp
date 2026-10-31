'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Mail,
  BarChart3,
  Users,
  Settings,
  ShieldCheck,
  LogOut,
  CalendarDays,
  PlusCircle,
  CalendarOff,
} from 'lucide-react';
import { UserProfile, UserRole } from '@/types';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

interface AppSidebarProps {
  user: UserProfile;
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
}

export function AppSidebar({ user, onNavigate, className }: AppSidebarProps) {
  const pathname = usePathname();

  // Role-specific vertical dock icons
  const getDockItems = (role: UserRole) => {
    if (role === 'super_admin' || role === 'admin') {
      return [
        { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, exact: true },
        { label: 'Daily Reports', href: '/admin/reports', icon: FileText, exact: false },
        { label: 'Staff Directory', href: '/admin/staff', icon: Users, exact: false },
        { label: 'Leaves', href: '/admin/leaves', icon: CalendarOff, exact: false },
        { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, exact: false },
        { label: 'Email Logs', href: '/admin/email-logs', icon: Mail, exact: false },
        { label: 'Settings', href: '/admin/settings', icon: Settings, exact: false },
      ];
    }
    if (role === 'manager') {
      return [
        { label: 'Dashboard', href: '/manager/dashboard', icon: LayoutDashboard, exact: true },
        { label: 'Team Reports', href: '/manager/reports', icon: FileText, exact: false },
        { label: 'Assigned Staff', href: '/manager/staff', icon: Users, exact: false },
        { label: 'Leaves', href: '/manager/leaves', icon: CalendarOff, exact: false },
        { label: 'Analytics', href: '/manager/analytics', icon: BarChart3, exact: false },
      ];
    }
    // Staff
    return [
      { label: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard, exact: true },
      { label: 'Submit Daily Report', href: '/staff/daily-report', icon: PlusCircle, exact: false },
      { label: 'My Reports', href: '/staff/report-history', icon: FileText, exact: false },
      { label: 'Leaves', href: '/staff/leaves', icon: CalendarOff, exact: false },
      { label: 'Monthly Report', href: '/staff/reports/monthly', icon: CalendarDays, exact: false },
    ];
  };

  const dockItems = getDockItems(user.role);

  return (
    <aside
      aria-label="Application Dock Navigation"
      className={cn(
        'fixed left-4 sm:left-6 top-24 bottom-6 z-30 flex flex-col items-center justify-between pointer-events-none select-none',
        className
      )}
    >
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Center Dock: Primary Module Icons */}
        <div className="pointer-events-auto bg-card border border-border rounded-[22px] p-2 flex flex-col items-center gap-2 shadow-2xs card-saas-shadow">
        {dockItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Tooltip key={item.href} content={item.label} side="right">
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'bg-[#252923] text-white dark:bg-primary dark:text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-5 w-5" />
              </Link>
            </Tooltip>
          );
        })}
        </div>
      </div>

      {/* 3. Bottom Dock: Audit Logs / History & Logout */}
      <div className="pointer-events-auto bg-card border border-border rounded-[22px] p-1.5 flex flex-col items-center gap-1.5 shadow-2xs">
        <Tooltip content="Audit Logs" side="right">
          <Link
            href={user.role === 'super_admin' || user.role === 'admin' ? '/admin/audit-logs' : '#'}
            aria-label="Audit Logs"
            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ShieldCheck className="h-4 w-4" />
          </Link>
        </Tooltip>

        <Tooltip content="Sign Out" side="right">
          <a
            href="/api/auth/logout"
            aria-label="Sign Out"
            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-[#DC5252] hover:bg-[#FDF1F1] dark:hover:bg-[#450a0a]/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#DC5252]"
          >
            <LogOut className="h-4 w-4" />
          </a>
        </Tooltip>
      </div>
    </aside>
  );
}
