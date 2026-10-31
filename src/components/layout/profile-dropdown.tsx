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
    super_admin: { label: 'Super Admin', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' },
    admin: { label: 'Administrator', bg: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800' },
    manager: { label: 'Dept Head', bg: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' },
    staff: { label: 'Staff', bg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
  };

  const badgeInfo = roleBadges[user.role] || { label: 'Staff', bg: 'bg-muted text-foreground border-border' };
  const initials = user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'AG';

  const profileHref =
    user.role === 'staff'
      ? '/staff/profile'
      : user.role === 'super_admin'
        ? '/admin/settings'
        : '/admin/dashboard';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary/40 hover:bg-muted/50 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-2xs">
        <Avatar size="sm" className="h-7 w-7 bg-[#228B4E] text-white font-bold text-xs">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="hidden sm:flex flex-col items-start pr-1 text-left">
          <span className="text-xs font-bold text-foreground leading-tight truncate max-w-[120px]">
            {user.fullName || 'Code XR'}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium leading-none truncate max-w-[120px]">
            {user.email || badgeInfo.label}
          </span>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {/* User Identity Header */}
        <div className="p-3 bg-muted/40 rounded-xl mb-1 border border-border">
          <p className="text-xs font-bold text-foreground truncate">{user.fullName}</p>
          {user.email && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{user.email}</p>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full border', badgeInfo.bg)}>
              {badgeInfo.label}
            </span>
            <span className="text-[10px] text-muted-foreground font-semibold">{user.employeeId}</span>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Account</DropdownMenuLabel>

        {user.role === 'staff' && (
          <Link href="/staff/profile" className="block">
            <DropdownMenuItem>
              <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>My Profile</span>
            </DropdownMenuItem>
          </Link>
        )}

        {user.role === 'super_admin' && (
          <Link href="/admin/settings" className="block">
            <DropdownMenuItem>
              <Settings className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>System Settings</span>
            </DropdownMenuItem>
          </Link>
        )}

        <DropdownMenuSeparator />

        {/* Sign Out Action */}
        <a href="/api/auth/logout" className="block">
          <DropdownMenuItem className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 focus:bg-rose-50 dark:focus:bg-rose-950/40 focus:text-rose-700">
            <LogOut className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </a>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
