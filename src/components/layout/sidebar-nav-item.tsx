'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavItemConfig } from './navigation-config';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

interface SidebarNavItemProps {
  item: NavItemConfig;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarNavItem({ item, collapsed, onNavigate }: SidebarNavItemProps) {
  const pathname = usePathname();
  const Icon = item.icon;

  // Path matching logic: exact match for root/dashboards, startsWith for subpaths
  const isActive = item.exactMatch
    ? pathname === item.href
    : pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/');

  if (collapsed) {
    return (
      <Tooltip content={item.label} side="right">
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-label={item.label}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'group relative flex h-11 w-11 mx-auto items-center justify-center rounded-full transition-all duration-200 outline-none select-none',
            'focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
            isActive
              ? 'bg-emerald-100 text-emerald-950 font-semibold ring-1 ring-emerald-300/50 shadow-xs'
              : 'text-slate-600 hover:bg-emerald-50/70 hover:text-emerald-900 active:scale-95'
          )}
        >
          <Icon
            className={cn(
              'h-[19px] w-[19px] shrink-0 transition-colors duration-150',
              isActive ? 'text-emerald-800' : 'text-slate-400 group-hover:text-emerald-700'
            )}
          />
        </Link>
      </Tooltip>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex h-11 w-full items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors duration-200 outline-none select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
        isActive
          ? 'bg-emerald-100 text-emerald-950 font-semibold ring-1 ring-emerald-300/50 shadow-xs'
          : 'text-slate-600 hover:bg-emerald-50/70 hover:text-emerald-900 active:scale-[0.99]'
      )}
    >
      <Icon
        className={cn(
          'h-[19px] w-[19px] shrink-0 transition-colors duration-150',
          isActive ? 'text-emerald-800' : 'text-slate-400 group-hover:text-emerald-700'
        )}
      />
      <span className="truncate">{item.label}</span>

      {item.badge && (
        <span
          className={cn(
            'ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
            isActive
              ? 'bg-emerald-200/80 text-emerald-950'
              : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-900'
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
