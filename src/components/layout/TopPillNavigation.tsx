'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils/cn';

interface TopPillNavigationProps {
  role: UserRole;
  className?: string;
}

export function TopPillNavigation({ role, className }: TopPillNavigationProps) {
  const pathname = usePathname();

  const getPillsForRole = () => {
    if (role === 'super_admin' || role === 'admin') {
      return [
        { label: 'Overview', href: '/admin/dashboard', exact: true },
        { label: 'Activity', href: '/admin/reports', exact: false },
        { label: 'Manage', href: '/admin/staff', exact: false },
        { label: 'Centers', href: '/admin/centers', exact: false },
        { label: 'Leaves', href: '/admin/leaves', exact: false },
        { label: 'Analytics', href: '/admin/analytics', exact: false },
        { label: 'Reports', href: '/admin/reports/monthly', exact: false },
      ];
    }
    if (role === 'manager') {
      return [
        { label: 'Overview', href: '/manager/dashboard', exact: true },
        { label: 'Activity', href: '/manager/reports', exact: false },
        { label: 'Manage', href: '/manager/staff', exact: false },
        { label: 'Leaves', href: '/manager/leaves', exact: false },
        { label: 'Analytics', href: '/manager/analytics', exact: false },
      ];
    }
    // Staff
    return [
      { label: 'Overview', href: '/staff/dashboard', exact: true },
      { label: 'Submit', href: '/staff/daily-report', exact: false },
      { label: 'My Reports', href: '/staff/report-history', exact: false },
      { label: 'Leaves', href: '/staff/leaves', exact: false },
      { label: 'Account', href: '/staff/profile', exact: false },
    ];
  };

  const pills = getPillsForRole();

  return (
    <nav
      aria-label="Top navigation sections"
      className={cn(
        'bg-card rounded-full p-1 border border-border shadow-2xs flex items-center gap-0.5 overflow-x-auto no-scrollbar',
        className
      )}
    >
      {pills.map((pill) => {
        const isActive = pill.exact
          ? pathname === pill.href
          : pathname === pill.href || pathname.startsWith(pill.href + '/');

        return (
          <Link
            key={pill.href}
            href={pill.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs transition-all whitespace-nowrap select-none font-medium',
              isActive
                ? 'bg-[#252923] text-white dark:bg-primary dark:text-white font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {pill.label}
          </Link>
        );
      })}
    </nav>
  );
}
