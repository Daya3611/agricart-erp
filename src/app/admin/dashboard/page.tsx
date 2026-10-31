'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Plus,
  Users,
  Building2,
  Clock,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CalendarOff,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { DashboardStats, DailyReport, FilterParams, Department, Center, UserProfile } from '@/types';
import { VertixWelcomeHeader } from '@/components/dashboard/VertixWelcomeHeader';
import { VertixBalanceCard } from '@/components/dashboard/VertixBalanceCard';
import { VertixStatGrid } from '@/components/dashboard/VertixStatGrid';
import { VertixIncomeChart, ChartDataPoint } from '@/components/dashboard/VertixIncomeChart';
import { VertixRecentActivities } from '@/components/dashboard/VertixRecentActivities';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { Button } from '@/components/ui/button';
import { ReportReviewModal } from '@/components/reports/ReportReviewModal';
import { exportReportsToCSV } from '@/lib/utils/export-utils';

export default function AdminDashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeepAnalytics, setShowDeepAnalytics] = useState(false);

  const [filters, setFilters] = useState<FilterParams>({
    datePreset: 'today',
    departmentId: '',
    centerId: '',
    status: 'all',
    searchQuery: '',
  });

  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Session User
      const sessRes = await fetch('/api/auth/session');
      const sessData = await sessRes.json();
      if (sessData.authenticated) {
        setUser(sessData.user);
      }

      // 2. Departments & Centers
      const deptsRes = await fetch('/api/departments');
      const deptsData = await deptsRes.json();
      if (deptsData.departments) setDepartments(deptsData.departments);

      const centersRes = await fetch('/api/centers');
      const centersData = await centersRes.json();
      if (centersData.centers) setCenters(centersData.centers);

      // 3. Reports
      const queryParams = new URLSearchParams();
      if (filters.departmentId) queryParams.append('departmentId', filters.departmentId);
      if (filters.centerId) queryParams.append('centerId', filters.centerId);
      if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);

      const repRes = await fetch(`/api/reports?${queryParams.toString()}`);
      const repData = await repRes.json();
      if (repData.reports) setReports(repData.reports);

      // 4. Dashboard Stats (Real database calculated metrics)
      const statsRes = await fetch('/api/analytics');
      const statsData = await statsRes.json();
      if (statsData.stats) {
        setStats(statsData.stats);
      }
    } catch (err) {
      console.error('Error loading admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.departmentId, filters.centerId, filters.status]);

  // Map real weekly trends to chart
  const weeklyChartData: ChartDataPoint[] = (stats?.weeklyTrends || []).map((w) => ({
    label: w.date,
    series1: w.submitted,
    series2: w.missing,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Vertix-Style Welcome Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <VertixWelcomeHeader
          user={user}
          subtitle="Administrator • Organization Overview & Operational Compliance"
        />

        {/* Action Buttons: Add Staff & Refresh */}
        <div className="flex items-center gap-2">
          <Link href="/admin/staff">
            <Button
              size="sm"
              className="bg-[#228B4E] hover:bg-[#176638] text-white font-semibold text-xs h-9 px-4 rounded-full shadow-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Staff
            </Button>
          </Link>
          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            className="bg-white hover:bg-[#F4F5F2] border-[#E7EAE5] text-[#252923] font-semibold text-xs h-9 px-3.5 rounded-full shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Vertix 3-Column / Asymmetric Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Column 1: Field Operations Overview & Daily Submission Compliance */}
        <div className="lg:col-span-4 w-full">
          <VertixBalanceCard
            role="admin"
            user={user}
            stats={stats}
            departments={departments}
            centers={centers}
            reports={reports}
            onExport={() => exportReportsToCSV(reports)}
          />
        </div>

        {/* Column 2: 2x2 Metric Cards (Total Employees, Reports Awaiting Review, Corrections Pending, Approved Reports) */}
        <div className="lg:col-span-4 w-full">
          <VertixStatGrid role="admin" stats={stats} />
        </div>

        {/* Column 3: Submission Activity Dual-Bar Chart */}
        <div className="lg:col-span-4 w-full">
          <VertixIncomeChart
            title="Submission Activity"
            subtitle="Weekly report submissions vs missing reports"
            legendSeries1="Submitted"
            legendSeries2="Missing"
            data={weeklyChartData}
            loading={loading}
          />
        </div>
      </div>

      {/* 3. Bottom Row: Recent Activities Data Table */}
      <VertixRecentActivities
        reports={reports}
        loading={loading}
        onSelectReport={(report) => setSelectedReport(report)}
      />

      {/* 4. Relevant Admin Operations: 6 Action Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Action 1: Manage Employees */}
        <Link href="/admin/staff">
          <div className="p-4 bg-card rounded-full border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary-light text-primary flex items-center justify-center group-hover:bg-[#d2ecd9] dark:group-hover:bg-[#1f3d2a] transition-colors">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Manage Employees</span>
                <span className="text-[11px] text-muted-foreground font-medium">{stats?.totalActiveStaff ?? 0} active</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Action 2: Review Reports */}
        <Link href="/admin/pending-reviews">
          <div className="p-4 bg-card rounded-full border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#EEF4FF] dark:bg-[#172554]/40 text-[#1D60C9] dark:text-[#60a5fa] flex items-center justify-center group-hover:bg-[#dce9fc] dark:group-hover:bg-[#1e3a8a]/50 transition-colors">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Review Reports</span>
                <span className="text-[11px] text-muted-foreground font-medium">{stats?.awaitingApprovalCount ?? 0} to review</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Action 3: Manage Departments and Centers */}
        <Link href="/admin/departments">
          <div className="p-4 bg-card rounded-full border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#F5F0FF] dark:bg-[#3b0764]/40 text-[#6B21A8] dark:text-[#c084fc] flex items-center justify-center group-hover:bg-[#ece2fc] dark:group-hover:bg-[#581c87]/50 transition-colors">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Departments &amp; Centers</span>
                <span className="text-[11px] text-muted-foreground font-medium">{departments.length} Depts • {centers.length} Hubs</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Action 4: Manage Leaves */}
        <Link href="/admin/leaves">
          <div className="p-4 bg-card rounded-full border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#FEF7E8] dark:bg-[#451a03]/40 text-[#D99A28] dark:text-[#fbbf24] flex items-center justify-center group-hover:bg-[#faeccb] dark:group-hover:bg-[#78350f]/50 transition-colors">
                <CalendarOff className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Manage Leaves</span>
                <span className="text-[11px] text-muted-foreground font-medium">{stats?.onLeaveToday ?? 0} on leave</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Action 5: Monthly Reports */}
        <Link href="/admin/reports/monthly">
          <div className="p-4 bg-card rounded-full border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary-light text-primary flex items-center justify-center group-hover:bg-[#d2ecd9] dark:group-hover:bg-[#1f3d2a] transition-colors">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Monthly Reports</span>
                <span className="text-[11px] text-muted-foreground font-medium">Audit &amp; Archive</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* Action 6: Analytics */}
        <Link href="/admin/analytics">
          <div className="p-4 bg-card rounded-full border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted text-foreground flex items-center justify-center group-hover:bg-primary-light transition-colors">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Analytics</span>
                <span className="text-[11px] text-muted-foreground font-medium">Full Insights</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
      </div>

      {/* 5. Deep Breakdown & Department Compliance Analytics (Collapsible Drawer) */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowDeepAnalytics(!showDeepAnalytics)}
          className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full hover:bg-card border border-transparent hover:border-border transition-all"
        >
          <BarChart3 className="h-4 w-4 text-primary" />
          <span>{showDeepAnalytics ? 'Hide Detailed Department Analytics' : 'Show Detailed Department & Center Completion Rates'}</span>
          {showDeepAnalytics ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showDeepAnalytics && stats && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <AnalyticsCharts stats={stats} />
          </div>
        )}
      </div>

      {/* 6. Report Review Modal */}
      {selectedReport && user && (
        <ReportReviewModal
          report={selectedReport}
          open={!!selectedReport}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedReport(null);
              loadData();
            }
          }}
          currentUser={user}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}
