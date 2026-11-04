'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  MapPin,
  Calendar,
  Users,
  ArrowUpRight,
  FileEdit,
  ArrowRight,
  ShieldCheck,
  LogIn,
  LogOut,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DashboardStats, Center, Department, DailyReport, UserProfile, AttendanceSession } from '@/types';

interface VertixBalanceCardProps {
  role?: 'admin' | 'staff' | 'manager';
  user?: UserProfile | null;
  stats?: DashboardStats | null;
  departments?: Department[];
  centers?: Center[];
  reports?: DailyReport[];
  todayReport?: DailyReport | null;
  todayLeave?: any | null;
  attendanceSession?: AttendanceSession | null;
  onAttendanceClick?: () => void;
  deadline?: string;
  onQuickAction?: () => void;
  onExport?: () => void;
}

export function VertixBalanceCard({
  role = 'admin',
  user,
  stats,
  departments = [],
  centers = [],
  reports = [],
  todayReport,
  todayLeave,
  attendanceSession,
  onAttendanceClick,
  deadline = '07:00 PM IST',
  onQuickAction,
  onExport,
}: VertixBalanceCardProps) {
  const isStaff = role === 'staff';

  if (isStaff) {
    // Staff Employee Calculations (Strictly real data)
    const totalReportsCount = reports.length;
    const workingDaysMonth = 26;
    const progressPercent = Math.min(100, Math.round((totalReportsCount / workingDaysMonth) * 100));

    // Determine today's real status
    let statusLabel = 'Report Pending';
    let statusBadgeColor = 'bg-[#FEF7E8] text-[#D99A28] dark:bg-[#451a03]/30 dark:text-[#fbbf24]';
    let statusDotColor = 'bg-[#D99A28]';

    if (todayReport) {
      if (todayReport.status === 'approved') {
        statusLabel = 'Report Approved';
        statusBadgeColor = 'bg-[#E8F5EC] text-[#228B4E] dark:bg-[#183323] dark:text-[#4ade80]';
        statusDotColor = 'bg-[#228B4E]';
      } else if (todayReport.status === 'draft') {
        statusLabel = 'Draft Saved';
        statusBadgeColor = 'bg-[#FEF7E8] text-[#D99A28] dark:bg-[#451a03]/30 dark:text-[#fbbf24]';
        statusDotColor = 'bg-[#D99A28]';
      } else if (
        todayReport.status === 'correction_requested' ||
        todayReport.status === 'edit_requested'
      ) {
        statusLabel = 'Correction Required';
        statusBadgeColor = 'bg-[#FDF1F1] text-[#DC5252] dark:bg-[#450a0a]/30 dark:text-[#f87171]';
        statusDotColor = 'bg-[#DC5252]';
      } else {
        statusLabel = 'Submitted & In Review';
        statusBadgeColor = 'bg-[#EEF4FF] text-[#1D60C9] dark:bg-[#172554]/30 dark:text-[#60a5fa]';
        statusDotColor = 'bg-[#1D60C9]';
      }
    } else if (todayLeave) {
      statusLabel = 'On Approved Leave';
      statusBadgeColor = 'bg-[#EEF4FF] text-[#1D60C9] dark:bg-[#172554]/30 dark:text-[#60a5fa]';
      statusDotColor = 'bg-[#1D60C9]';
    }

    const isAttendanceActive =
      attendanceSession?.status === 'active' || attendanceSession?.attendanceStatus === 'active';
    const isAttendanceClosed =
      attendanceSession?.status === 'closed' ||
      attendanceSession?.attendanceStatus === 'closed' ||
      attendanceSession?.attendanceStatus === 'system_closed';

    const handleAttendanceAction = () => {
      if (onAttendanceClick) {
        onAttendanceClick();
      } else {
        const card = document.getElementById('attendance-card');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    return (
      <div className="space-y-4">
        {/* Main Employee Operational Card */}
        <Card className="p-6 rounded-[22px]">
          <div className="space-y-5">
            {/* Top Row: Metric Label & Status Pill */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Today&apos;s Overview
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusBadgeColor}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusDotColor}`} />
                {statusLabel}
              </span>
            </div>

            {/* Primary Status & Deadline */}
            <div className="space-y-1.5">
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                {todayReport?.status === 'approved'
                  ? 'Completed'
                  : todayReport?.status === 'draft'
                  ? 'Draft'
                  : todayReport
                  ? 'Submitted'
                  : todayLeave
                  ? 'On Leave'
                  : 'Pending'}
              </div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-light border border-[#CDE7D4] dark:border-[#1F3D2A] text-primary text-[11px] font-bold">
                <Clock className="h-3 w-3" />
                <span>Daily deadline: {deadline}</span>
              </div>
            </div>

            {/* Action Buttons: Submit Daily Report & Attendance Login / Logout */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <Link href="/staff/daily-report" className="w-full">
                <Button className="w-full bg-[#252923] dark:bg-primary hover:bg-[#176638] text-white font-semibold text-xs h-10 rounded-full flex items-center justify-center gap-1.5 shadow-xs transition-all">
                  <FileEdit className="h-3.5 w-3.5" />
                  <span>Submit Daily Report</span>
                </Button>
              </Link>
              <Button
                type="button"
                variant="outline"
                onClick={handleAttendanceAction}
                disabled={isAttendanceClosed}
                className={`w-full font-semibold text-xs h-10 rounded-full flex items-center justify-center gap-1.5 shadow-2xs transition-all ${
                  isAttendanceActive
                    ? 'border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                    : isAttendanceClosed
                    ? 'opacity-60 bg-muted/50 cursor-not-allowed text-muted-foreground'
                    : 'border-border text-foreground hover:bg-[#E8F5EC] hover:text-[#228B4E] hover:border-[#CDE7D4]'
                }`}
              >
                {isAttendanceClosed ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#228B4E]" />
                    <span>Day Completed</span>
                  </>
                ) : isAttendanceActive ? (
                  <>
                    <LogOut className="h-3.5 w-3.5 text-rose-600" />
                    <span>Logout</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-3.5 w-3.5 text-[#228B4E]" />
                    <span>Login</span>
                  </>
                )}
              </Button>
            </div>

            {/* Sub-Cards: Department, Center, Status (Exact 3-col layout) */}
            <div className="pt-2 border-t border-border space-y-2.5">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Assigned Work Details
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Mini Card 1: Department */}
                <div className="p-2.5 rounded-2xl bg-muted/60 border border-border space-y-1">
                  <div className="text-[11px] font-bold text-muted-foreground truncate">
                    Department
                  </div>
                  <div className="text-xs font-extrabold text-foreground truncate">
                    {user?.departmentName || 'Field Ops'}
                  </div>
                  <span className="inline-block text-[10px] font-semibold text-primary">
                    Assigned
                  </span>
                </div>

                {/* Mini Card 2: Center */}
                <div className="p-2.5 rounded-2xl bg-muted/60 border border-border space-y-1">
                  <div className="text-[11px] font-bold text-muted-foreground truncate">
                    Center
                  </div>
                  <div className="text-xs font-extrabold text-foreground truncate">
                    {user?.assignedCenterNames?.[0] || 'Packhouse'}
                  </div>
                  <span className="inline-block text-[10px] font-semibold text-primary">
                    Active
                  </span>
                </div>

                {/* Mini Card 3: Status */}
                <div className="p-2.5 rounded-2xl bg-muted/60 border border-border space-y-1">
                  <div className="text-[11px] font-bold text-muted-foreground truncate">
                    Today&apos;s Status
                  </div>
                  <div className="text-xs font-extrabold text-foreground truncate">
                    {todayReport ? 'Filed' : todayLeave ? 'Leave' : 'Pending'}
                  </div>
                  <span
                    className={`inline-block text-[10px] font-semibold ${
                      todayReport ? 'text-primary' : 'text-[#D99A28] dark:text-[#fbbf24]'
                    }`}
                  >
                    {todayReport ? 'Verified' : 'Required'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Reporting Deadline & Monthly Submission Progress */}
        <Card className="p-5 rounded-[22px]">
          <div className="space-y-3">
            <div className="text-xs font-semibold text-foreground">
              Reporting Deadline &amp; Status
            </div>

            {/* Two-tone Progress Bar */}
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Lower Values */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">
                {totalReportsCount}{' '}
                <span className="text-muted-foreground font-normal">submitted out of</span>
              </span>
              <span className="font-bold text-foreground">
                {workingDaysMonth} working days
              </span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Admin / Manager View (Strictly real data)
  const submissionRate = stats?.dailySubmissionRate ?? 0;
  const submittedToday = stats?.reportsSubmittedToday ?? 0;
  const expectedToday = stats?.reportsExpectedToday ?? 0;
  const deptCount = departments.length;
  const centerCount = centers.length;
  const onLeaveCount = stats?.onLeaveToday ?? 0;

  return (
    <div className="space-y-4">
      {/* Main Total Operations Card */}
      <Card className="p-6 rounded-[22px]">
        <div className="space-y-5">
          {/* Top Row: Metric Label & Cycle Pill */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Daily Field Operations
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border text-xs font-bold text-foreground">
              <span>Today&apos;s Cycle</span>
            </div>
          </div>

          {/* Primary Rate & Compliance Indicator */}
          <div className="space-y-1.5">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              {submissionRate}%
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-light border border-[#CDE7D4] dark:border-[#1F3D2A] text-primary text-[11px] font-bold">
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>
                {submittedToday} of {expectedToday} reports submitted
              </span>
            </div>
          </div>

          {/* Action Buttons: Review Reports & Manage Staff */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Link href="/admin/pending-reviews" className="w-full">
              <Button className="w-full bg-[#252923] dark:bg-primary hover:bg-[#176638] text-white font-semibold text-xs h-10 rounded-full flex items-center justify-center gap-1.5 shadow-xs transition-all">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Review Reports</span>
              </Button>
            </Link>
            <Link href="/admin/staff" className="w-full">
              <Button
                variant="outline"
                className="w-full font-semibold text-xs h-10 rounded-full flex items-center justify-center gap-1.5 shadow-2xs transition-all"
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Manage Employees</span>
              </Button>
            </Link>
          </div>

          {/* Mini Cards Breakdown: Departments, Centers, Leaves (Exact 3-col layout) */}
          
          <div className="border-t border-border pt-3 mt-1 space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Operational Hubs
              </h3>
              <span className="text-[10px] text-muted-foreground">
                Organization Overview
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 min-w-0">

              {/* Departments */}
              <div className="min-w-0 min-h-[100px] rounded-xl border border-border bg-muted/40 p-2.5 flex flex-col justify-between gap-2">
                <div className="text-[11px] font-semibold text-muted-foreground leading-tight">
                  Departments
                </div>

                <div className="text-lg font-extrabold text-foreground leading-none">
                  {deptCount}
                </div>

                <div className="text-[10px] font-semibold text-primary leading-tight">
                  Active
                </div>
              </div>

              {/* Centers */}
              <div className="min-w-0 min-h-[100px] rounded-xl border border-border bg-muted/40 p-2.5 flex flex-col justify-between gap-2">
                <div className="text-[11px] font-semibold text-muted-foreground leading-tight">
                  Centers
                </div>

                <div className="text-lg font-extrabold text-foreground leading-none">
                  {centerCount}
                </div>

                <div className="text-[10px] font-semibold text-primary leading-tight">
                  Active
                </div>
              </div>

              {/* Staff on Leave */}
              <div className="min-w-0 min-h-[100px] rounded-xl border border-border bg-muted/40 p-2.5 flex flex-col justify-between gap-2">
                <div className="text-[11px] font-semibold text-muted-foreground leading-tight">
                  On Leave
                </div>

                <div className="text-lg font-extrabold text-foreground leading-none">
                  {onLeaveCount}
                </div>

                <div className="text-[10px] font-semibold text-muted-foreground leading-tight">
                  Authorized
                </div>
              </div>

            </div>
          </div>

        </div>
      </Card>

      {/* Daily Submission Compliance Card */}
      <Card className="p-5 rounded-[22px]">
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground">
            Daily Submission Compliance
          </div>

          {/* Two-tone Progress Bar */}
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, submissionRate))}%` }}
            />
          </div>

          {/* Lower Values */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">
              {submittedToday}{' '}
              <span className="text-muted-foreground font-normal">submitted out of</span>
            </span>
            <span className="font-bold text-foreground">
              {expectedToday} expected
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
