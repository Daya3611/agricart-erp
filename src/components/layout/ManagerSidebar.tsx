'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Clock,
  Sprout,
  LogOut,
  Building2,
  MapPin,
} from 'lucide-react';
import { UserProfile } from '@/types';
import { cn } from '@/lib/utils/cn';

interface ManagerSidebarProps {
  user: UserProfile;
}

export function ManagerSidebar({ user }: ManagerSidebarProps) {
  const pathname = usePathname();

  const managerNavItems = [
    { label: 'Manager Dashboard', href: '/manager/dashboard', icon: LayoutDashboard },
    { label: 'Team Reports & Reviews', href: '/manager/reports', icon: FileText },
    { label: 'Assigned Staff', href: '/manager/staff', icon: Users },
    { label: 'Department Analytics', href: '/manager/analytics', icon: BarChart3 },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200/80 h-screen flex flex-col justify-between shadow-xs overflow-y-auto">
      <div>
        {/* Company Header */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-600/20">
            <Sprout className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-base text-slate-900 leading-tight tracking-tight">
              AGRICART FPC
            </h1>
            <p className="text-[11px] font-semibold text-purple-700 tracking-wide uppercase">
              Manager Portal
            </p>
          </div>
        </div>

        {/* User Badge Card */}
        <div className="p-4 mx-3 my-3 bg-purple-50/60 rounded-xl border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
              {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'MG'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-900 truncate">{user.fullName}</p>
              <p className="text-[11px] font-medium text-slate-500 truncate">{user.employeeId}</p>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-purple-100 flex flex-col gap-1 text-[11px] text-slate-600 font-medium">
            <span className="flex items-center gap-1.5 truncate">
              <Building2 className="h-3.5 w-3.5 text-purple-600 shrink-0" />
              <span className="truncate">{user.departmentName || 'Department Head'}</span>
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 py-2 space-y-1">
          {managerNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/manager/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group',
                  isActive
                    ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    isActive ? 'text-purple-600' : 'text-slate-400 group-hover:text-slate-600'
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout Footer */}
      <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
        <a
          href="/api/auth/logout"
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </a>
      </div>
    </aside>
  );
}
