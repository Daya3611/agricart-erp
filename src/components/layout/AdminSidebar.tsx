'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  MapPin,
  FileText,
  Clock,
  AlertTriangle,
  BarChart3,
  Mail,
  ShieldCheck,
  Settings,
  LogOut,
  Shield,
} from 'lucide-react';
import Image from 'next/image';
import { UserProfile, UserRole } from '@/types';
import { cn } from '@/lib/utils/cn';

interface AdminSidebarProps {
  user: UserProfile;
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const isSuperAdmin = user.role === 'super_admin';

  const navItems = [
    { label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Staff Management', href: '/admin/staff', icon: Users },
    { label: 'Departments', href: '/admin/departments', icon: Building2 },
    { label: 'Centers & Locations', href: '/admin/centers', icon: MapPin },
    { label: 'Daily Activity Reports', href: '/admin/reports', icon: FileText },
    { label: 'Pending Reviews', href: '/admin/pending-reviews', icon: Clock },
    { label: 'Missing Reports', href: '/admin/missing-reports', icon: AlertTriangle },
    { label: 'Analytics & Reports', href: '/admin/analytics', icon: BarChart3 },
    { label: 'Email Logs', href: '/admin/email-logs', icon: Mail },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: ShieldCheck },
    ...(isSuperAdmin ? [{ label: 'Settings', href: '/admin/settings', icon: Settings, superAdminOnly: true }] : []),
  ];

  const roleBadges: Record<UserRole, { label: string; bg: string }> = {
    super_admin: { label: 'Super Admin', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    admin: { label: 'Administrator', bg: 'bg-sky-100 text-sky-800 border-sky-200' },
    manager: { label: 'Dept Head', bg: 'bg-purple-100 text-purple-800 border-purple-200' },
    staff: { label: 'Staff', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200/80 h-screen flex flex-col justify-between shadow-xs overflow-y-auto">
      <div>
        {/* Company Header */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="relative h-11 w-11 shrink-0 rounded-xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shadow-xs">
            <Image
              src="/logo.png"
              alt="Agricart FPC Logo"
              width={40}
              height={40}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="font-extrabold text-base text-slate-900 leading-tight tracking-tight">
              AGRICART FPC
            </h1>
            <p className="text-[11px] font-semibold text-emerald-700 tracking-wide uppercase">
              Admin Portal
            </p>
          </div>
        </div>

        {/* User Badge Card */}
        <div className="p-4 mx-3 my-3 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm border border-emerald-200">
              {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-900 truncate">{user.fullName}</p>
              <p className="text-[11px] font-medium text-slate-500 truncate">{user.employeeId}</p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <span
              className={cn(
                'inline-block px-2 py-0.5 text-[10px] font-bold rounded-md border',
                roleBadges[user.role]?.bg || roleBadges.admin.bg
              )}
            >
              {roleBadges[user.role]?.label || 'Admin'}
            </span>
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-800 font-bold">
                <Shield className="h-3 w-3" /> Full Access
              </span>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout Footer */}
      <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
        <a
          href="/api/auth/logout"
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </a>
      </div>
    </aside>
  );
}
