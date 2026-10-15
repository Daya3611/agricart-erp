'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Building2,
  MapPin,
  RefreshCw,
  ImageIcon,
  Video,
  CheckCircle2,
  Clock,
  CalendarOff,
  AlertCircle,
  ArrowRight,
  FileText,
  X,
} from 'lucide-react';
import { MonthlyReportSummary, UserProfile } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatReadableDate } from '@/lib/utils/date-utils';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function StaffMonthlyReportPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyReportSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);
  const [exportingDOCX, setExportingDOCX] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMonthlyReport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Backend automatically restricts to authenticated staff user
      const res = await fetch(`/api/reports/monthly?year=${selectedYear}&month=${selectedMonth}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate monthly report.');
      }
      setReport(data.report);
    } catch (err: any) {
      setErrorMsg(err.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyReport();
  }, [selectedYear, selectedMonth]);

  const handleDownloadPDF = async () => {
    if (!report) return;
    setExportingPDF(true);
    setErrorMsg(null);
    try {
      const url = `/api/reports/monthly/pdf?year=${selectedYear}&month=${selectedMonth}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Server responded with status ${res.status}`);
      }
      const blob = await res.blob();
      const cleanEmpId = report.employee.employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Agricart_Monthly_Report_${cleanEmpId}_${selectedYear}-${String(selectedMonth).padStart(2, '0')}.pdf`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('PDF export failed:', err);
      setErrorMsg(`PDF export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleDownloadDOCX = async () => {
    if (!report) return;
    setExportingDOCX(true);
    setErrorMsg(null);
    try {
      const url = `/api/reports/monthly/docx?year=${selectedYear}&month=${selectedMonth}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Server responded with status ${res.status}`);
      }
      const blob = await res.blob();
      const cleanEmpId = report.employee.employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Agricart_Monthly_Report_${cleanEmpId}_${selectedYear}-${String(selectedMonth).padStart(2, '0')}.docx`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('DOCX export failed:', err);
      setErrorMsg(`DOCX export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setExportingDOCX(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
          </Badge>
        );
      case 'Submitted':
      case 'Under Review':
        return (
          <Badge className="bg-sky-50 text-sky-800 border-sky-200 font-bold text-[10px]">
            <Clock className="h-3 w-3 mr-1" /> {status}
          </Badge>
        );
      case 'Correction Requested':
        return (
          <Badge className="bg-rose-50 text-rose-800 border-rose-200 font-bold text-[10px]">
            <AlertTriangle className="h-3 w-3 mr-1" /> Correction
          </Badge>
        );
      case 'On Leave':
        return (
          <Badge className="bg-purple-50 text-purple-800 border-purple-200 font-bold text-[10px]">
            <CalendarOff className="h-3 w-3 mr-1" /> On Leave
          </Badge>
        );
      case 'Missing':
      default:
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-200 font-bold text-[10px]">
            <AlertCircle className="h-3 w-3 mr-1" /> Missing
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              My Monthly Activity & Leave Report
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
            Review your calendar activity log for the month and export signed official PDF or Word copies.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={handleDownloadPDF}
            disabled={!report || exportingPDF || loading}
            className="flex-1 sm:flex-initial bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-10 min-h-[44px] rounded-full shadow-xs"
          >
            <Download className={`h-4 w-4 mr-1.5 ${exportingPDF ? 'animate-bounce' : ''}`} />
            {exportingPDF ? 'Generating...' : 'Export PDF'}
          </Button>

          <Button
            variant="outline"
            onClick={handleDownloadDOCX}
            disabled={!report || exportingDOCX || loading}
            className="flex-1 sm:flex-initial border-slate-300 text-slate-800 hover:bg-slate-50 font-bold text-xs h-10 min-h-[44px] rounded-full"
          >
            <FileSpreadsheet className={`h-4 w-4 mr-1.5 text-blue-600 ${exportingDOCX ? 'animate-bounce' : ''}`} />
            {exportingDOCX ? 'Generating...' : 'Export DOCX'}
          </Button>
        </div>
      </div>

      {/* 2. Period Selector / Filter Panel */}
      <Card className="border border-slate-200/90 shadow-2xs">
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">Select Reporting Period</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={fetchMonthlyReport}
              disabled={loading}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1 h-8"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Month Selector */}
            <div>
              <label htmlFor="select-month" className="block text-[11px] font-bold text-slate-600 mb-1">
                Month
              </label>
              <select
                id="select-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Selector */}
            <div>
              <label htmlFor="select-year" className="block text-[11px] font-bold text-slate-600 mb-1">
                Year
              </label>
              <select
                id="select-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3. Report Performance Summary */}
      {report && (
        <>
          {/* <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                {report.monthName} — Performance Record
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {report.employee.fullName} ({report.employee.employeeId})
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium pt-0.5">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" /> {report.employee.departmentName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" /> {report.employee.centerName}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium sm:text-right shrink-0">
              <span className="text-slate-400 block text-[11px]">Generated</span>
              <span className="font-bold text-slate-700">
                {new Date(report.generatedAt).toLocaleDateString('en-IN')}
              </span>
            </div>
          </div> */}

          {/* 4. Stats Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Days</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{report.stats.totalCalendarDays}</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <FileText className="h-4 w-4" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Submitted</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-800 leading-tight">{report.stats.submittedReportDays}</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                <Clock className="h-4 w-4" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Approved</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-900 leading-tight">{report.stats.approvedReportDays}</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-emerald-100/70 flex items-center justify-center text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">On Leave</span>
                <span className="text-xl sm:text-2xl font-black text-purple-900 leading-tight">{report.stats.approvedLeaveDays}</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-700">
                <CalendarOff className="h-4 w-4" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between col-span-2 sm:col-span-1">
              <div>
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Missing</span>
                <span className="text-xl sm:text-2xl font-black text-amber-900 leading-tight">{report.stats.missingReportDays}</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* 5. Daily Calendar Record */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Daily Calendar Record ({report.days.length} Days)
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {report.monthName}
              </span>
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead className="w-16">Day</TableHead>
                    <TableHead>Daily Activity</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-24">Time</TableHead>
                    <TableHead className="w-40">Review Status</TableHead>
                    <TableHead className="w-44">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.days.map((day) => (
                    <TableRow key={day.date} className={day.hasConflict ? 'bg-amber-50/40' : undefined}>
                      <TableCell className="font-bold text-slate-900 whitespace-nowrap text-xs">
                        {formatReadableDate(day.date)}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-500">
                        {day.dayOfWeek.slice(0, 3)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-800">
                        <span className={day.reportStatus === 'Missing' ? 'italic text-slate-400' : 'font-medium'}>
                          {day.dailyActivity}
                        </span>
                        {day.hasConflict && (
                          <span className="block text-[10px] text-amber-700 font-bold mt-0.5">
                            ⚠️ Overlaps with approved leave
                          </span>
                        )}
                        {day.attachments && day.attachments.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <ImageIcon className="h-3 w-3 inline" /> {day.attachments.filter((a) => !a.mimeType?.startsWith('video/')).length} photos
                              {day.attachments.some((a) => a.mimeType?.startsWith('video/')) && (
                                <span className="ml-1 text-purple-700 inline-flex items-center gap-0.5">
                                  <Video className="h-3 w-3 inline ml-1" /> {day.attachments.filter((a) => a.mimeType?.startsWith('video/')).length} videos
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(day.reportStatus)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-mono">
                        {day.submissionTime}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {day.reviewStatus}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {day.remarks}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Daily Cards List (< 768px) */}
            <div className="md:hidden space-y-2.5">
              {report.days.map((day) => {
                const isMissing = day.reportStatus === 'Missing';
                const isOnLeave = day.reportStatus === 'On Leave';

                return (
                  <article
                    key={day.date}
                    className={`bg-white rounded-2xl border ${day.hasConflict ? 'border-amber-300' : 'border-slate-200/90'} p-3.5 shadow-2xs space-y-2.5`}
                  >
                    {/* Top Row: Date, Day & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {formatReadableDate(day.date)}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          {day.dayOfWeek.slice(0, 3)}
                        </span>
                      </div>
                      <div>{getStatusBadge(day.reportStatus)}</div>
                    </div>

                    {/* Activity Text */}
                    <div className="text-xs leading-relaxed">
                      {isMissing ? (
                        <p className="text-slate-400 italic">No activity report submitted for this day.</p>
                      ) : isOnLeave ? (
                        <p className="text-purple-800 font-medium">On Authorized Leave: {day.dailyActivity || 'Scheduled Leave'}</p>
                      ) : (
                        <p className="text-slate-800 font-medium">{day.dailyActivity}</p>
                      )}

                      {day.hasConflict && (
                        <div className="mt-1.5 p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-[11px] font-bold">
                          ⚠️ Overlaps with approved leave: {day.conflictDetails || 'Conflicting schedule entry'}
                        </div>
                      )}
                    </div>

                    {/* Attachments Pill if any */}
                    {day.attachments && day.attachments.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <ImageIcon className="h-3 w-3" />
                          <span>{day.attachments.filter((a) => !a.mimeType?.startsWith('video/')).length} photos</span>
                          {day.attachments.some((a) => a.mimeType?.startsWith('video/')) && (
                            <span className="ml-1 text-purple-700 inline-flex items-center gap-0.5">
                              <Video className="h-3 w-3" />
                              <span>{day.attachments.filter((a) => a.mimeType?.startsWith('video/')).length} videos</span>
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Metadata Footer: Submission time & Review Status / Remarks */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-medium">
                      <div className="flex items-center gap-2">
                        {day.submissionTime && day.submissionTime !== '—' && (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>{day.submissionTime}</span>
                          </span>
                        )}
                        {day.reviewStatus && day.reviewStatus !== '—' && (
                          <span>• {day.reviewStatus}</span>
                        )}
                      </div>

                      {day.reportId && (
                        <Link href="/staff/report-history">
                          <span className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-0.5">
                            View Log <ArrowRight className="h-3 w-3" />
                          </span>
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

