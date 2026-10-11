'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { UserProfile, UserRole } from '@/types';
import { AppSidebar } from './app-sidebar';
import { AppHeader } from './app-header';
import { SidebarBrand } from './sidebar-brand';
import { SidebarNavigation } from './sidebar-navigation';
import { SidebarFooter } from './sidebar-footer';
import { cn } from '@/lib/utils/cn';

interface AppShellProps {
  user: UserProfile;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  maxWidth?: string;
}

export function AppShell({
  user,
  children,
  title,
  subtitle,
  maxWidth = 'max-w-7xl',
}: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Initialize and persist collapsed state from localStorage
  useEffect(() => {
    setIsClient(true);
    try {
      const saved = localStorage.getItem('agricart_sidebar_collapsed');
      if (saved !== null) {
        setCollapsed(saved === 'true');
      } else if (window.innerWidth >= 1024 && window.innerWidth < 1280) {
        // Automatically default to compact on 1024-1280px screens as recommended in spec
        setCollapsed(true);
      }
    } catch {}
  }, []);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('agricart_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* 1. Desktop Persistent Sidebar (>= 1024px) */}
      <AppSidebar
        user={user}
        collapsed={collapsed}
        className="hidden lg:flex"
      />

      {/* 2. Mobile Drawer (< 1024px) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pr-3">
              <SidebarBrand collapsed={false} role={user.role} />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <SidebarNavigation
                role={user.role}
                collapsed={false}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </div>

            <SidebarFooter user={user} collapsed={false} />
          </div>
        </div>
      )}

      {/* 3. Main Workspace Container with synchronized margin */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-in-out',
          collapsed ? 'lg:pl-[88px]' : 'lg:pl-[276px]'
        )}
      >
        {/* Compact Top Header */}
        <AppHeader
          user={user}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          title={title}
          subtitle={subtitle}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className={cn('mx-auto w-full space-y-6', maxWidth)}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
