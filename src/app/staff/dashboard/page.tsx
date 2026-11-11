'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PlusCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  CalendarOff,
  User,
  CalendarDays,
  FileEdit,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Play,
  Square,
} from 'lucide-react';
import { DailyReport, UserProfile, AttendanceSession } from '@/types';
import { VertixWelcomeHeader } from '@/components/dashboard/VertixWelcomeHeader';
import { VertixBalanceCard } from '@/components/dashboard/VertixBalanceCard';
import { VertixStatGrid } from '@/components/dashboard/VertixStatGrid';
import { VertixIncomeChart, ChartDataPoint } from '@/components/dashboard/VertixIncomeChart';
import { VertixRecentActivities } from '@/components/dashboard/VertixRecentActivities';
import { Button } from '@/components/ui/button';
import { ReportReviewModal } from '@/components/reports/ReportReviewModal';
import { getTodayDateString } from '@/lib/utils/date-utils';
import { isActivityInProgress } from '@/lib/utils/field-activity-calculations';
import { StaffDashboardAttendanceCard } from '@/components/attendance/StaffDashboardAttendanceCard';

export default function StaffDashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [todayLeave, setTodayLeave] = useState<any | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [attendanceSession, setAttendanceSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  const todayStr = getTodayDateString();

  const loadStaffData = async () => {
    setLoading(true);
    try {
      // 1. Authenticated session user
      const sessRes = await fetch('/api/auth/session');
      const sessData = await sessRes.json();
      if (sessData.authenticated) setUser(sessData.user);

      // 2. Fetch reports for this authenticated staff user only
      const repRes = await fetch('/api/reports');
      const repData = await repRes.json();
      if (repData.reports) {
        setReports(repData.reports);
        const foundToday = repData.reports.find(
          (r: DailyReport) => r.reportDate === todayStr
        );
        if (foundToday) setTodayReport(foundToday);
      }

      // 3. Fetch leaves to see if staff is on approved leave today
      const leavesRes = await fetch('/api/leaves');
      const leavesData = await leavesRes.json();
      if (leavesData.leaves) {
        const activeLeave = leavesData.leaves.find(
          (l: any) =>
            l.approvalStatus === 'approved' &&
            l.startDate <= todayStr &&
            l.endDate >= todayStr
        );
        if (activeLeave) setTodayLeave(activeLeave);
      }

      // 4. Fetch today's attendance session
      try {
        const attRes = await fetch('/api/attendance/current');
        const attData = await attRes.json();
        if (attRes.ok && attData.success) {
          setAttendanceSession(attData.session);
        }
      } catch (attErr) {
        console.warn('Failed to load current attendance session:', attErr);
      }
    } catch (err) {
      console.error('Failed to load staff dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaffData();
  }, [todayStr]);

  // Authenticated user summary metrics (Strictly from real database records)
  const draftReports = reports.filter((r) => r.status === 'draft');
  const awaitingReviewReports = reports.filter(
    (r) =>
      r.status === 'submitted' ||
      r.status === 'under_review' ||
      r.status === 'resubmitted'
  );
  const correctionsRequired = reports.filter(
    (r) =>
      r.status === 'correction_requested' || r.status === 'edit_requested'
  );
  const approvedReports = reports.filter((r) => r.status === 'approved');

  // Compute monthly activity trends from actual database records
  const monthlyActivityData: ChartDataPoint[] = (() => {
    const now = new Date();
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const dataPoints: ChartDataPoint[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const prefix = `${yyyy}-${mm}`;
      const monthLabel = monthNames[d.getMonth()];

      const monthReports = reports.filter(
        (r) => r.reportDate && r.reportDate.startsWith(prefix)
      );
      const approved = monthReports.filter((r) => r.status === 'approved').length;
      const submitted = monthReports.filter(
        (r) =>
          r.status === 'submitted' ||
          r.status === 'under_review' ||
          r.status === 'resubmitted'
      ).length;

      dataPoints.push({
        label: monthLabel,
        series1: approved,
        series2: submitted,
      });
    }

    return dataPoints;
  })();

  // Today's Status Banner (Shows real status, deadline, and direct action)
  const renderTodayActionBanner = () => {
    // 1. Check if there's an ongoing in-progress field activity
    const activitiesList = Array.isArray((todayReport as any)?.fieldActivities)
      ? (todayReport as any).fieldActivities
      : Array.isArray((todayReport as any)?.activities)
      ? (todayReport as any).activities
      : [];
    const inProgressActivity = activitiesList.find((a: any) => isActivityInProgress(a));
    if (inProgressActivity) {
      return (
        <div className="p-5 rounded-[22px] bg-emerald-50/90 dark:bg-[#132B1C] border border-emerald-300 dark:border-[#1E4A2E] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
              Active Field Activity In Progress
            </span>
            <h2 className="text-base font-extrabold text-foreground">
              Activity #{inProgressActivity.slotNumber}: {inProgressActivity.activityNameLabel || inProgressActivity.activityName?.replace(/_/g, ' ')}
            </h2>
            <p className="text-xs text-muted-foreground">
              Started at {inProgressActivity.activityStartAt ? new Date(inProgressActivity.activityStartAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'recently'}. Field activities operate independently of attendance and continue until completed.
            </p>
          </div>
          <Link href={todayReport ? `/staff/daily-report?id=${todayReport.id}` : '/staff/daily-report'} className="w-full md:w-auto">
            <Button className="w-full md:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-10 px-5 rounded-full shadow-xs">
              <Square className="h-4 w-4 mr-1.5 fill-white" /> Continue &amp; End Activity
            </Button>
          </Link>
        </div>
      );
    }

    if (!todayReport) {
      if (todayLeave) {
        return (
          <div className="p-5 rounded-[22px] bg-[#EEF4FF] dark:bg-[#152338] border border-[#D4E4FC] dark:border-[#1D3C63] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
            <div className="space-y-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#D4E4FC] dark:bg-[#1D60C9]/25 text-[#1D60C9] dark:text-[#60A5FA] text-xs font-bold mb-1">
                On Approved Leave Today
              </span>
              <h2 className="text-base font-extrabold text-foreground">
                You are on authorized {todayLeave.leaveType.toUpperCase()} leave ({todayStr})
              </h2>
              <p className="text-xs text-muted-foreground">
                Leave duration: <span className="font-bold text-foreground">{todayLeave.daysCount} day(s)</span>. Exempt from submitting a daily report today.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/staff/leaves">
                <Button variant="outline" size="sm" className="font-semibold text-xs rounded-full border-border text-foreground bg-card hover:bg-muted">
                  <CalendarOff className="h-4 w-4 mr-1.5" /> View My Leaves
                </Button>
              </Link>
            </div>
          </div>
        );
      }

      return (
        <div className="p-5 sm:p-6 rounded-[22px] bg-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs card-saas-hover">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FEF7E8] dark:bg-[#D99A28]/20 text-[#D99A28] dark:text-[#FBBF24] text-xs font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D99A28] dark:bg-[#FBBF24]" />
              Today&apos;s Report Pending ({todayStr})
            </span>
            <h2 className="text-lg font-extrabold text-foreground">
              Ready to submit today&apos;s field activity report?
            </h2>
            <p className="text-xs text-muted-foreground">
              Daily submission deadline is <span className="font-bold text-primary">07:00 PM IST</span>. Log visited farmers, activities, and photo evidence.
            </p>
          </div>
          <Link href="/staff/daily-report" className="w-full md:w-auto">
            <Button className="w-full md:w-auto bg-[#228B4E] hover:bg-[#176638] text-white font-bold text-xs h-10 px-5 rounded-full shadow-xs">
              <PlusCircle className="h-4 w-4 mr-1.5" /> Submit Daily Report
            </Button>
          </Link>
        </div>
      );
    }

    if (todayReport.status === 'draft') {
      return (
        <div className="p-5 rounded-[22px] bg-[#FEF7E8] dark:bg-[#2A2315] border border-[#F6E6C4] dark:border-[#4E3D1F] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-card text-[#D99A28] dark:text-[#FBBF24] text-xs font-bold border border-border/40">
              Draft In Progress
            </span>
            <h2 className="text-base font-extrabold text-foreground">
              You have an unfinished draft for today ({todayStr})
            </h2>
            <p className="text-xs text-muted-foreground">
              Finish entering your field activities and submit before 07:00 PM.
            </p>
          </div>
          <Link href={`/staff/daily-report?id=${todayReport.id}`} className="w-full md:w-auto">
            <Button className="w-full md:w-auto bg-[#D99A28] hover:bg-[#b8801d] text-white font-bold text-xs h-10 px-5 rounded-full shadow-xs">
              <FileEdit className="h-4 w-4 mr-1.5" /> Continue Draft
            </Button>
          </Link>
        </div>
      );
    }

    if (
      todayReport.status === 'correction_requested' ||
      todayReport.status === 'edit_requested'
    ) {
      return (
        <div className="p-5 rounded-[22px] bg-[#FDF1F1] dark:bg-[#2C1919] border border-[#F8D2D2] dark:border-[#4D2323] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-card text-[#DC5252] dark:text-[#F87171] text-xs font-bold border border-border/40">
              Action Required: Reviewer Requested Correction
            </span>
            <h2 className="text-base font-extrabold text-foreground">
              Correction Requested on Today&apos;s Report
            </h2>
            <p className="text-xs text-muted-foreground">
              &quot;{todayReport.editRequest?.reason || todayReport.reviewComments || 'Please review and update field evidence.'}&quot;
            </p>
          </div>
          <Link href={`/staff/daily-report?id=${todayReport.id}`} className="w-full md:w-auto">
            <Button className="w-full md:w-auto bg-[#DC5252] hover:bg-[#b93838] text-white font-bold text-xs h-10 px-5 rounded-full shadow-xs">
              <RotateCcw className="h-4 w-4 mr-1.5" /> Edit &amp; Resubmit
            </Button>
          </Link>
        </div>
      );
    }

    // Report already submitted / approved
    return (
      <div className="p-5 rounded-[22px] bg-[#E8F5EC] dark:bg-[#132B1C] border border-[#CDE7D4] dark:border-[#1E4A2E] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-card text-[#228B4E] dark:text-[#34D399] text-xs font-bold border border-border/40">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Report {todayReport.status === 'approved' ? 'Approved & Verified' : 'Submitted Successfully'}
          </span>
          <h2 className="text-base font-extrabold text-foreground">
            Today&apos;s report ({todayStr}) is on file!
          </h2>
          <p className="text-xs text-muted-foreground">
            {todayReport.farmersVisited || 0} farmers visited • {todayReport.activities?.substring(0, 60)}...
          </p>
        </div>
        <Button
          onClick={() => setSelectedReport(todayReport)}
          variant="outline"
          className="bg-card hover:bg-muted border-[#CDE7D4] dark:border-[#1E4A2E] text-primary font-bold text-xs h-9 px-4 rounded-full"
        >
          View Report
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Welcome Section: Name, Employee ID, Department, Center, Submission Deadline */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <VertixWelcomeHeader
          user={user}
          subtitle={`Field Operations • ${user?.departmentName || 'Agricultural Operations'}`}
          employeeId={user?.employeeId}
          departmentName={user?.departmentName}
          centerName={user?.assignedCenterNames?.[0]}
          submissionDeadline="07:00 PM IST"
        />

        <div className="flex items-center gap-2">
          <Link href="/staff/daily-report">
            <Button className="bg-[#228B4E] hover:bg-[#176638] text-white font-semibold text-xs h-9 px-4 rounded-full shadow-xs">
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> New Report
            </Button>
          </Link>
          <Button
            onClick={loadStaffData}
            variant="outline"
            size="sm"
            className="bg-card hover:bg-muted border-border text-foreground font-semibold text-xs h-9 px-3.5 rounded-full shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Today's Overview & Action Banner */}
      {renderTodayActionBanner()}

      {/* 3. Dashboard Attendance Card (Section 2) */}
      <div id="attendance-card" className="scroll-mt-6">
        <StaffDashboardAttendanceCard
          user={user}
          session={attendanceSession}
          loading={loading}
          onSessionChange={(s) => setAttendanceSession(s)}
        />
      </div>

      {/* 4. Vertix 3-Column Asymmetric Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Column 1: Today's Overview, Work Details, Deadline & Progress */}
        <div className="lg:col-span-4 w-full">
          <VertixBalanceCard
            role="staff"
            user={user}
            reports={reports}
            todayReport={todayReport}
            todayLeave={todayLeave}
            attendanceSession={attendanceSession}
            onAttendanceClick={() => {
              const el = document.getElementById('attendance-card');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            deadline="07:00 PM IST"
          />
        </div>

        {/* Column 2: 2x2 Metric Cards (Approved, Awaiting Review, Corrections Required, Draft Reports) */}
        <div className="lg:col-span-4 w-full">
          <VertixStatGrid
            role="staff"
            approvedCount={approvedReports.length}
            awaitingCount={awaitingReviewReports.length}
            correctionsCount={correctionsRequired.length}
            draftCount={draftReports.length}
          />
        </div>

        {/* Column 3: Monthly Reporting Activity Dual-Bar Chart */}
        <div className="lg:col-span-4 w-full">
          <VertixIncomeChart
            title="Monthly Reporting Activity"
            subtitle="Your report submissions and approval history"
            legendSeries1="Approved"
            legendSeries2="Submitted"
            data={monthlyActivityData}
            loading={loading}
          />
        </div>
      </div>

      {/* 4. Bottom Row: Recent Activities Data Table */}
      <VertixRecentActivities
        reports={reports}
        loading={loading}
        onSelectReport={(report) => setSelectedReport(report)}
      />

      {/* 5. Existing Action Buttons / Shortcuts: Reusing existing card positions and dimensions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Action 1: Submit Daily Report */}
        <Link href="/staff/daily-report">
          <div className="p-4 bg-card rounded-[20px] border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#E8F5EC] dark:bg-[#173822] text-[#228B4E] dark:text-[#34D399] flex items-center justify-center group-hover:bg-[#d2ecd9] dark:group-hover:bg-[#1E4A2E] transition-colors">
                <FileEdit className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Submit Report</span>
                <span className="text-[11px] text-muted-foreground font-medium">Daily Log</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Action 2: My Reports */}
        <Link href="/staff/report-history">
          <div className="p-4 bg-card rounded-[20px] border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#EEF4FF] dark:bg-[#17253D] text-[#1D60C9] dark:text-[#60A5FA] flex items-center justify-center group-hover:bg-[#dce9fc] dark:group-hover:bg-[#1E355B] transition-colors">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">My Reports</span>
                <span className="text-[11px] text-muted-foreground font-medium">{reports.length} total</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Action 3: My Leaves */}
        <Link href="/staff/leaves">
          <div className="p-4 bg-card rounded-[20px] border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#F5F0FF] dark:bg-[#251838] text-[#6B21A8] dark:text-[#C084FC] flex items-center justify-center group-hover:bg-[#ece2fc] dark:group-hover:bg-[#341F52] transition-colors">
                <CalendarOff className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">My Leaves</span>
                <span className="text-[11px] text-muted-foreground font-medium">Requests</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Action 4: Monthly Report */}
        <Link href="/staff/reports/monthly">
          <div className="p-4 bg-card rounded-[20px] border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#E8F5EC] dark:bg-[#173822] text-[#228B4E] dark:text-[#34D399] flex items-center justify-center group-hover:bg-[#d2ecd9] dark:group-hover:bg-[#1E4A2E] transition-colors">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Monthly Report</span>
                <span className="text-[11px] text-muted-foreground font-medium">Summary</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Action 5: Corrections */}
        <Link href="/staff/corrections">
          <div className="p-4 bg-card rounded-[20px] border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#FEF7E8] dark:bg-[#2F2415] text-[#D99A28] dark:text-[#FBBF24] flex items-center justify-center group-hover:bg-[#faeccb] dark:group-hover:bg-[#43321C] transition-colors">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Corrections</span>
                <span className="text-[11px] text-muted-foreground font-medium">{correctionsRequired.length} pending</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Action 6: My Profile */}
        <Link href="/staff/profile">
          <div className="p-4 bg-card rounded-[20px] border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center group-hover:bg-[#E8F5EC] dark:group-hover:bg-[#173822] group-hover:text-primary transition-colors">
                <User className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">My Profile</span>
                <span className="text-[11px] text-muted-foreground font-medium">{user?.employeeId || 'Settings'}</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
      </div>

      {/* 6. Report Review Modal */}
      {selectedReport && user && (
        <ReportReviewModal
          report={selectedReport}
          open={!!selectedReport}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedReport(null);
              loadStaffData();
            }
          }}
          currentUser={user}
          onRefresh={loadStaffData}
        />
      )}
    </div>
  );
}
