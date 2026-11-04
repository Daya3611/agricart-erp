'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Eye, FileEdit, RotateCcw, Users } from 'lucide-react';
import { DailyReport, FilterParams, Department, Center, UserProfile } from '@/types';
import { FilterToolbar } from '@/components/dashboard/FilterToolbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  RecordCard,
  RecordCardHeader,
  RecordCardTitle,
  RecordCardSubtitle,
  RecordCardContent,
  RecordCardRow,
  RecordCardActions,
} from '@/components/ui/record-card';
import { ReportReviewModal } from '@/components/reports/ReportReviewModal';
import { AdminLiveActivityTracker } from '@/components/reports/AdminLiveActivityTracker';
import { exportReportsToCSV, exportReportsToPDF } from '@/lib/utils/export-utils';
import { getDateRangeFromPreset } from '@/lib/utils/date-utils';

export default function AdminReportsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
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
      const [sessRes, deptRes, centerRes, repRes] = await Promise.all([
        fetch('/api/auth/session'),
        fetch('/api/departments'),
        fetch('/api/centers'),
        fetch('/api/reports'),
      ]);

      if (sessRes.status === 401 || repRes.status === 401) {
        window.location.href = '/login?returnUrl=/admin/reports';
        return;
      }

      const [sessData, deptData, centerData, repData] = await Promise.all([
        sessRes.json(),
        deptRes.json(),
        centerRes.json(),
        repRes.json(),
      ]);

      if (sessData?.authenticated) setUser(sessData.user);
      if (deptData?.departments) setDepartments(deptData.departments);
      if (centerData?.centers) setCenters(centerData.centers);
      if (repData?.reports) setReports(repData.reports);
    } catch (err) {
      console.error('Failed to load reports master database data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredReports = React.useMemo(() => {
    return reports.filter((r) => {
      // 1. Date Range / Preset Filter
      if (filters.datePreset && filters.datePreset !== 'all') {
        const { startDate, endDate } = getDateRangeFromPreset(filters.datePreset);
        if (r.reportDate < startDate || r.reportDate > endDate) {
          return false;
        }
      } else if (filters.startDate || filters.endDate) {
        if (filters.startDate && r.reportDate < filters.startDate) return false;
        if (filters.endDate && r.reportDate > filters.endDate) return false;
      }

      // 2. Department Filter
      if (filters.departmentId && filters.departmentId !== 'all') {
        if (r.departmentId !== filters.departmentId) {
          return false;
        }
      }

      // 3. Center Filter
      if (filters.centerId && filters.centerId !== 'all') {
        if (r.centerId !== filters.centerId) {
          return false;
        }
      }

      // 4. Status Filter
      if (filters.status && filters.status !== 'all') {
        if (r.status !== filters.status) {
          return false;
        }
      }

      // 5. Search Query
      if (filters.searchQuery && filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matchesStaff = r.staffName?.toLowerCase().includes(q);
        const matchesEmpId = r.employeeId?.toLowerCase().includes(q);
        const matchesActivities = r.activities?.toLowerCase().includes(q);
        const matchesDept = r.departmentName?.toLowerCase().includes(q);
        const matchesCenter = r.centerName?.toLowerCase().includes(q);
        const matchesTasks = r.completedTasks?.toLowerCase().includes(q);
        if (!matchesStaff && !matchesEmpId && !matchesActivities && !matchesDept && !matchesCenter && !matchesTasks) {
          return false;
        }
      }

      return true;
    });
  }, [reports, filters]);

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Daily Activity Reports Master Database
          </h1>
          <p className="text-xs text-muted-foreground font-medium">
            Browse, filter, review, approve, and export all staff activity submissions and evidence attachments.
          </p>
        </div>
      </div>

      {/* Live Field Operations Activity Monitor */}
      <AdminLiveActivityTracker
        onSelectReport={(repId) => {
          const r = reports.find((item) => item.id === repId);
          if (r) setSelectedReport(r);
        }}
      />

      <FilterToolbar
        filters={filters}
        onFilterChange={setFilters}
        departments={departments}
        centers={centers}
        onExportCSV={() => exportReportsToCSV(filteredReports)}
        onExportPDF={() => exportReportsToPDF(filteredReports)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-card-foreground">
            Activity Reports ({filteredReports.length})
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Filtered records based on date, department, center, and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading daily activity reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No reports found matching selected filters.</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Center</TableHead>
                      <TableHead>Farmers / Meetings</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold text-foreground whitespace-nowrap">
                          {r.reportDate}
                          {r.isLate && (
                            <span className="ml-1 text-[10px] text-amber-800 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/60">
                              Late
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-bold text-foreground">{r.staffName}</p>
                            <p className="text-[11px] text-muted-foreground">{r.employeeId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground">{r.departmentName}</TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground">{r.centerName}</TableCell>
                        <TableCell className="text-xs font-bold text-primary">
                          {(r as any).isFieldActivity ? (
                            <span>{(r as any).fieldActivitiesCount || 1} activities • {r.farmersVisited || 0} contacts</span>
                          ) : (
                            <span>{r.farmersVisited || 0} farmers | {r.meetingsConducted || 0} meetings</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadges[r.status]?.variant || 'secondary'}>
                            {statusBadges[r.status]?.label || r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedReport(r)}
                            className="rounded-lg px-3.5 text-xs font-bold bg-card hover:bg-muted border-border text-foreground"
                          >
                            {r.status === 'approved' ? (
                              <>
                                <Eye className="h-3.5 w-3.5 mr-1 text-primary" /> View Report
                              </>
                            ) : r.status === 'edit_requested' || r.status === 'correction_requested' ? (
                              <>
                                <FileEdit className="h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400" /> View Request
                              </>
                            ) : r.status === 'resubmitted' ? (
                              <>
                                <RotateCcw className="h-3.5 w-3.5 mr-1 text-purple-600 dark:text-purple-400" /> Review Revision
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
              </div>

              {/* Mobile Record Cards (< 768px) */}
              <div className="md:hidden space-y-3">
                {filteredReports.map((r) => (
                  <RecordCard key={r.id}>
                    <RecordCardHeader>
                      <div className="min-w-0 flex-1">
                        <RecordCardTitle className="truncate">{r.staffName}</RecordCardTitle>
                        <RecordCardSubtitle>
                          {r.employeeId} • {r.departmentName || 'Field Operations'}
                        </RecordCardSubtitle>
                      </div>
                      <Badge
                        variant={statusBadges[r.status]?.variant || 'secondary'}
                        className="text-[10px] shrink-0"
                      >
                        {statusBadges[r.status]?.label || r.status}
                      </Badge>
                    </RecordCardHeader>

                    <RecordCardContent>
                      <RecordCardRow
                        label="Report Date"
                        value={
                          <span className="font-bold text-foreground">
                            {r.reportDate}
                            {r.isLate && (
                              <span className="ml-1.5 text-[10px] text-amber-800 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/60">
                                Late
                              </span>
                            )}
                          </span>
                        }
                      />
                      <RecordCardRow
                        label="Field Metrics"
                        value={
                          <span className="text-primary font-semibold text-xs">
                            {(r as any).isFieldActivity
                              ? `${(r as any).fieldActivitiesCount || 1} activities • ${r.farmersVisited || 0} contacts`
                              : `${r.farmersVisited || 0} farmers • ${r.meetingsConducted || 0} meetings`}
                          </span>
                        }
                      />
                      {r.centerName && (
                        <RecordCardRow label="Center" value={r.centerName} />
                      )}
                      {r.activities && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 bg-muted/40 p-2 rounded border border-border">
                          {r.activities}
                        </p>
                      )}
                    </RecordCardContent>

                    <RecordCardActions>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedReport(r)}
                        className="w-full text-xs font-bold h-10 rounded-lg bg-card hover:bg-muted border-border text-foreground"
                      >
                        {r.status === 'approved' ? (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-1.5 text-primary" /> View Report
                          </>
                        ) : r.status === 'edit_requested' || r.status === 'correction_requested' ? (
                          <>
                            <FileEdit className="h-3.5 w-3.5 mr-1.5 text-amber-600 dark:text-amber-400" /> View Edit Request
                          </>
                        ) : r.status === 'resubmitted' ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-purple-600 dark:text-purple-400" /> Review Revision
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-1.5" /> View / Review Report
                          </>
                        )}
                      </Button>
                    </RecordCardActions>
                  </RecordCard>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
