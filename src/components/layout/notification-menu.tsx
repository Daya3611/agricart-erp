'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { UserProfile } from '@/types';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils/cn';

interface NotificationMenuProps {
  user: UserProfile;
}

export function NotificationMenu({ user }: NotificationMenuProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [items, setItems] = useState<{ id: string; title: string; desc: string; href: string; icon: any }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function checkPendingTasks() {
      try {
        setLoading(true);
        const alerts: { id: string; title: string; desc: string; href: string; icon: any }[] = [];

        if (user.role === 'admin' || user.role === 'super_admin') {
          // Check pending reviews or email logs
          const res = await fetch('/api/reports?status=pending&limit=5');
          if (res.ok) {
            const data = await res.json();
            const pendingReports = data.reports || [];
            if (pendingReports.length > 0) {
              alerts.push({
                id: 'pending-reviews',
                title: 'Pending Report Reviews',
                desc: `${pendingReports.length} daily report${pendingReports.length > 1 ? 's' : ''} awaiting approval.`,
                href: '/admin/pending-reviews',
                icon: Clock,
              });
            }
          }
        } else if (user.role === 'manager') {
          const res = await fetch('/api/reports?status=pending&limit=5');
          if (res.ok) {
            const data = await res.json();
            const pendingReports = data.reports || [];
            if (pendingReports.length > 0) {
              alerts.push({
                id: 'manager-reviews',
                title: 'Team Reports Pending',
                desc: `${pendingReports.length} report${pendingReports.length > 1 ? 's' : ''} submitted by your team.`,
                href: '/manager/reports',
                icon: Clock,
              });
            }
          }
        } else if (user.role === 'staff') {
          // Check if staff has reports requiring correction
          const res = await fetch('/api/reports?status=revision_requested&limit=5');
          if (res.ok) {
            const data = await res.json();
            const revisionReports = data.reports || [];
            if (revisionReports.length > 0) {
              alerts.push({
                id: 'staff-corrections',
                title: 'Corrections Requested',
                desc: `${revisionReports.length} report${revisionReports.length > 1 ? 's' : ''} returned for revisions.`,
                href: '/staff/corrections',
                icon: AlertCircle,
              });
            }
          }
        }

        if (isMounted) {
          setItems(alerts);
          setUnreadCount(alerts.length);
        }
      } catch {
        // Silently handle error without showing false data
        if (isMounted) {
          setItems([]);
          setUnreadCount(0);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkPendingTasks();
    return () => {
      isMounted = false;
    };
  }, [user.role]);

  return (
    <Popover>
      <PopoverTrigger className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 overflow-hidden shadow-xl">
        <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-xs text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">Activity Alerts</span>
        </div>

        <div className="p-2 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400">Checking for alerts...</div>
          ) : items.length > 0 ? (
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 shrink-0 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-6 px-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-semibold text-slate-800">All caught up</p>
              <p className="text-[11px] text-slate-400 mt-0.5">No urgent operational alerts at this time.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
