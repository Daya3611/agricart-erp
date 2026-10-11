'use client';

import React from 'react';
import Link from 'next/link';
import { User, Settings, LogOut, Shield } from 'lucide-react';
import { UserProfile, UserRole } from '@/types';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils/cn';

interface ProfileDropdownProps {
  user: UserProfile;
}

export function ProfileDropdown({ user }: ProfileDropdownProps) {
  const roleBadges: Record<UserRole, { label: string; bg: string }> = {
    super_admin: { label: 'Super Admin', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    admin: { label: 'Administrator', bg: 'bg-sky-100 text-sky-800 border-sky-200' },
    manager: { label: 'Dept Head', bg: 'bg-purple-100 text-purple-800 border-purple-200' },
    staff: { label: 'Staff Member', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
  };

  const badgeInfo = roleBadges[user.role] || { label: 'Staff', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
  const initials = user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'AG';

  const profileHref =
    user.role === 'staff'
      ? '/staff/profile'
      : user.role === 'super_admin'
      ? '/admin/settings'
      : '/admin/dashboard';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 p-1 rounded-full hover:bg-slate-100/80 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <Avatar size="sm" className="bg-emerald-700 text-white">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="hidden lg:flex flex-col items-start pr-1 text-left">
          <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
            {user.fullName}
          </span>
          <span className="text-[10px] text-slate-500 font-medium leading-none">
            {badgeInfo.label}
          </span>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {/* User Identity Header */}
        <div className="p-3 bg-slate-50/70 rounded-xl mb-1 border border-slate-100">
          <p className="text-xs font-bold text-slate-900 truncate">{user.fullName}</p>
          {user.email && (
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</p>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full border', badgeInfo.bg)}>
              {badgeInfo.label}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">{user.employeeId}</span>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Account</DropdownMenuLabel>

        {user.role === 'staff' && (
          <Link href="/staff/profile" className="block">
            <DropdownMenuItem>
              <User className="h-4 w-4 text-emerald-600" />
              <span>My Profile</span>
            </DropdownMenuItem>
          </Link>
        )}

        {user.role === 'super_admin' && (
          <Link href="/admin/settings" className="block">
            <DropdownMenuItem>
              <Settings className="h-4 w-4 text-emerald-600" />
              <span>System Settings</span>
            </DropdownMenuItem>
          </Link>
        )}

        <DropdownMenuSeparator />

        {/* Sign Out Action */}
        <a href="/api/auth/logout" className="block">
          <DropdownMenuItem className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 focus:bg-rose-50 focus:text-rose-700">
            <LogOut className="h-4 w-4 text-rose-600" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </a>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
