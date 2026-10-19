'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils/cn';

interface SidebarBrandProps {
  collapsed: boolean;
  role: UserRole;
}

export function SidebarBrand({ collapsed, role }: SidebarBrandProps) {
  const homeHref =
    role === 'super_admin' || role === 'admin'
      ? '/admin/dashboard'
      : role === 'manager'
        ? '/manager/dashboard'
        : '/staff/dashboard';

  return (
    <div
      className={cn(
        'h-16 flex items-center border-b border-border bg-card px-4 transition-all duration-300',
        collapsed ? 'justify-center px-2' : 'gap-3'
      )}
    >
      <Link
        href={homeHref}
        className={cn(
          'flex items-center gap-3 group outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full px-1.5 py-1 transition-all',
          collapsed ? 'justify-center w-full px-0' : ''
        )}
        title="Agricart ERP"
      >
        <div className="relative h-10 w-10 shrink-0 rounded-2xl bg-card border border-border p-1 flex items-center justify-center shadow-2xs group-hover:border-primary/40 transition-colors">
          <Image
            src="/logo.png"
            alt="Agricart FPC Logo"
            width={36}
            height={36}
            priority
            className="h-full w-full object-contain"
          />
        </div>

        {!collapsed && (
          <div className="overflow-hidden whitespace-nowrap animate-in fade-in-50 duration-200">
            <h1 className="font-extrabold text-[15px] text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors">
              Agricart ERP
            </h1>
          </div>
        )}
      </Link>
    </div>
  );
}
