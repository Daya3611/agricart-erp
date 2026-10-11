'use client';

import React from 'react';
import { UserProfile } from '@/types';
import { SidebarBrand } from './sidebar-brand';
import { SidebarNavigation } from './sidebar-navigation';
import { SidebarFooter } from './sidebar-footer';
import { cn } from '@/lib/utils/cn';

interface AppSidebarProps {
  user: UserProfile;
  collapsed: boolean;
  onNavigate?: () => void;
  className?: string;
}

export function AppSidebar({ user, collapsed, onNavigate, className }: AppSidebarProps) {
  return (
    <aside
      aria-label="Application Sidebar"
      className={cn(
        'fixed inset-y-0 left-0 lg:top-3 lg:bottom-3 lg:left-3 lg:h-[calc(100vh-1.5rem)] lg:rounded-2xl lg:border lg:border-slate-200/80 z-30 bg-white border-r border-slate-200/80 flex flex-col justify-between shadow-xs transition-[width] duration-300 ease-in-out overflow-hidden',
        collapsed ? 'w-[72px]' : 'w-[260px]',
        className
      )}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Brand Header */}
        <SidebarBrand collapsed={collapsed} role={user.role} />

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <SidebarNavigation
            role={user.role}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        </div>

        {/* Footer Identity & Logout */}
        <SidebarFooter user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}
