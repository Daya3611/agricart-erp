'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { NavGroupConfig } from './navigation-config';
import { SidebarNavItem } from './sidebar-nav-item';
import { cn } from '@/lib/utils/cn';

interface SidebarNavGroupProps {
  group: NavGroupConfig;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarNavGroup({ group, collapsed, onNavigate }: SidebarNavGroupProps) {
  const pathname = usePathname();

  // Check if any child item matches current pathname
  const hasActiveChild = group.items.some((item) =>
    item.exactMatch
      ? pathname === item.href
      : pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/')
  );

  // Group expansion state: default to expanded if it has active child or by default
  const [isOpen, setIsOpen] = useState(true);

  // Auto-expand group whenever a child becomes active
  useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true);
    }
  }, [hasActiveChild]);

  if (collapsed) {
    return (
      <div className="py-2 border-b border-slate-100 last:border-b-0 space-y-1">
        {group.items.map((item) => (
          <SidebarNavItem
            key={item.id}
            item={item}
            collapsed={true}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="py-1">
      {/* Group Header Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex items-center justify-between w-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 transition-colors select-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <span>{group.label}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
            isOpen ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>

      {/* Group Items Container */}
      <div
        className={cn(
          'space-y-1 overflow-hidden transition-all duration-200 ease-in-out',
          isOpen ? 'max-h-[500px] opacity-100 mt-0.5' : 'max-h-0 opacity-0'
        )}
      >
        {group.items.map((item) => (
          <SidebarNavItem
            key={item.id}
            item={item}
            collapsed={false}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
