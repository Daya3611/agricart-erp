'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, History, AlertCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function StaffBottomNav() {
  const pathname = usePathname();

  const items = [
    { label: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
    { label: 'Submit', href: '/staff/daily-report', icon: PlusCircle },
    { label: 'History', href: '/staff/report-history', icon: History },
    { label: 'Corrections', href: '/staff/corrections', icon: AlertCircle },
    { label: 'Profile', href: '/staff/profile', icon: User },
  ];

  return (
    <nav
      aria-label="Staff Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 py-1.5 flex items-center justify-around"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === '/staff/dashboard'
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2.5 rounded-full text-[10px] font-semibold transition-all min-w-[54px]',
              isActive
                ? 'text-emerald-800 bg-emerald-50 ring-1 ring-emerald-200/60 font-bold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            )}
          >
            <Icon
              className={cn(
                'h-5 w-5 mb-0.5 transition-colors',
                isActive ? 'text-emerald-700' : 'text-slate-400'
              )}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
