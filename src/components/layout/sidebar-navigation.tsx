'use client';

import React from 'react';
import { UserRole } from '@/types';
import { getNavigationForRole } from './navigation-config';
import { SidebarNavGroup } from './sidebar-nav-group';

interface SidebarNavigationProps {
  role: UserRole;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarNavigation({ role, collapsed, onNavigate }: SidebarNavigationProps) {
  const groups = getNavigationForRole(role);

  return (
    <nav className="p-3 space-y-1" aria-label="Main Navigation">
      {groups.map((group) => (
        <SidebarNavGroup
          key={group.id}
          group={group}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
