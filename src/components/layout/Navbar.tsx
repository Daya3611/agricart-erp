'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { UserProfile } from '@/types';

interface NavbarProps {
  user: UserProfile;
  title?: string;
  subtitle?: string;
}

export function Navbar({ user, title = 'Agricart Activity Reporting ERP', subtitle }: NavbarProps) {
  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      <div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Date Display Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
          <Calendar className="h-3.5 w-3.5 text-emerald-600" />
          <span>{todayStr}</span>
        </div>

        {/* User Quick Profile */}
        <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
          <div className="h-8 w-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
            {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'AG'}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-bold text-slate-900 leading-tight">{user.fullName || 'User'}</p>
            <p className="text-[10px] font-semibold text-slate-500 capitalize">{user.role ? user.role.replace('_', ' ') : 'Staff'}</p>
          </div>
          <a
            href="/api/auth/logout"
            className="md:hidden text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200"
          >
            Sign Out
          </a>
        </div>
      </div>
    </header>
  );
}
