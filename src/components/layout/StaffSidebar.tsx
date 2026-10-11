'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  AlertCircle,
  User,
  Sprout,
  LogOut,
  Building2,
  MapPin,
} from 'lucide-react';
import { UserProfile } from '@/types';
import { cn } from '@/lib/utils/cn';

interface StaffSidebarProps {
  user: UserProfile;
}

export function StaffSidebar({ user }: StaffSidebarProps) {
  const pathname = usePathname();

  const staffNavItems = [
    { label: 'My Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
    { label: 'Submit Daily Report', href: '/staff/daily-report', icon: PlusCircle },
    { label: 'My Report History', href: '/staff/report-history', icon: History },
    { label: 'Corrections Required', href: '/staff/corrections', icon: AlertCircle },
    { label: 'My Profile', href: '/staff/profile', icon: User },
  ];

  return (
    <>
      {/* Desktop/Tablet Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200/80 h-screen flex-col justify-between shadow-xs overflow-y-auto">
        <div>
          {/* Company Header */}
          <div className="p-5 border-b border-slate-100 flex items-center gap-3 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
              <Sprout className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-base text-slate-900 leading-tight tracking-tight">
                AGRICART FPC
              </h1>
              <p className="text-[11px] font-semibold text-emerald-700 tracking-wide uppercase">
                Staff Reporting Portal
              </p>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="p-4 mx-3 my-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'ST'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 truncate">{user.fullName}</p>
                <p className="text-[11px] font-semibold text-emerald-800 truncate">{user.employeeId}</p>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-emerald-100/80 flex flex-col gap-1 text-[11px] text-slate-600 font-medium">
              <span className="flex items-center gap-1.5 truncate">
                <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{user.departmentName || 'Field Operations'}</span>
              </span>
              <span className="flex items-center gap-1.5 truncate">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{user.assignedCenterNames?.[0] || 'Nashik Center'}</span>
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="px-3 py-2 space-y-1">
            {staffNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/staff/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group',
                    isActive
                      ? 'bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-600/20'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                    )}
                  />
                  <span>{item.label}</span>
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

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg px-2 py-1.5 flex items-center justify-around">
        {staffNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center p-1.5 rounded-xl text-[10px] font-bold transition-all min-w-[56px]',
                isActive ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <Icon className={cn('h-5 w-5 mb-0.5', isActive ? 'text-emerald-600' : 'text-slate-400')} />
              <span className="truncate max-w-[64px]">{item.label.replace('My ', '')}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
