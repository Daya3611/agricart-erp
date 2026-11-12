'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils/cn';
import { MediaPreview } from '@/components/media/media-preview';

interface SidebarBrandProps {
  collapsed: boolean;
  role: UserRole;
}

export function SidebarBrand({ collapsed, role }: SidebarBrandProps) {
  const [logoUrl, setLogoUrl] = useState<string>('/logo.png');
  const [brandName, setBrandName] = useState<string>('Agricart ERP');

  useEffect(() => {
    let active = true;
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.settings) return;
        const resolved =
          data.settings.companyLogoUrl ||
          data.settings.reportingConfig?.organization?.companyLogoUrl;
        if (resolved) setLogoUrl(resolved);
        if (data.settings.companyName) {
          setBrandName(
            data.settings.companyName.includes('Agricart') ? 'Agricart ERP' : data.settings.companyName
          );
        }
      })
      .catch(() => {
        // Fallback to static /logo.png quietly
      });
    return () => {
      active = false;
    };
  }, []);

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
        title={brandName}
      >
        <div className="relative h-10 w-10 shrink-0 rounded-2xl bg-card border border-border p-1 flex items-center justify-center shadow-2xs group-hover:border-primary/40 transition-colors overflow-hidden">
          <MediaPreview
            src={logoUrl}
            alt="Agricart FPC Logo"
            variant="logo"
            shape="rounded"
            className="h-full w-full border-0 p-0 bg-transparent"
          />
        </div>

        {!collapsed && (
          <div className="overflow-hidden whitespace-nowrap animate-in fade-in-50 duration-200">
            <h1 className="font-extrabold text-[15px] text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors">
              {brandName}
            </h1>
          </div>
        )}
      </Link>
    </div>
  );
}
