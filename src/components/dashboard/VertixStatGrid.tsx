'use client';

import React from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { DashboardStats } from '@/types';

interface VertixStatGridProps {
  role?: 'admin' | 'staff' | 'manager';
  stats?: DashboardStats | null;
  // Staff counts
  draftCount?: number;
  awaitingCount?: number;
  correctionsCount?: number;
  approvedCount?: number;
}

export function VertixStatGrid({
  role = 'admin',
  stats,
  draftCount = 0,
  awaitingCount = 0,
  correctionsCount = 0,
  approvedCount = 0,
}: VertixStatGridProps) {
  const isStaff = role === 'staff';

  if (isStaff) {
    return (
      <div className="grid grid-cols-2 gap-4 h-full">
        {/* 1. Highlight Card: Approved Reports (Restrained Green Gradient) */}
        <Card
          className="p-5 rounded-[22px] border-0 text-white flex flex-col justify-between shadow-xs relative overflow-hidden highlight-green-gradient"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/90">
              Approved Reports
            </span>
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-2 mt-4 sm:mt-6">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {approvedCount}
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-xs">
              <CheckCircle2 className="h-3 w-3" />
              <span>Verified on file</span>
            </div>
          </div>
        </Card>

        {/* 2. White/Dark Card: Awaiting Review */}
        <Card className="p-5 rounded-[22px] flex flex-col justify-between shadow-2xs card-saas-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Awaiting Review
            </span>
            <div className="h-8 w-8 rounded-full bg-[#EEF4FF] dark:bg-[#172554]/40 flex items-center justify-center text-[#1D60C9] dark:text-[#60a5fa]">
              <Clock className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-2 mt-4 sm:mt-6">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-card-foreground">
              {awaitingCount}
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EEF4FF] dark:bg-[#172554]/30 text-[#1D60C9] dark:text-[#60a5fa] text-[11px] font-bold">
              <span>Pending review</span>
            </div>
          </div>
        </Card>

        {/* 3. White/Dark Card: Corrections Required */}
        <Card className="p-5 rounded-[22px] flex flex-col justify-between shadow-2xs card-saas-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Corrections Required
            </span>
            <div className="h-8 w-8 rounded-full bg-[#FDF1F1] dark:bg-[#450a0a]/40 flex items-center justify-center text-[#DC5252] dark:text-[#f87171]">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-2 mt-4 sm:mt-6">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-card-foreground">
              {correctionsCount}
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FDF1F1] dark:bg-[#450a0a]/30 text-[#DC5252] dark:text-[#f87171] text-[11px] font-bold">
              <span>Action required</span>
            </div>
          </div>
        </Card>

        {/* 4. White/Dark Card: Draft Reports */}
        <Card className="p-5 rounded-[22px] flex flex-col justify-between shadow-2xs card-saas-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Draft Reports
            </span>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <FileText className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-2 mt-4 sm:mt-6">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-card-foreground">
              {draftCount}
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF7E8] dark:bg-[#451a03]/30 text-[#D99A28] dark:text-[#fbbf24] text-[11px] font-bold">
              <span>Saved in progress</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Admin / Manager Operational Stats Grid
  const totalEmployees = stats?.totalActiveStaff ?? 0;
  const awaitingReview = stats?.awaitingApprovalCount ?? 0;
  const correctionsPending = stats?.correctionRequestedCount ?? 0;
  const approvedReports = stats?.approvedReportsCount ?? 0;

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* 1. Highlight Card: Total Employees */}
      <Card
        className="p-5 rounded-[22px] border-0 text-white flex flex-col justify-between shadow-xs relative overflow-hidden highlight-green-gradient"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white/90">
            Total Employees
          </span>
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-xs">
            <Users className="h-4 w-4" />
          </div>
        </div>

        <div className="space-y-2 mt-4 sm:mt-6">
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {totalEmployees}
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-xs">
            <span>Active in system</span>
          </div>
        </div>
      </Card>

      {/* 2. White/Dark Card: Reports Awaiting Review */}
      <Card className="p-5 rounded-[22px] flex flex-col justify-between shadow-2xs card-saas-hover">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            Reports Awaiting Review
          </span>
          <div className="h-8 w-8 rounded-full bg-[#EEF4FF] dark:bg-[#172554]/40 flex items-center justify-center text-[#1D60C9] dark:text-[#60a5fa]">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="space-y-2 mt-4 sm:mt-6">
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-card-foreground">
            {awaitingReview}
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EEF4FF] dark:bg-[#172554]/30 text-[#1D60C9] dark:text-[#60a5fa] text-[11px] font-bold">
            <span>Pending review</span>
          </div>
        </div>
      </Card>

      {/* 3. White/Dark Card: Corrections Pending */}
      <Card className="p-5 rounded-[22px] flex flex-col justify-between shadow-2xs card-saas-hover">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            Corrections Pending
          </span>
          <div className="h-8 w-8 rounded-full bg-[#FDF1F1] dark:bg-[#450a0a]/40 flex items-center justify-center text-[#DC5252] dark:text-[#f87171]">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>

        <div className="space-y-2 mt-4 sm:mt-6">
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-card-foreground">
            {correctionsPending}
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FDF1F1] dark:bg-[#450a0a]/30 text-[#DC5252] dark:text-[#f87171] text-[11px] font-bold">
            <span>Action required</span>
          </div>
        </div>
      </Card>

      {/* 4. White/Dark Card: Approved Reports */}
      <Card className="p-5 rounded-[22px] flex flex-col justify-between shadow-2xs card-saas-hover">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            Approved Reports
          </span>
          <div className="h-8 w-8 rounded-full bg-[#E8F5EC] dark:bg-[#183323] flex items-center justify-center text-[#228B4E] dark:text-[#4ade80]">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>

        <div className="space-y-2 mt-4 sm:mt-6">
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-card-foreground">
            {approvedReports}
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E8F5EC] dark:bg-[#183323] text-[#228B4E] dark:text-[#4ade80] text-[11px] font-bold">
            <span>Verified today</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
