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
      title: 'Total Active Staff',
      value: stats.totalActiveStaff,
      subtext: `${stats.scheduledStaffToday} scheduled working today`,
      icon: Users,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      badge: null,
    },
    {
      title: 'Reports Submitted Today',
      value: stats.reportsSubmittedToday,
      subtext: `Out of ${stats.reportsExpectedToday} expected reports`,
      icon: FileCheck2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      badge: `${stats.dailySubmissionRate}% Rate`,
      badgeVariant: 'default' as const,
    },
    {
      title: 'Missing Reports Today',
      value: stats.missingReportsToday,
      subtext: 'Staff who have not submitted yet',
      icon: AlertCircle,
      color: stats.missingReportsToday > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-50 border-slate-200',
      badge: stats.missingReportsToday > 0 ? 'Action Required' : 'All Clear',
      badgeVariant: stats.missingReportsToday > 0 ? ('warning' as const) : ('secondary' as const),
    },
    {
      title: 'Awaiting Review / Approval',
      value: stats.awaitingApprovalCount,
      subtext: 'Submitted reports ready for manager review',
      icon: Clock,
      color: 'text-sky-700 bg-sky-50 border-sky-200',
      badge: 'Pending Review',
      badgeVariant: 'info' as const,
    },
    {
      title: 'Approved Reports',
      value: stats.approvedReportsCount ?? 0,
      subtext: 'Reviewed and verified reports',
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      badge: 'Verified',
      badgeVariant: 'default' as const,
    },
    {
      title: 'Corrections Requested',
      value: stats.correctionRequestedCount,
      subtext: 'Sent back to staff for modification',
      icon: XCircle,
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      badge: `${stats.correctionRequestedCount} Active`,
      badgeVariant: 'destructive' as const,
    },
    {
      title: 'Overall Compliance Rate',
      value: `${stats.dailySubmissionRate}%`,
      subtext: 'Based on expected vs submitted reports',
      icon: TrendingUp,
      color: 'text-purple-700 bg-purple-50 border-purple-200',
      badge: stats.dailySubmissionRate >= 90 ? 'Excellent' : 'Needs Followup',
      badgeVariant: stats.dailySubmissionRate >= 90 ? ('default' as const) : ('warning' as const),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card key={idx} className="hover:border-emerald-300 transition-all">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.title}</span>
                <div className={`p-2 rounded-xl border ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">{card.value}</span>
                  {card.badge && (
                    <Badge variant={card.badgeVariant} className="text-[10px] px-2">
                      {card.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-1 truncate">{card.subtext}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
