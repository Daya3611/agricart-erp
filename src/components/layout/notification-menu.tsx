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
      <PopoverTrigger className="relative flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/50 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-2xs">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute top-2 right-2 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#228B4E] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#228B4E]" />
          </span>
        ) : (
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#228B4E]" />
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0 overflow-hidden shadow-xl bg-card border-border">
        <div className="p-3.5 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-xs text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#E8F5EC] dark:bg-[#173822] text-[#228B4E] dark:text-[#34D399]">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">Activity Alerts</span>
        </div>

        <div className="p-2 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Checking for alerts...</div>
          ) : items.length > 0 ? (
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group"
                  >
                    <div className="p-1.5 rounded-lg bg-[#E8F5EC] dark:bg-[#173822] text-[#228B4E] dark:text-[#34D399] shrink-0 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-6 px-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-[#228B4E] mx-auto mb-2 opacity-80" />
              <p className="text-xs font-semibold text-foreground">All caught up</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">No urgent operational alerts at this time.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
