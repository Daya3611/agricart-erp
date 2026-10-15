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
import { exportReportsToCSV, exportReportsToPDF } from '@/lib/utils/export-utils';

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
      const sessRes = await fetch('/api/auth/session');
      const sessData = await sessRes.json();
      if (sessData.authenticated) setUser(sessData.user);

      const deptRes = await fetch('/api/departments');
      const deptData = await deptRes.json();
      if (deptData.departments) setDepartments(deptData.departments);

      const centerRes = await fetch('/api/centers');
      const centerData = await centerRes.json();
      if (centerData.centers) setCenters(centerData.centers);

      const queryParams = new URLSearchParams();
      if (filters.departmentId) queryParams.append('departmentId', filters.departmentId);
      if (filters.centerId) queryParams.append('centerId', filters.centerId);
      if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);

      const repRes = await fetch(`/api/reports?${queryParams.toString()}`);
      const repData = await repRes.json();
      if (repData.reports) setReports(repData.reports);
    } catch (err) {
      console.error(err);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" /> Daily Activity Reports Master Database
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Browse, filter, review, approve, and export all staff activity submissions and evidence attachments.
          </p>
        </div>
      </div>

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
          <CardTitle className="text-base font-bold text-slate-900">
            Activity Reports ({filteredReports.length})
          </CardTitle>
          <CardDescription>Filtered records based on date, department, center, and status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading daily activity reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No reports found matching selected filters.</div>
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
                        <TableCell className="font-bold text-slate-900 whitespace-nowrap">
                          {r.reportDate}
                          {r.isLate && (
                            <span className="ml-1 text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                              Late
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-bold text-slate-900">{r.staffName}</p>
                            <p className="text-[11px] text-slate-500">{r.employeeId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">{r.departmentName}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">{r.centerName}</TableCell>
                        <TableCell className="text-xs font-bold text-emerald-800">
                          {r.farmersVisited || 0} farmers | {r.meetingsConducted || 0} meetings
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
                            className="rounded-lg px-3.5 text-xs font-bold"
                          >
                            {r.status === 'approved' ? (
                              <>
                                <Eye className="h-3.5 w-3.5 mr-1 text-emerald-600" /> View Report
                              </>
                            ) : r.status === 'edit_requested' || r.status === 'correction_requested' ? (
                              <>
                                <FileEdit className="h-3.5 w-3.5 mr-1 text-amber-600" /> View Request
                              </>
                            ) : r.status === 'resubmitted' ? (
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
                          <span className="font-bold text-slate-900">
                            {r.reportDate}
                            {r.isLate && (
                              <span className="ml-1.5 text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                                Late
                              </span>
                            )}
                          </span>
                        }
                      />
                      <RecordCardRow
                        label="Field Metrics"
                        value={
                          <span className="text-emerald-800 font-semibold text-xs">
                            {r.farmersVisited || 0} farmers • {r.meetingsConducted || 0} meetings
                          </span>
                        }
                      />
                      {r.centerName && (
                        <RecordCardRow label="Center" value={r.centerName} />
                      )}
                      {r.activities && (
                        <p className="text-xs text-slate-600 line-clamp-2 mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                          {r.activities}
                        </p>
                      )}
                    </RecordCardContent>

                    <RecordCardActions>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedReport(r)}
                        className="w-full text-xs font-bold h-10 rounded-lg"
                      >
                        {r.status === 'approved' ? (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> View Report
                          </>
                        ) : r.status === 'edit_requested' || r.status === 'correction_requested' ? (
                          <>
                            <FileEdit className="h-3.5 w-3.5 mr-1.5 text-amber-600" /> View Edit Request
                          </>
                        ) : r.status === 'resubmitted' ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-purple-600" /> Review Revision
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
