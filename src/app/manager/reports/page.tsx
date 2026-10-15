'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Eye, CheckCircle2, Clock, AlertTriangle, FileEdit, RotateCcw } from 'lucide-react';
import { DailyReport, UserProfile } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ReportReviewModal } from '@/components/reports/ReportReviewModal';
import {
  RecordCard,
  RecordCardHeader,
  RecordCardTitle,
  RecordCardSubtitle,
  RecordCardContent,
  RecordCardRow,
  RecordCardActions,
} from '@/components/ui/record-card';
import { formatReadableDate } from '@/lib/utils/date-utils';
import { exportReportsToCSV, exportReportsToPDF } from '@/lib/utils/export-utils';

export default function ManagerReportsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const sessRes = await fetch('/api/auth/session');
      const sessData = await sessRes.json();
      if (sessData.authenticated) setUser(sessData.user);

      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.reports) setReports(data.reports);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredReports = reports.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      r.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.activities.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
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
            <FileText className="h-6 w-6 text-purple-600" /> Department Activity Reports
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Review and evaluate daily activity submissions from field staff in your assigned department.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportReportsToCSV(filteredReports)}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReportsToPDF(filteredReports)}>
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <Input
              type="text"
              pill
              placeholder="Search staff, ID, activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 text-xs"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-full border border-slate-200/90 bg-white px-4 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-auto"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted (Awaiting Review)</option>
              <option value="under_review">Under Review</option>
              <option value="resubmitted">Resubmitted Revision</option>
              <option value="approved">Approved</option>
              <option value="edit_requested">Edit Requested</option>
              <option value="correction_requested">Correction Requested</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <Badge variant="outline" className="text-xs font-bold self-start sm:self-auto">
            {filteredReports.length} Reports Found
          </Badge>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">Submitted Reports</CardTitle>
          <CardDescription>Click Review to evaluate activities and attachments</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading department reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No reports found matching criteria.</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Work Location</TableHead>
                      <TableHead>Farmers / Meetings</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold text-slate-900 whitespace-nowrap">
                          {formatReadableDate(r.reportDate)}
                          {r.isLate && <Badge variant="warning" className="ml-1 text-[10px]">Late</Badge>}
                        </TableCell>
                        <TableCell>
                          <p className="font-bold text-slate-900">{r.staffName}</p>
                          <p className="text-[11px] text-slate-500">{r.employeeId}</p>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">{r.workLocation}</TableCell>
                        <TableCell className="text-xs font-bold text-emerald-800">
                          {r.farmersVisited || 0} farmers | {r.meetingsConducted || 0} meetings
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-700">
                          {r.attachments?.length || 0} Files
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
                                <Eye className="h-3.5 w-3.5 mr-1 text-slate-700" /> Review
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
                          {r.employeeId} • {formatReadableDate(r.reportDate)}
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
                        label="Location"
                        value={r.workLocation || 'Field'}
                      />
                      <RecordCardRow
                        label="Outreach"
                        value={
                          <span className="text-emerald-800 font-semibold text-xs">
                            {r.farmersVisited || 0} farmers • {r.meetingsConducted || 0} meetings
                          </span>
                        }
                      />
                      <RecordCardRow
                        label="Attachments"
                        value={
                          <span className="text-slate-700 text-xs font-medium">
                            {r.attachments?.length || 0} files
                          </span>
                        }
                      />
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
                            <Eye className="h-3.5 w-3.5 mr-1.5" /> Review Report
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
