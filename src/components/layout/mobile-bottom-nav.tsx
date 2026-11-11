'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  MapPin,
  FileText,
  Clock,
  AlertTriangle,
  BarChart3,
  Mail,
  ShieldCheck,
  Settings,
  PlusCircle,
  CirclePlus,
  History,
  AlertCircle,
  User,
  CalendarOff,
  CalendarDays,
  Menu,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { UserProfile, UserRole } from '@/types';
import { cn } from '@/lib/utils/cn';
import { resolveActiveNavHref } from '@/lib/utils/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

interface MobileBottomNavProps {
  user: UserProfile;
}

interface NavDestination {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

export function MobileBottomNav({ user }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  const role = user.role;
  const isSuperAdmin = role === 'super_admin';

  // Primary 4 items per role
  let primaryItems: NavDestination[] = [];

  if (role === 'super_admin' || role === 'admin') {
    primaryItems = [
      { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, exact: true },
      { label: 'Reports', href: '/admin/reports', icon: FileText, exact: true },
      { label: 'Employees', href: '/admin/staff', icon: Users },
      { label: 'Leaves', href: '/admin/leaves', icon: CalendarOff },
    ];
  } else if (role === 'manager') {
    primaryItems = [
      { label: 'Dashboard', href: '/manager/dashboard', icon: LayoutDashboard, exact: true },
      { label: 'Team Reports', href: '/manager/reports', icon: FileText, exact: true },
      { label: 'Staff', href: '/manager/staff', icon: Users },
      { label: 'Leaves', href: '/manager/leaves', icon: CalendarOff },
    ];
  } else {
    // Staff
    primaryItems = [
      { label: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard, exact: true },
      { label: 'Field Activity', href: '/staff/daily-report', icon: CirclePlus },
      { label: 'Activities', href: '/staff/report-history', icon: History },
      { label: 'My Leaves', href: '/staff/leaves', icon: CalendarOff },
    ];
  }

  // Secondary destinations grouped for the Sheet
  const getSecondaryGroups = () => {
    if (role === 'super_admin' || role === 'admin') {
      return [
        {
          groupName: 'Reports & Compliance',
          items: [
            { label: 'Pending Reviews', href: '/admin/pending-reviews', icon: Clock },
            { label: 'Missing Reports', href: '/admin/missing-reports', icon: AlertTriangle },
            { label: 'Monthly Report', href: '/admin/reports/monthly', icon: CalendarDays },
            { label: 'Report Analytics', href: '/admin/analytics', icon: BarChart3 },
          ],
        },
        {
          groupName: 'Organization & Structure',
          items: [
            { label: 'Departments', href: '/admin/departments', icon: Building2 },
            { label: 'Centers & Hubs', href: '/admin/centers', icon: MapPin },
          ],
        },
        {
          groupName: 'System & Security',
          items: [
            { label: 'Email Logs', href: '/admin/email-logs', icon: Mail },
            { label: 'Audit Logs', href: '/admin/audit-logs', icon: ShieldCheck },
            ...(isSuperAdmin
              ? [{ label: 'System Settings', href: '/admin/settings', icon: Settings }]
              : []),
          ],
        },
      ];
    }

    if (role === 'manager') {
      return [
        {
          groupName: 'Department & Reports',
          items: [
            { label: 'Department Analytics', href: '/manager/analytics', icon: BarChart3 },
            { label: 'Monthly Report Export', href: '/admin/reports/monthly', icon: CalendarDays },
          ],
        },
      ];
    }

    // Staff
    return [
      {
        groupName: 'My Activities & Account',
        items: [
          { label: 'Corrections Required', href: '/staff/corrections', icon: AlertCircle },
          { label: 'Monthly Report', href: '/staff/reports/monthly', icon: CalendarDays },
          { label: 'My Profile', href: '/staff/profile', icon: User },
        ],
      },
    ];
  };

  const secondaryGroups = getSecondaryGroups();
  const activeHref = resolveActiveNavHref(pathname, [
    ...primaryItems,
    ...secondaryGroups.flatMap((group) => group.items),
  ]);

  // Check if current route is among primary items (otherwise highlight "More")
  const isPrimaryActive = primaryItems.some((item) => item.href === activeHref);
  const isMoreActive = !isPrimaryActive;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  return (
    <>
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between w-full h-16 max-w-md mx-auto px-1 sm:px-2">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === activeHref;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 min-w-0 flex flex-col items-center justify-center h-full py-1.5 px-0.5 group touch-manipulation select-none"
              >
                <div className="flex flex-col items-center justify-center gap-1 w-full">
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                  <span
                    className={cn(
                      'text-[10px] sm:text-[11px] leading-none tracking-tight truncate max-w-full text-center transition-colors',
                      isActive
                        ? 'font-bold text-primary'
                        : 'font-medium text-muted-foreground group-hover:text-foreground'
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}

          {/* 5th Action: More Menu Button */}
          <button
            type="button"
            onClick={() => setMoreSheetOpen(true)}
            className="flex-1 min-w-0 flex flex-col items-center justify-center h-full py-1.5 px-0.5 group touch-manipulation select-none"
            aria-label="More navigation destinations"
          >
            <div className="flex flex-col items-center justify-center gap-1 w-full">
              <Menu
                className={cn(
                  'h-5 w-5 shrink-0 transition-colors',
                  isMoreActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )}
                strokeWidth={isMoreActive ? 2.25 : 1.75}
              />
              <span
                className={cn(
                  'text-[10px] sm:text-[11px] leading-none tracking-tight truncate max-w-full text-center transition-colors',
                  isMoreActive
                    ? 'font-bold text-primary'
                    : 'font-medium text-muted-foreground group-hover:text-foreground'
                )}
              >
                More
              </span>
            </div>
          </button>
        </div>
      </nav>

      {/* Secondary Destinations Sheet */}
      <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] bg-card border-border text-foreground">
          <SheetHeader>
            <div className="flex items-center gap-3 pr-10">
              <div className="h-9 w-9 rounded-full bg-primary text-white font-bold flex items-center justify-center text-xs shrink-0">
                {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'AG'}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-foreground">{user.fullName}</SheetTitle>
                <SheetDescription className="truncate text-muted-foreground">
                  {user.employeeId ? `${user.employeeId} • ` : ''}
                  <span className="capitalize">{role.replace('_', ' ')}</span>
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="py-2 space-y-4">
            {secondaryGroups.map((group, idx) => (
              <div key={idx} className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                  {group.groupName}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href === activeHref;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreSheetOpen(false)}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-colors min-h-[44px]',
                          isActive
                            ? 'bg-primary/10 text-primary font-bold border border-primary/25'
                            : 'text-foreground hover:bg-muted active:bg-muted/80'
                        )}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              isActive ? 'text-primary' : 'text-muted-foreground'
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Logout Action in Sheet */}
            <div className="pt-2 border-t border-border space-y-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:bg-rose-100 transition-colors min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <span>Sign Out of Account</span>
                </div>
                <ChevronRight className="h-4 w-4 text-rose-400" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setMoreSheetOpen(false)}
                className="w-full flex items-center justify-center p-2.5 rounded-xl text-xs font-bold text-foreground bg-muted hover:bg-muted/80 transition-colors min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
