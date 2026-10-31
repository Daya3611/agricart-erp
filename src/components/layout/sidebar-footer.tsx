'use client';

import React from 'react';
import { LogOut } from 'lucide-react';
import { UserProfile, UserRole } from '@/types';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

interface SidebarFooterProps {
  user: UserProfile;
  collapsed: boolean;
}

export function SidebarFooter({ user, collapsed }: SidebarFooterProps) {
  const roleBadges: Record<UserRole, { label: string; bg: string }> = {
    super_admin: { label: 'Super Admin', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' },
    admin: { label: 'Administrator', bg: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800' },
    manager: { label: 'Dept Head', bg: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' },
    staff: { label: 'Staff', bg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
  };

  const badgeInfo = roleBadges[user.role] || { label: 'Staff', bg: 'bg-muted text-foreground border-border' };

  if (collapsed) {
    return (
      <div className="p-2 border-t border-border bg-card flex flex-col items-center gap-2">
        <Tooltip content={`${user.fullName} (${badgeInfo.label})`} side="right">
          <div className="h-9 w-9 rounded-full bg-[#228B4E] text-white font-bold flex items-center justify-center text-xs shadow-2xs select-none">
            {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'AG'}
          </div>
        </Tooltip>

        <Tooltip content="Sign Out" side="right">
          <a
            href="/api/auth/logout"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-[#DC5252] hover:bg-[#FDF1F1] dark:hover:bg-[#2C1919] transition-colors"
            aria-label="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </a>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-border bg-card sticky bottom-0">
      <div className="p-2.5 rounded-2xl bg-muted/50 border border-border flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-full bg-[#228B4E] text-white font-bold flex items-center justify-center text-xs shadow-2xs select-none">
            {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'AG'}
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="text-xs font-bold text-foreground truncate leading-snug">{user.fullName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn('px-2 py-0.5 text-[9px] font-bold rounded-full border', badgeInfo.bg)}>
                {badgeInfo.label}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium truncate">{user.employeeId}</span>
            </div>
          </div>
        </div>

        <Tooltip content="Sign Out" side="top">
          <a
            href="/api/auth/logout"
            className="shrink-0 p-2 rounded-full text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            aria-label="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </a>
        </Tooltip>
      </div>
    </div>
  );
}
