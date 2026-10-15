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
      { label: 'Submit', href: '/staff/daily-report', icon: CirclePlus },
      { label: 'My Reports', href: '/staff/report-history', icon: History },
      { label: 'My Leaves', href: '/staff/leaves', icon: CalendarOff },
    ];
  }

  // Check if current route is among secondary items (to highlight "More")
  const isPrimaryActive = primaryItems.some((item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)
  );
  const isMoreActive = !isPrimaryActive;

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
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/90 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between w-full h-16 max-w-md mx-auto px-1 sm:px-2">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 min-w-0 flex flex-col items-center justify-center h-full px-0.5 group touch-manipulation"
              >
                <div
                  className={cn(
                    'w-full max-w-[64px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-150',
                    isActive
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 mb-0.5 transition-colors shrink-0',
                      isActive ? 'text-emerald-700' : 'text-slate-500'
                    )}
                    strokeWidth={2}
                  />
                  <span
                    className={cn(
                      'text-[10px] leading-tight tracking-tight truncate max-w-full text-center',
                      isActive ? 'font-bold text-emerald-900' : 'font-medium text-slate-600'
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
            className="flex-1 min-w-0 flex flex-col items-center justify-center h-full px-0.5 group touch-manipulation"
            aria-label="More navigation destinations"
          >
            <div
              className={cn(
                'w-full max-w-[64px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-150',
                isMoreActive
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100'
              )}
            >
              <Menu
                className={cn(
                  'h-5 w-5 mb-0.5 transition-colors shrink-0',
                  isMoreActive ? 'text-emerald-700' : 'text-slate-500'
                )}
                strokeWidth={2}
              />
              <span
                className={cn(
                  'text-[10px] leading-tight tracking-tight truncate max-w-full text-center',
                  isMoreActive ? 'font-bold text-emerald-900' : 'font-medium text-slate-600'
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
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'AG'}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate">{user.fullName}</SheetTitle>
                <SheetDescription className="truncate">
                  {user.employeeId ? `${user.employeeId} • ` : ''}
                  <span className="capitalize">{role.replace('_', ' ')}</span>
                </SheetDescription>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold shrink-0">
                {user.departmentName || 'Agricart'}
              </Badge>
            </div>
          </SheetHeader>

          <div className="py-2 space-y-4">
            {getSecondaryGroups().map((group, idx) => (
              <div key={idx} className="space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
                  {group.groupName}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreSheetOpen(false)}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-colors min-h-[44px]',
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100'
                        )}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              isActive ? 'text-emerald-700' : 'text-slate-500'
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Logout Action in Sheet */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 active:bg-rose-100 transition-colors min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="h-4 w-4 text-rose-600" />
                  <span>Sign Out of Account</span>
                </div>
                <ChevronRight className="h-4 w-4 text-rose-400" />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
