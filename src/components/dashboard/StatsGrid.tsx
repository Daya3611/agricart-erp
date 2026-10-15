'use client';

import React from 'react';
import { Users, FileCheck2, AlertCircle, Clock, CheckCircle2, TrendingUp, XCircle } from 'lucide-react';
import { DashboardStats } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface StatsGridProps {
  stats: DashboardStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const cards = [
    {
      title: 'Active Staff',
      value: stats.totalActiveStaff,
      subtext: stats.onLeaveToday && stats.onLeaveToday > 0 
        ? `${stats.scheduledStaffToday} working (${stats.onLeaveToday} on leave)`
        : `${stats.scheduledStaffToday} scheduled working`,
      icon: Users,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      badge: stats.onLeaveToday && stats.onLeaveToday > 0 ? `${stats.onLeaveToday} on leave` : null,
    },
    {
      title: 'Submitted Today',
      value: stats.reportsSubmittedToday,
      subtext: `Target: ${stats.reportsExpectedToday} expected reports`,
      icon: FileCheck2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      badge: `${stats.dailySubmissionRate}% Rate`,
      badgeVariant: 'default' as const,
    },
    {
      title: 'Missing Reports',
      value: stats.missingReportsToday,
      subtext: 'Staff not submitted yet',
      icon: AlertCircle,
      color: stats.missingReportsToday > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-50 border-slate-200',
      badge: stats.missingReportsToday > 0 ? 'Action Req' : 'Clear',
      badgeVariant: stats.missingReportsToday > 0 ? ('warning' as const) : ('secondary' as const),
    },
    {
      title: 'Pending Review',
      value: stats.awaitingApprovalCount,
      subtext: 'Awaiting manager approval',
      icon: Clock,
      color: 'text-sky-700 bg-sky-50 border-sky-200',
      badge: 'Review Queue',
      badgeVariant: 'info' as const,
    },
    {
      title: 'Approved Reports',
      value: stats.approvedReportsCount ?? 0,
      subtext: 'Reviewed and verified',
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      badge: 'Verified',
      badgeVariant: 'default' as const,
    },
    {
      title: 'Corrections Req',
      value: stats.correctionRequestedCount,
      subtext: 'Sent back for changes',
      icon: XCircle,
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      badge: `${stats.correctionRequestedCount} Active`,
      badgeVariant: 'destructive' as const,
    },
    {
      title: 'Compliance Rate',
      value: `${stats.dailySubmissionRate}%`,
      subtext: 'Submitted vs expected',
      icon: TrendingUp,
      color: 'text-purple-700 bg-purple-50 border-purple-200',
      badge: stats.dailySubmissionRate >= 90 ? 'High' : 'Followup',
      badgeVariant: stats.dailySubmissionRate >= 90 ? ('default' as const) : ('warning' as const),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card key={idx} className="hover:border-emerald-300 transition-all">
            <CardContent className="p-3 sm:p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  {card.title}
                </span>
                <div className={`p-1.5 sm:p-2 rounded-xl border shrink-0 ${card.color}`}>
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </div>
              <div className="mt-2 sm:mt-3">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {card.value}
                  </span>
                  {card.badge && (
                    <Badge variant={card.badgeVariant} className="text-[9px] sm:text-[10px] px-1.5 py-0 shrink-0">
                      {card.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 sm:mt-1 truncate">
                  {card.subtext}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
