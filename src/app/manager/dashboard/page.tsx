'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FileText,
  Clock,
  AlertTriangle,
  RefreshCw,
  Building2,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { DashboardStats, DailyReport, UserProfile } from '@/types';
import { VertixWelcomeHeader } from '@/components/dashboard/VertixWelcomeHeader';
import { VertixBalanceCard } from '@/components/dashboard/VertixBalanceCard';
import { VertixStatGrid } from '@/components/dashboard/VertixStatGrid';
import { VertixIncomeChart } from '@/components/dashboard/VertixIncomeChart';
import { VertixRecentActivities } from '@/components/dashboard/VertixRecentActivities';
import { Button } from '@/components/ui/button';
import { ReportReviewModal } from '@/components/reports/ReportReviewModal';

export default function ManagerDashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [teamReports, setTeamReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  const loadManagerData = async () => {
    setLoading(true);
    try {
      const sessRes = await fetch('/api/auth/session');
      const sessData = await sessRes.json();
      if (sessData.authenticated) setUser(sessData.user);

      // Scoped team reports (API automatically restricts manager to their department)
      const repRes = await fetch('/api/reports');
      const repData = await repRes.json();
      if (repData.reports) setTeamReports(repData.reports);

      // Scoped department analytics
      const statsRes = await fetch('/api/analytics');
      const statsData = await statsRes.json();
      if (statsData.stats) setStats(statsData.stats);
    } catch (err) {
      console.error('Failed to load manager dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManagerData();
  }, []);

  const pendingReviews = teamReports.filter(
    (r) => r.status === 'submitted' || r.status === 'under_review' || r.status === 'resubmitted'
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Vertix-Style Welcome Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <VertixWelcomeHeader
          user={user}
          subtitle={`Department Operations & Team Supervision for ${user?.departmentName || 'Field Operations'}`}
        />

        <div className="flex items-center gap-2">
          <Link href="/manager/reports">
            <Button
              size="sm"
              className="bg-[#228B4E] hover:bg-[#176638] text-white font-semibold text-xs h-9 px-4 rounded-full shadow-xs"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Review Queue ({pendingReviews.length})
            </Button>
          </Link>
          <Button
            onClick={loadManagerData}
            variant="outline"
            size="sm"
            className="bg-card hover:bg-muted border-border text-foreground font-semibold text-xs h-9 px-3.5 rounded-full shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Vertix 3-Column / Asymmetric Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Column 1: Department Output & Targets (4 cols) */}
        <div className="lg:col-span-4 w-full">
          <VertixBalanceCard
            role="manager"
            user={user}
            stats={stats}
            reports={teamReports}
          />
        </div>

        {/* Column 2: 2x2 Metric Cards (Highlight Gradient + 3 White) (4 cols) */}
        <div className="lg:col-span-4 w-full">
          <VertixStatGrid role="admin" stats={stats} />
        </div>

        {/* Column 3: Department Reporting Analytics Dual-Bar Chart (4 cols) */}
        <div className="lg:col-span-4 w-full">
          <VertixIncomeChart
            title="Team Activity"
            subtitle="Weekly report submissions vs missing reports"
            legendSeries1="Submitted"
            legendSeries2="Missing"
            data={(stats?.weeklyTrends || []).map((w) => ({
              label: w.date,
              series1: w.submitted,
              series2: w.missing,
            }))}
            loading={loading}
          />
        </div>
      </div>

      {/* 3. Bottom Row: Recent Team Activities Data Table */}
      <VertixRecentActivities
        reports={teamReports}
        loading={loading}
        onSelectReport={(report) => setSelectedReport(report)}
      />

      {/* 4. Manager Quick Action Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Link href="/manager/reports">
          <div className="p-4 bg-card rounded-[20px] border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#EEF4FF] dark:bg-[#17253D] text-[#1D60C9] dark:text-[#60A5FA] flex items-center justify-center group-hover:bg-[#dce9fc] dark:group-hover:bg-[#1E355B] transition-colors">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Pending Reviews</span>
                <span className="text-[11px] text-muted-foreground font-medium">{pendingReviews.length} to inspect</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/manager/staff">
          <div className="p-4 bg-card rounded-[20px] border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#E8F5EC] dark:bg-[#173822] text-[#228B4E] dark:text-[#34D399] flex items-center justify-center group-hover:bg-[#d2ecd9] dark:group-hover:bg-[#1E4A2E] transition-colors">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Assigned Staff</span>
                <span className="text-[11px] text-muted-foreground font-medium">{stats?.totalActiveStaff ?? 0} members</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/manager/leaves">
          <div className="p-4 bg-card rounded-[20px] border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#FEF7E8] dark:bg-[#2F2415] text-[#D99A28] dark:text-[#FBBF24] flex items-center justify-center group-hover:bg-[#faeccb] dark:group-hover:bg-[#43321C] transition-colors">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Team Leaves</span>
                <span className="text-[11px] text-muted-foreground font-medium">{stats?.onLeaveToday ?? 0} on leave</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/admin/reports/monthly">
          <div className="p-4 bg-card rounded-[20px] border border-border hover:border-primary/40 transition-all flex items-center justify-between shadow-2xs group card-saas-hover">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#F5F0FF] dark:bg-[#251838] text-[#6B21A8] dark:text-[#C084FC] flex items-center justify-center group-hover:bg-[#ece2fc] dark:group-hover:bg-[#341F52] transition-colors">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-card-foreground block leading-tight">Monthly Report</span>
                <span className="text-[11px] text-muted-foreground font-medium">Monthly Summary</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
      </div>

      {/* 5. Report Review Modal */}
      {selectedReport && user && (
        <ReportReviewModal
          report={selectedReport}
          open={!!selectedReport}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedReport(null);
              loadManagerData();
            }
          }}
          currentUser={user}
          onRefresh={loadManagerData}
        />
      )}
    </div>
  );
}
