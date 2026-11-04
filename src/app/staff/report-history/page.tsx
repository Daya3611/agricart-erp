'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  History,
  Eye,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileEdit,
  X,
  Paperclip,
  MapPin,
  FileText,
  AlertCircle,
  ArrowRight,
  Calendar,
  RotateCcw,
  Download,
} from 'lucide-react';
import { DailyReport, ReportAttachment } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { formatReadableDate, formatReadableDateTime } from '@/lib/utils/date-utils';

function formatSubmissionTime(isoStr?: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

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

  // Summary counts computed from real reports data
  const pendingCount = reports.filter(
    (r) => r.status === 'submitted' || r.status === 'under_review' || r.status === 'resubmitted'
  ).length;
  const approvedCount = reports.filter((r) => r.status === 'approved').length;
  const actionCount = reports.filter(
    (r) => r.status === 'correction_requested' || r.status === 'edit_requested'
  ).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px] sm:text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
          </Badge>
        );
      case 'submitted':
      case 'under_review':
      case 'resubmitted':
        return (
          <Badge className="bg-amber-50 text-amber-900 border-amber-200 font-bold text-[10px] sm:text-xs">
            <Clock className="h-3 w-3 mr-1" /> {status === 'resubmitted' ? 'Resubmitted' : 'Awaiting Review'}
          </Badge>
        );
      case 'correction_requested':
      case 'edit_requested':
        return (
          <Badge className="bg-rose-50 text-rose-800 border-rose-200 font-bold text-[10px] sm:text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" /> {status === 'edit_requested' ? 'Edit Requested' : 'Correction Required'}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-50 text-red-800 border-red-200 font-bold text-[10px] sm:text-xs">
            <X className="h-3 w-3 mr-1" /> Rejected
          </Badge>
        );
      case 'draft':
      default:
        return (
          <Badge variant="outline" className="text-slate-600 font-bold text-[10px] sm:text-xs">
            Draft
          </Badge>
        );
    }
  };

  const filteredReports = reports.filter((r) => {
    let matchesStatus = true;
    if (statusFilter === 'awaiting') {
      matchesStatus = r.status === 'submitted' || r.status === 'under_review' || r.status === 'resubmitted';
    } else if (statusFilter === 'action') {
      matchesStatus = r.status === 'correction_requested' || r.status === 'edit_requested';
    } else if (statusFilter !== 'all') {
      matchesStatus = r.status === statusFilter;
    }

    const matchesStart = !startDate || r.reportDate >= startDate;
    const matchesEnd = !endDate || r.reportDate <= endDate;
    return matchesStatus && matchesStart && matchesEnd;
  });

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage));
  const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const hasActiveFilters = statusFilter !== 'all' || startDate !== '' || endDate !== '';

  const clearAllFilters = () => {
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-5">
      {/* 1. Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            My Activity Report History
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
          Review submitted activity logs, check approval status, and inspect field inspection evidence.
        </p>
      </div>

      {/* 2. Top Meta Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Reports</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{reports.length}</span>
          </div>
          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <FileText className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Pending</span>
            <span className="text-xl sm:text-2xl font-black text-amber-900 leading-tight">{pendingCount}</span>
          </div>
          <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Approved</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-900 leading-tight">{approvedCount}</span>
          </div>
          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Action Needed</span>
            <span className="text-xl sm:text-2xl font-black text-rose-900 leading-tight">{actionCount}</span>
          </div>
          <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-700">
            <AlertCircle className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 3. Filter Panel */}
      <Card className="border border-slate-200/90 shadow-2xs">
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">Filter Reports</span>
              <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {filteredReports.length} of {reports.length}
              </span>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Status Selector */}
            <div>
              <label htmlFor="status-filter" className="block text-[11px] font-bold text-slate-600 mb-1">
                Status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="awaiting">Awaiting Review</option>
                <option value="action">Correction Required</option>
                <option value="rejected">Rejected</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <label htmlFor="from-date" className="block text-[11px] font-bold text-slate-600 mb-1">
                From Date
              </label>
              <Input
                id="from-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            {/* To Date */}
            <div>
              <label htmlFor="to-date" className="block text-[11px] font-bold text-slate-600 mb-1">
                To Date
              </label>
              <Input
                id="to-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                  Status: <span className="capitalize font-bold">{statusFilter.replace('_', ' ')}</span>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className="text-slate-400 hover:text-slate-700 ml-0.5"
                    aria-label="Remove status filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {startDate && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                  From: {formatReadableDate(startDate)}
                  <button
                    type="button"
                    onClick={() => setStartDate('')}
                    className="text-slate-400 hover:text-slate-700 ml-0.5"
                    aria-label="Remove start date filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {endDate && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                  To: {formatReadableDate(endDate)}
                  <button
                    type="button"
                    onClick={() => setEndDate('')}
                    className="text-slate-400 hover:text-slate-700 ml-0.5"
                    aria-label="Remove end date filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Submission History */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Reports History
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        {loading ? (
          <div className="bg-white p-8 text-center rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <Clock className="h-6 w-6 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading report history...</p>
          </div>
        ) : paginatedReports.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <FileText className="h-8 w-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Reports Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No activity logs match your filter criteria. Try clearing or expanding your date range.
            </p>
            {hasActiveFilters && (
              <Button size="sm" variant="outline" onClick={clearAllFilters} className="mt-2 text-xs font-bold">
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report Date</TableHead>
                    <TableHead>Work Location</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Supervisor Notes</TableHead>
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
                      <TableCell className="text-xs font-medium text-slate-700 max-w-[200px] truncate">
                        {r.workLocation || '—'}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-emerald-800 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="h-3.5 w-3.5" /> {r.attachments?.length || 0} Files
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-500 whitespace-nowrap">
                        {formatReadableDateTime(r.submittedAt)}
                      </TableCell>
                      <TableCell className="text-xs italic text-slate-600 max-w-xs truncate">
                        {r.reviewComments || r.editRequest?.reason || '—'}
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

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`/api/field-reports/${r.id}/pdf`, '_blank')}
                          className="text-xs font-bold h-9 rounded-lg text-primary hover:bg-primary/10"
                          title="Download Daily PDF"
                        >
                          PDF
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

            {/* Mobile Cards List (< 768px) */}
            <div className="md:hidden space-y-3">
              {paginatedReports.map((r) => {
                const subTime = formatSubmissionTime(r.submittedAt);
                const hasEvidence = r.attachments && r.attachments.length > 0;
                const activityHeadline = r.activities ? r.activities.split('\n')[0].substring(0, 90) : 'Daily Field Inspection Log';
                const isActionNeeded = r.status === 'correction_requested' || r.status === 'edit_requested' || r.status === 'draft';

                return (
                  <article
                    key={r.id}
                    className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col gap-3"
                  >
                    {/* Top Row: Date, Submission Time & Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-slate-900">
                            {formatReadableDate(r.reportDate)}
                          </span>
                          {r.isLate && (
                            <Badge variant="warning" className="text-[9px] uppercase font-bold py-0 px-1.5">
                              Late
                            </Badge>
                          )}
                        </div>
                        {subTime && (
                          <p className="text-xs text-slate-500 font-medium">Submitted at {subTime}</p>
                        )}
                      </div>
                      <div className="shrink-0">{getStatusBadge(r.status)}</div>
                    </div>

                    {/* Activity Headline & Work Location */}
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-xs sm:text-sm text-slate-900 leading-snug">
                        {activityHeadline}
                      </h3>
                      <div className="flex items-start gap-1.5 text-xs text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-snug break-words">
                          {r.workLocation || 'Location not specified'}
                        </span>
                      </div>
                    </div>

                    {/* Evidence / Attachments Indicator */}
                    <div>
                      {hasEvidence ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                          <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                          <span>{r.attachments!.length} {r.attachments!.length === 1 ? 'Evidence File' : 'Evidence Files'} Attached</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 italic">
                          <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                          <span>No attachments provided</span>
                        </span>
                      )}
                    </div>

                    {/* Supervisor / Reviewer Feedback Callout */}
                    {r.status === 'approved' && (r.reviewComments || r.reviewerName) && (
                      <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 flex items-start gap-2.5 text-xs">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <span className="font-bold text-emerald-900 block mb-0.5">
                            Reviewed by {r.reviewerName || 'Supervisor'}
                          </span>
                          <p className="text-slate-700 italic">
                            "{r.reviewComments || 'Approved without additional notes.'}"
                          </p>
                        </div>
                      </div>
                    )}

                    {(r.status === 'correction_requested' || r.status === 'edit_requested') &&
                      (r.editRequest?.reason || r.reviewComments) && (
                        <div className="bg-rose-50/80 border border-rose-200/90 rounded-xl p-3 flex items-start gap-2.5 text-xs">
                          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                          <div className="space-y-1 leading-snug">
                            <span className="font-bold text-rose-950 block">Revision Instructions:</span>
                            <p className="text-rose-900 italic">
                              "{r.editRequest?.reason || r.reviewComments}"
                            </p>
                            {r.editRequest?.instructions && (
                              <p className="text-slate-700 font-medium pt-0.5 border-t border-rose-200/60">
                                Details: {r.editRequest.instructions}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                    {r.status === 'rejected' && r.reviewComments && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 text-xs">
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <span className="font-bold text-red-950 block mb-0.5">Rejected by Supervisor:</span>
                          <p className="text-slate-700 italic">"{r.reviewComments}"</p>
                        </div>
                      </div>
                    )}

                    {/* Card Actions */}
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewingReport(r)}
                        className="text-xs font-bold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                      >
                        <span>View Details</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>

                      {isActionNeeded && (
                        <Link href={`/staff/daily-report?id=${r.id}`}>
                          <Button
                            size="sm"
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9 min-h-[36px] rounded-xl shadow-xs"
                          >
                            <FileEdit className="h-3.5 w-3.5 mr-1" />
                            <span>Update & Resubmit</span>
                          </Button>
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-2xs flex items-center justify-between text-xs mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-9 font-bold"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>

                <span className="text-slate-600 font-semibold">
                  Page <strong className="text-slate-900">{currentPage}</strong> of{' '}
                  <strong className="text-slate-900">{totalPages}</strong>
                </span>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-9 font-bold"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. View Report Detail Dialog */}
      {viewingReport && (
        <Dialog
          open={Boolean(viewingReport)}
          onOpenChange={() => setViewingReport(null)}
          title={`Daily Report - ${formatReadableDate(viewingReport.reportDate)}`}
          description={`Work location: ${viewingReport.workLocation || 'Field'} | Status: ${viewingReport.status.toUpperCase()}${viewingReport.revisionNumber > 1 ? ` (Revision #${viewingReport.revisionNumber})` : ''}`}
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
                <span className="font-bold text-slate-800 block mb-1">
                  Uploaded Evidence Attachments ({viewingReport.attachments.length}):
                </span>
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

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <Button
                type="button"
                size="sm"
                onClick={() => window.open(`/api/field-reports/${viewingReport.id}/pdf`, '_blank')}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9 rounded-xl"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Download Daily PDF (1 Page)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingReport(null)}
                className="text-xs font-bold h-9 rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

