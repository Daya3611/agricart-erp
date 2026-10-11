'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Eye,
  RefreshCw,
  Building2,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { DashboardStats, DailyReport, UserProfile } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReportReviewModal } from '@/components/reports/ReportReviewModal';
import { formatReadableDate } from '@/lib/utils/date-utils';

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
    (r) => r.status === 'submitted' || r.status === 'under_review'
  );

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white p-6 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-300" />
            <span className="text-xs font-bold uppercase tracking-widest text-purple-200">
              Department Operations Management
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            Welcome, {user?.fullName || 'Department Head'} 👋
          </h1>
          <p className="text-xs text-purple-100/90 font-medium">
            Manage field activities, review daily submissions, verify evidence, and track compliance for {user?.departmentName || 'your department'}.
          </p>
        </div>

        <Button
          onClick={loadManagerData}
          variant="secondary"
          size="sm"
          className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Scoped KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-purple-200">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Assigned Staff</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-purple-800">{stats?.totalActiveStaff ?? 0}</span>
              <span className="text-xs text-slate-500 font-medium">In Department</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-200">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Pending Reviews</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-sky-700">{pendingReviews.length}</span>
              <span className="text-xs text-sky-600 font-bold">Action Needed</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Missing Reports Today</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-700">{stats?.missingReportsToday ?? 0}</span>
              <span className="text-xs text-slate-500 font-medium">Overdue</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Department Rate</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-700">{stats?.dailySubmissionRate ?? 0}%</span>
              <span className="text-xs text-emerald-600 font-bold">Completion</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/manager/reports">
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-purple-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-700 rounded-full group-hover:bg-purple-100 transition-colors">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Team Reports</span>
                <span className="text-[11px] text-slate-500 font-semibold">{teamReports.length} reports logged</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/manager/staff">
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-purple-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-700 rounded-full group-hover:bg-purple-100 transition-colors">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Assigned Staff Directory</span>
                <span className="text-[11px] text-slate-500 font-semibold">{stats?.totalActiveStaff ?? 0} members</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/manager/analytics">
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-purple-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-700 rounded-full group-hover:bg-purple-100 transition-colors">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Department Analytics</span>
                <span className="text-[11px] text-slate-500 font-semibold">Weekly compliance trends</span>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
      </div>

      {/* Pending Reviews Queue Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Department Reports Awaiting Review ({pendingReviews.length})
            </CardTitle>
            <CardDescription>
              Review submissions from your department, inspect photo/video evidence, and approve or request corrections.
            </CardDescription>
          </div>
          <Link href="/manager/reports">
            <Button variant="ghost" size="sm" className="text-xs font-bold text-purple-700">
              View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading pending reviews...</div>
          ) : pendingReviews.length === 0 ? (
            <div className="p-8 text-center text-xs text-emerald-800 font-bold bg-emerald-50 rounded-xl">
              ✅ All clear! There are no pending reviews for your department.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Work Location</TableHead>
                  <TableHead>Farmers / Meetings</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReviews.slice(0, 5).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold text-slate-900">{r.reportDate}</TableCell>
                    <TableCell>
                      <p className="font-bold text-slate-900">{r.staffName}</p>
                      <p className="text-[11px] text-slate-500">{r.employeeId}</p>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-700">{r.workLocation}</TableCell>
                    <TableCell className="text-xs font-bold text-emerald-800">
                      👨‍🌾 {r.farmersVisited || 0} visited | 🤝 {r.meetingsConducted || 0} meetings
                    </TableCell>
                    <TableCell className="text-xs font-bold text-emerald-700">
                      📷 {r.attachments?.length || 0} Files
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => setSelectedReport(r)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      {selectedReport && user && (
        <ReportReviewModal
          report={selectedReport}
          open={Boolean(selectedReport)}
          onOpenChange={() => setSelectedReport(null)}
          currentUser={user}
          onRefresh={loadManagerData}
        />
      )}
    </div>
  );
}
