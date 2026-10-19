'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, Clock, Menu } from 'lucide-react';
import { UserProfile } from '@/types';
import { NotificationMenu } from './notification-menu';
import { ProfileDropdown } from './profile-dropdown';
import { TopPillNavigation } from './TopPillNavigation';
import { QuickSearchModal } from './QuickSearchModal';
import { ThemeToggleButton } from './ThemeToggleCapsule';
import { Tooltip } from '@/components/ui/tooltip';

interface AppHeaderProps {
  user: UserProfile;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobileMenu?: () => void;
  title?: string;
  subtitle?: string;
}

export function AppHeader({
  user,
  collapsed,
  onToggleCollapse,
  onOpenMobileMenu,
}: AppHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const homeHref =
    user.role === 'super_admin' || user.role === 'admin'
      ? '/admin/dashboard'
      : user.role === 'manager'
        ? '/manager/dashboard'
        : '/staff/dashboard';

  return (
    <>
      <header className="h-16 sm:h-20 bg-transparent px-3 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
        {/* Left Section: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger menu toggle */}
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="lg:hidden h-9 w-9 rounded-full bg-card border border-border text-foreground flex items-center justify-center hover:bg-muted transition-colors shadow-2xs"
              aria-label="Open mobile navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          <Link
            href={homeHref}
            className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full group transition-all"
            title="Agricart ERP"
          >
            <div className="relative h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-2xl bg-card border border-border p-1 flex items-center justify-center shadow-2xs group-hover:border-primary/40 transition-colors">
              <Image
                src="/logo.png"
                alt="Agricart Logo"
                width={36}
                height={36}
                priority
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg text-foreground tracking-tight group-hover:text-primary transition-colors">
                Agricart
              </span>
            </div>
          </Link>
        </div>

        {/* Center Section: Top Floating Pill Navigation (Hidden on < lg) */}
        <div className="hidden lg:flex items-center justify-center">
          <TopPillNavigation role={user.role} />
        </div>

        {/* Right Section: Utilities (Theme, Search, Notification, Clock, Profile) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Mobile Theme Mode Toggle Button (< lg) */}
          <div className="lg:hidden">
            <ThemeToggleButton />
          </div>

          {/* Search circle button */}
          <Tooltip content="Quick Search" side="bottom">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="h-9 w-9 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted transition-all flex items-center justify-center shadow-2xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </Tooltip>

          {/* Notifications Popover Circle Button */}
          <NotificationMenu user={user} />

          {/* Time / History Quick Action Circle Button */}
          <Tooltip content={`Today: ${todayFormatted}`} side="bottom">
            <Link
              href={user.role === 'super_admin' || user.role === 'admin' ? '/admin/audit-logs' : '#'}
              className="hidden xs:flex h-9 w-9 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted transition-all items-center justify-center shadow-2xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Audit Logs & Time"
            >
              <Clock className="h-4 w-4" />
            </Link>
          </Tooltip>

          {/* User Profile Pill Dropdown */}
          <ProfileDropdown user={user} />
        </div>
      </header>

      {/* Quick Search Dialog */}
      <QuickSearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        role={user.role}
      />
    </>
  );
}
