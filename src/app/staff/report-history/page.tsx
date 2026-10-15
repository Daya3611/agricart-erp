'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, Eye, Clock, AlertTriangle, CheckCircle2, Filter, ChevronLeft, ChevronRight, FileEdit, X, Paperclip } from 'lucide-react';
import { DailyReport, ReportAttachment } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { RecordCard, RecordCardHeader, RecordCardTitle, RecordCardSubtitle, RecordCardContent, RecordCardRow, RecordCardActions } from '@/components/ui/record-card';
import { formatReadableDate, formatReadableDateTime } from '@/lib/utils/date-utils';

export default function StaffReportHistoryPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // View Modal
  const [viewingReport, setViewingReport] = useState<DailyReport | null>(null);

  useEffect(() => {
    fetch('/api/reports')
      .then((res) => res.json())
      .then((data) => {
        if (data.reports) setReports(data.reports);
      })
      .finally(() => setLoading(false));
  }, []);

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

  const filteredReports = reports.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesStart = !startDate || r.reportDate >= startDate;
    const matchesEnd = !endDate || r.reportDate <= endDate;
    return matchesStatus && matchesStart && matchesEnd;
  });

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage));
  const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <History className="h-6 w-6 text-emerald-600" /> My Activity Report History
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          View all previously submitted daily activity reports, reviewer comments, and revision logs.
        </p>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="resubmitted">Resubmitted</option>
                <option value="edit_requested">Edit Requested</option>
                <option value="correction_requested">Correction Requested</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-600 shrink-0">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 w-full sm:w-36 text-xs rounded-xl"
              />
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-600 shrink-0">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 w-full sm:w-36 text-xs rounded-xl"
              />
            </div>

            {(statusFilter !== 'all' || startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setStartDate('');
                  setEndDate('');
                  setCurrentPage(1);
                }}
                className="text-xs font-bold text-slate-500"
              >
                Clear Filters
              </Button>
            )}
          </div>

          <Badge variant="outline" className="text-xs font-bold">
            {filteredReports.length} Reports Found
          </Badge>
        </CardContent>
      </Card>

      {/* Reports Table & Mobile Card View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">Submission History</CardTitle>
          <CardDescription>Track status, submission timestamps, and supervisor review notes</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading history...</div>
          ) : paginatedReports.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-50/60 rounded-2xl border border-slate-100">
              No reports found matching your criteria.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table View (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Date</TableHead>
                      <TableHead>Work Location</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead>Reviewer Comments</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedReports.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold text-slate-900 whitespace-nowrap">
                          {formatReadableDate(r.reportDate)}
                          {r.isLate && <Badge variant="warning" className="ml-1 text-[10px]">Late</Badge>}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">{r.workLocation}</TableCell>
                        <TableCell className="text-xs font-bold text-emerald-800">
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3.5 w-3.5" /> {r.attachments?.length || 0} Files
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadges[r.status]?.variant || 'secondary'}>
                            {statusBadges[r.status]?.label || r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-500">
                          {formatReadableDateTime(r.submittedAt)}
                        </TableCell>
                        <TableCell className="text-xs italic text-slate-600 max-w-xs truncate">
                          {r.reviewComments || '—'}
                        </TableCell>
                        <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingReport(r)}
                            className="text-xs font-bold h-9 rounded-lg"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> View Report
                          </Button>

                          {(r.status === 'correction_requested' || r.status === 'edit_requested' || r.status === 'draft') && (
                            <Link href={`/staff/daily-report?id=${r.id}`}>
                              <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold h-9 rounded-lg">
                                <FileEdit className="h-3.5 w-3.5 mr-1" /> Edit & Resubmit
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View (< 768px) */}
              <div className="md:hidden space-y-3">
                {paginatedReports.map((r) => (
                  <RecordCard key={r.id}>
                    <RecordCardHeader>
                      <div className="min-w-0 flex-1">
                        <RecordCardTitle className="flex items-center gap-1.5">
                          <span>{formatReadableDate(r.reportDate)}</span>
                          {r.isLate && <Badge variant="warning" className="text-[9px]">Late</Badge>}
                        </RecordCardTitle>
                        <RecordCardSubtitle>Submitted: {formatReadableDateTime(r.submittedAt)}</RecordCardSubtitle>
                      </div>
                      <Badge variant={statusBadges[r.status]?.variant || 'secondary'} className="text-[10px] shrink-0">
                        {statusBadges[r.status]?.label || r.status}
                      </Badge>
                    </RecordCardHeader>

                    <RecordCardContent>
                      <RecordCardRow label="Work Location" value={r.workLocation} />
                      <RecordCardRow
                        label="Evidence"
                        value={
                          r.attachments && r.attachments.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <Paperclip className="h-3.5 w-3.5" /> {r.attachments.length} files
                            </span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )
                        }
                      />
                      {r.reviewComments && (
                        <div className="p-2.5 bg-slate-50 rounded-lg text-slate-600 italic text-[11px] mt-1">
                          Reviewer: "{r.reviewComments}"
                        </div>
                      )}
                    </RecordCardContent>

                    <RecordCardActions className="flex-col sm:flex-row gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingReport(r)}
                        className="w-full h-10 min-h-[44px] justify-center text-xs font-bold border-slate-300 hover:border-emerald-500 hover:text-emerald-700 rounded-lg"
                      >
                        <Eye className="h-4 w-4 mr-1.5" /> View Report Details
                      </Button>

                      {(r.status === 'correction_requested' || r.status === 'edit_requested' || r.status === 'draft') && (
                        <Link href={`/staff/daily-report?id=${r.id}`} className="w-full">
                          <Button size="sm" className="w-full h-10 min-h-[44px] justify-center bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg">
                            <FileEdit className="h-4 w-4 mr-1.5" /> Edit & Resubmit Report
                          </Button>
                        </Link>
                      )}
                    </RecordCardActions>
                  </RecordCard>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-medium">
                    Showing page <span className="font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Report Detail Dialog */}
      {viewingReport && (
        <Dialog
          open={Boolean(viewingReport)}
          onOpenChange={() => setViewingReport(null)}
          title={`Daily Report - ${formatReadableDate(viewingReport.reportDate)}`}
          description={`Work location: ${viewingReport.workLocation} | Status: ${viewingReport.status.toUpperCase()}${viewingReport.revisionNumber > 1 ? ` (Revision #${viewingReport.revisionNumber})` : ''}`}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto text-xs pr-1">
            {/* Status & Reviewer feedback */}
            {(viewingReport.editRequest?.reason || viewingReport.reviewComments) && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                <span className="font-bold text-amber-900 block mb-0.5">
                  {viewingReport.status === 'edit_requested' ? 'Revision Instructions from Supervisor:' : 'Reviewer Feedback:'}
                </span>
                <p className="text-slate-800 italic">"{viewingReport.editRequest?.reason || viewingReport.reviewComments}"</p>
                {viewingReport.editRequest?.instructions && (
                  <p className="text-amber-950 font-medium pt-1 border-t border-amber-100">
                    <span className="font-bold">Instructions:</span> {viewingReport.editRequest.instructions}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
              <div>
                <span className="text-slate-500 font-medium block">Working Hours:</span>
                <span className="font-bold text-slate-800">{viewingReport.workStartTime || '09:00'} - {viewingReport.workEndTime || '18:00'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Farmers / Meetings:</span>
                <span className="font-bold text-emerald-800">{viewingReport.farmersVisited || 0} farmers | {viewingReport.meetingsConducted || 0} meetings</span>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 block mb-1">Activities Performed:</span>
              <p className="p-3 bg-slate-50 rounded-xl text-slate-700 whitespace-pre-wrap">{viewingReport.activities}</p>
            </div>

            <div>
              <span className="font-bold text-slate-800 block mb-1">Completed Tasks:</span>
              <p className="p-3 bg-slate-50 rounded-xl text-slate-700 whitespace-pre-wrap">{viewingReport.completedTasks}</p>
            </div>

            {viewingReport.achievements && (
              <div>
                <span className="font-bold text-slate-800 block mb-1">Achievements & Results:</span>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-700">{viewingReport.achievements}</p>
              </div>
            )}

            {viewingReport.challenges && (
              <div>
                <span className="font-bold text-amber-900 block mb-1">Challenges Faced:</span>
                <p className="p-3 bg-amber-50 rounded-xl text-slate-700">{viewingReport.challenges}</p>
              </div>
            )}

            {viewingReport.nextDayPlan && (
              <div>
                <span className="font-bold text-slate-800 block mb-1">Next Day Plan:</span>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-700">{viewingReport.nextDayPlan}</p>
              </div>
            )}

            {/* Attachments */}
            {viewingReport.attachments && viewingReport.attachments.length > 0 && (
              <div>
                <span className="font-bold text-slate-800 block mb-1">Uploaded Evidence Attachments ({viewingReport.attachments.length}):</span>
                <div className="grid grid-cols-2 gap-2">
                  {viewingReport.attachments.map((att: ReportAttachment) => (
                    <div key={att.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800 block truncate">{att.originalFilename}</span>
                      {att.caption && <span className="text-[10px] text-emerald-700 italic block">{att.caption}</span>}
                      {att.downloadUrl && (
                        <a href={att.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline font-bold mt-1 inline-block">
                          View Attachment
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
