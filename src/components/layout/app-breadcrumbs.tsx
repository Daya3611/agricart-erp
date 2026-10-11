'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const ROUTE_LABELS: Record<string, { section: string; title: string }> = {
  '/admin/dashboard': { section: 'Overview', title: 'Dashboard' },
  '/admin/staff': { section: 'Organization', title: 'Employees' },
  '/admin/departments': { section: 'Organization', title: 'Departments' },
  '/admin/centers': { section: 'Organization', title: 'Centers' },
  '/admin/reports': { section: 'Reports', title: 'Daily Reports' },
  '/admin/pending-reviews': { section: 'Reports', title: 'Pending Reviews' },
  '/admin/missing-reports': { section: 'Reports', title: 'Missing Reports' },
  '/admin/analytics': { section: 'Reports', title: 'Report Analytics' },
  '/admin/email-logs': { section: 'Communication', title: 'Email Logs' },
  '/admin/audit-logs': { section: 'Administration', title: 'Audit Logs' },
  '/admin/settings': { section: 'Administration', title: 'System Settings' },

  '/manager/dashboard': { section: 'Overview', title: 'Dashboard' },
  '/manager/reports': { section: 'Team & Reports', title: 'Team Reports & Reviews' },
  '/manager/staff': { section: 'Team & Reports', title: 'Assigned Staff' },
  '/manager/analytics': { section: 'Team & Reports', title: 'Department Analytics' },

  '/staff/dashboard': { section: 'Workspace', title: 'My Dashboard' },
  '/staff/daily-report': { section: 'Workspace', title: 'Submit Daily Report' },
  '/staff/report-history': { section: 'Workspace', title: 'My Reports' },
  '/staff/corrections': { section: 'Workspace', title: 'Corrections Required' },
  '/staff/profile': { section: 'Account', title: 'My Profile' },
};

export function AppBreadcrumbs() {
  const pathname = usePathname();

  const currentRoute = ROUTE_LABELS[pathname];

  // Determine root portal
  const isManager = pathname.startsWith('/manager');
  const isStaff = pathname.startsWith('/staff');
  const portalName = isManager ? 'Manager Portal' : isStaff ? 'Staff Portal' : 'Admin Portal';
  const portalHome = isManager ? '/manager/dashboard' : isStaff ? '/staff/dashboard' : '/admin/dashboard';

  return (
    <Breadcrumb className="hidden sm:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            href={portalHome}
            className="flex items-center gap-1.5 text-slate-500 hover:text-emerald-700 transition-colors"
          >
            <Home className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden md:inline font-semibold">{portalName}</span>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {currentRoute ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-slate-400 font-medium">{currentRoute.section}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{currentRoute.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="capitalize">
                {pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Page'}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
