'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sprout, RefreshCw, Eye, ArrowRight, Activity, Plus, Shield, Users, Building2, MapPin, AlertTriangle, Clock, FileEdit, RotateCcw } from 'lucide-react';
import { DashboardStats, DailyReport, FilterParams, Department, Center, UserProfile } from '@/types';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { FilterToolbar } from '@/components/dashboard/FilterToolbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReportReviewModal } from '@/components/reports/ReportReviewModal';
import { exportReportsToCSV, exportReportsToPDF } from '@/lib/utils/export-utils';

export default function AdminDashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);

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

      // 4. Dashboard Stats
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

  const filteredReports = reports.filter((r) => {
    if (!filters.searchQuery) return true;
    const q = filters.searchQuery.toLowerCase();
    return (
      r.staffName.toLowerCase().includes(q) ||
      r.employeeId.toLowerCase().includes(q) ||
      r.activities.toLowerCase().includes(q)
    );
  });

  const statusBadges: Record<string, { label: string; variant: any }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    submitted: { label: 'Submitted', variant: 'info' },
    under_review: { label: 'Under Review', variant: 'info' },
    correction_requested: { label: 'Correction Requested', variant: 'destructive' },
    edit_requested: { label: 'Edit Requested', variant: 'destructive' },
    resubmitted: { label: 'Resubmitted', variant: 'purple' },
    approved: { label: 'Approved', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white p-6 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sprout className="h-6 w-6 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">
              Agricart FPC Ltd • Administrative Center
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            Welcome back, {user?.fullName || 'Administrator'}! 👋
          </h1>
          <p className="text-xs text-emerald-100/90 font-medium max-w-2xl">
            Real-time field staff supervision, daily activity compliance, photo/video verification, and department operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/staff">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-0 shadow-sm">
              <Plus className="h-4 w-4 mr-1" /> Add Staff
            </Button>
          </Link>
          <Button
            onClick={loadData}
            variant="secondary"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Quick Action Navigation Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/admin/pending-reviews">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-sky-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-50 text-sky-700 rounded-full group-hover:bg-sky-100 transition-colors">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Pending Reviews</span>
                <span className="text-[11px] text-slate-500 font-semibold">{stats?.awaitingApprovalCount ?? 0} to review</span>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/admin/missing-reports">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-amber-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 text-amber-700 rounded-full group-hover:bg-amber-100 transition-colors">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Missing Reports</span>
                <span className="text-[11px] text-slate-500 font-semibold">{stats?.missingReportsToday ?? 0} overdue</span>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/admin/staff">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-full group-hover:bg-emerald-100 transition-colors">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Staff Directory</span>
                <span className="text-[11px] text-slate-500 font-semibold">{stats?.totalActiveStaff ?? 0} employees</span>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        <Link href="/admin/reports">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-purple-300 transition-all flex items-center justify-between shadow-2xs group">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-50 text-purple-700 rounded-full group-hover:bg-purple-100 transition-colors">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">All Reports</span>
                <span className="text-[11px] text-slate-500 font-semibold">{reports.length} total</span>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
      </div>

      {/* Real-time Dashboard Statistics */}
      {stats && <StatsGrid stats={stats} />}

      {/* Filter Toolbar */}
      <FilterToolbar
        filters={filters}
        onFilterChange={setFilters}
        departments={departments}
        centers={centers}
        onExportCSV={() => exportReportsToCSV(filteredReports)}
        onExportPDF={() => exportReportsToPDF(filteredReports)}
      />

      {/* Analytics Charts */}
      {stats && <AnalyticsCharts stats={stats} />}

      {/* Recent Staff Reports Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Recent Staff Activity Reports
            </CardTitle>
            <CardDescription>
              Review submitted reports, inspect attached photo/video evidence, and approve or request corrections.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-bold text-slate-700">
            {filteredReports.length} Reports Found
          </Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading daily activity reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No reports found matching selected filters.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Center / Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.slice(0, 10).map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-bold text-slate-900 whitespace-nowrap">
                      {report.reportDate}
                      {report.isLate && (
                        <span className="ml-1 text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded-md">
                          Late
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-bold text-slate-900 leading-tight">{report.staffName}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{report.employeeId}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-700">
                      {report.departmentName}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-700">
                      {report.centerName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadges[report.status]?.variant || 'secondary'}>
                        {statusBadges[report.status]?.label || report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-600">
                      {report.attachments && report.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                          📷 {report.attachments.length} files
                        </span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedReport(report)}
                        className="rounded-full px-3.5 text-xs font-bold border-slate-300 hover:border-emerald-500 hover:text-emerald-700"
                      >
                        {report.status === 'approved' ? (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-1 text-emerald-600" /> View Report
                          </>
                        ) : report.status === 'edit_requested' || report.status === 'correction_requested' ? (
                          <>
                            <FileEdit className="h-3.5 w-3.5 mr-1 text-amber-600" /> View Request
                          </>
                        ) : report.status === 'resubmitted' ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 mr-1 text-purple-600" /> Review Revision
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-1" /> View / Review
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Modal Dialog */}
      {selectedReport && user && (
        <ReportReviewModal
          report={selectedReport}
          open={Boolean(selectedReport)}
          onOpenChange={() => setSelectedReport(null)}
          currentUser={user}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}
