'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  CalendarOff,
  AlertCircle,
  FileText,
  MapPin,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Users,
} from 'lucide-react';
import { MonthlyReportSummary, MonthlyReportsDataset, EmployeeDailyRecordItem, EmployeeDailyActivityDetail } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatReadableDate, getOperationalYearMonth } from '@/lib/utils/date-utils';

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
  const { year: defaultYear, month: defaultMonth } = getOperationalYearMonth();
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth);
  const [report, setReport] = useState<MonthlyReportSummary | null>(null);
  const [dataset, setDataset] = useState<MonthlyReportsDataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Expanded dates state for inspecting individual activity slots
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const toggleExpandDate = (dateStr: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const fetchMonthlyReport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/reports/monthly?year=${selectedYear}&month=${selectedMonth}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate monthly report.');
      }
      setReport(data.report);
      setDataset(data.dataset);
    } catch (err: any) {
      setErrorMsg(err.message);
      setReport(null);
      setDataset(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyReport();
  }, [selectedYear, selectedMonth]);

  const handleDownloadPDF = async () => {
    if (!report && !dataset) return;
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
      const empId = report?.employee.employeeId || dataset?.employeeSummaries[0]?.employeeId || 'STAFF';
      const cleanEmpId = empId.replace(/[^a-zA-Z0-9_-]/g, '_');
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

  const handleDownloadExcel = async () => {
    setExportingExcel(true);
    setErrorMsg(null);
    try {
      const url = `/api/reports/monthly/excel?year=${selectedYear}&month=${selectedMonth}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Server responded with status ${res.status}`);
      }
      const blob = await res.blob();
      const filename = `Agricart_Monthly_Activity_Report_${selectedYear}-${String(selectedMonth).padStart(2, '0')}.xlsx`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('Excel export failed:', err);
      setErrorMsg(`Excel export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setExportingExcel(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('approved')) {
      return (
        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px]">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
        </Badge>
      );
    }
    if (s.includes('correction') || s.includes('rejected')) {
      return (
        <Badge className="bg-rose-50 text-rose-800 border-rose-200 font-bold text-[10px]">
          <AlertTriangle className="h-3 w-3 mr-1" /> Correction Required
        </Badge>
      );
    }
    if (s.includes('leave')) {
      return (
        <Badge className="bg-purple-50 text-purple-800 border-purple-200 font-bold text-[10px]">
          <CalendarOff className="h-3 w-3 mr-1" /> On Leave
        </Badge>
      );
    }
    if (s.includes('holiday')) {
      return (
        <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200 font-bold text-[10px]">
          <Calendar className="h-3 w-3 mr-1" /> Holiday
        </Badge>
      );
    }
    if (s.includes('weekly') || s.includes('off')) {
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-bold text-[10px]">
          Weekly Off
        </Badge>
      );
    }
    if (s.includes('activities recorded') || s.includes('completed')) {
      return (
        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px]">
          <CheckCircle2 className="h-3 w-3 mr-1" /> {status}
        </Badge>
      );
    }
    if (s.includes('present')) {
      return (
        <Badge className="bg-blue-50 text-blue-800 border-blue-200 font-bold text-[10px]">
          <Clock className="h-3 w-3 mr-1" /> Present
        </Badge>
      );
    }
    if (s.includes('upcoming')) {
      return (
        <Badge className="bg-slate-100 text-slate-600 border-slate-200 font-bold text-[10px]">
          Upcoming
        </Badge>
      );
    }
    if (s.includes('in progress')) {
      return (
        <Badge className="bg-blue-50 text-blue-800 border-blue-200 font-bold text-[10px]">
          <Clock className="h-3 w-3 mr-1" /> In Progress
        </Badge>
      );
    }
    if (s.includes('submitted') || s.includes('review')) {
      return (
        <Badge className="bg-sky-50 text-sky-800 border-sky-200 font-bold text-[10px]">
          <Clock className="h-3 w-3 mr-1" /> Pending Review
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-50 text-amber-800 border-amber-200 font-bold text-[10px]">
        <AlertCircle className="h-3 w-3 mr-1" /> Missing Attendance
      </Badge>
    );
  };

  const dailyRecords: EmployeeDailyRecordItem[] = dataset?.dailyRecords || [];
  const empSummary = dataset?.employeeSummaries?.[0];
  const stats = report?.stats;

  return (
    <div className="space-y-5">
      {/* 1. Header & Actions (Excel + PDF only, DOCX removed per spec) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              My Monthly Activity & Leave Report
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
            Calendar breakdown from real Field Activity records with verified device GPS timestamps.
          </p>
        </div>

        {/* Action Buttons: Export Excel (.xlsx) and Export PDF */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Button
            onClick={handleDownloadExcel}
            disabled={dailyRecords.length === 0 || exportingExcel || loading}
            variant="outline"
            className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold text-xs h-9 min-h-[38px] rounded-full shadow-2xs"
          >
            <FileSpreadsheet className={`h-4 w-4 mr-1.5 text-emerald-600 ${exportingExcel ? 'animate-bounce' : ''}`} />
            {exportingExcel ? 'Generating Workbook...' : 'Export Excel (.xlsx)'}
          </Button>

          <Button
            onClick={handleDownloadPDF}
            disabled={dailyRecords.length === 0 || exportingPDF || loading}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9 min-h-[38px] rounded-full shadow-2xs"
          >
            <Download className={`h-4 w-4 mr-1.5 ${exportingPDF ? 'animate-bounce' : ''}`} />
            {exportingPDF ? 'Generating...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {/* 2. Period Selector */}
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

          <div className="grid grid-cols-2 gap-2.5 max-w-sm">
            <div>
              <label htmlFor="select-month" className="block text-[11px] font-bold text-slate-600 mb-1">
                Month
              </label>
              <select
                id="select-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="select-year" className="block text-[11px] font-bold text-slate-600 mb-1">
                Year
              </label>
              <select
                id="select-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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

      {/* 3. Monthly Reporting Statistics from New Field Activity Records */}
      {empSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Calendar Days</span>
            <span className="text-xl font-black text-slate-900 leading-tight">{empSummary.totalCalendarDays ?? 30}</span>
          </div>

          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Days Attended</span>
            <span className="text-xl font-black text-emerald-800 leading-tight">{empSummary.daysAttended ?? empSummary.presentDays ?? 0}</span>
            {empSummary.attendancePercentage !== null && empSummary.attendancePercentage !== undefined && (
              <span className="text-[10px] text-emerald-700 font-bold block">({empSummary.attendancePercentage}%)</span>
            )}
          </div>

          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Activity Days</span>
            <span className="text-xl font-black text-blue-900 leading-tight">{empSummary.daysWithActivities ?? empSummary.totalDaysWorked ?? 0}</span>
          </div>

          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Total Activities</span>
            <span className="text-xl font-black text-emerald-900 leading-tight">{empSummary.totalActivities}</span>
            <span className="text-[10px] text-slate-500 block">({empSummary.totalActivityHours}h active)</span>
          </div>

          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">Working Hours</span>
            <span className="text-xl font-black text-slate-900 leading-tight">{empSummary.totalWorkingHours}h</span>
          </div>

          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Farmer Contacts</span>
            <span className="text-xl font-black text-purple-900 leading-tight">{empSummary.totalFarmerContacts}</span>
            <span className="text-[10px] text-slate-500 block">(M:{empSummary.totalMaleParticipants} F:{empSummary.totalFemaleParticipants})</span>
          </div>

          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Missing Days</span>
            <span className="text-xl font-black text-amber-900 leading-tight">{empSummary.missingAttendanceDays ?? empSummary.daysReportMissing ?? 0}</span>
          </div>
        </div>
      )}

      {/* 4. Complete Calendar Daily Records with Expandable Activities */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Daily Activity & Attendance Log ({dailyRecords.length} Days)
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {dataset?.monthName || report?.monthName}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-x-auto">
          <Table className="min-w-[1700px] text-xs">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-24 whitespace-nowrap font-bold">Date</TableHead>
                <TableHead className="w-14 whitespace-nowrap font-bold">Day</TableHead>
                <TableHead className="w-28 whitespace-nowrap font-bold">Attendance Status</TableHead>
                <TableHead className="w-20 whitespace-nowrap font-bold">Login Time</TableHead>
                <TableHead className="w-20 whitespace-nowrap font-bold">Logout Time</TableHead>
                <TableHead className="w-36 whitespace-nowrap font-bold">Login Location</TableHead>
                <TableHead className="w-36 whitespace-nowrap font-bold">Logout Location</TableHead>
                <TableHead className="w-16 text-center font-bold">Acts</TableHead>
                <TableHead className="w-72 whitespace-nowrap font-bold">Activity Names & Summary</TableHead>
                <TableHead className="w-24 text-right font-bold">Duration</TableHead>
                <TableHead className="w-24 text-right font-bold">Work Period</TableHead>
                <TableHead className="w-20 text-center font-bold">Participants</TableHead>
                <TableHead className="w-24 whitespace-nowrap font-bold">Leave Status</TableHead>
                <TableHead className="w-28 whitespace-nowrap font-bold">Completion</TableHead>
                <TableHead className="w-32 whitespace-nowrap font-bold">Review Status</TableHead>
                <TableHead className="w-40 whitespace-nowrap font-bold">Reviewer Remarks</TableHead>
                <TableHead className="w-20 text-center font-bold">PDF</TableHead>
                <TableHead className="w-24 text-center font-bold">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyRecords.map((day) => {
                const isOff = day.isWeeklyOff || day.isHoliday;
                const isUpcoming = day.attendanceStatus === 'Upcoming' || day.reportStatus === 'Upcoming';
                const isMissing = !isUpcoming && day.isMissing;
                const isExpanded = expandedDates.has(day.date);
                const hasActivities = Array.isArray(day.activitiesList) && day.activitiesList.length > 0;

                return (
                  <React.Fragment key={day.date}>
                    <TableRow
                      className={
                        isOff
                          ? 'bg-slate-50/60 text-slate-500'
                          : isUpcoming
                            ? 'bg-slate-50/40 text-slate-500'
                            : isMissing
                              ? 'bg-rose-50/30'
                              : undefined
                      }
                    >
                      {/* 1. Date */}
                      <TableCell className="font-bold text-slate-900 whitespace-nowrap">
                        {formatReadableDate(day.date)}
                      </TableCell>

                      {/* 2. Day */}
                      <TableCell className="font-semibold text-slate-500">
                        {day.dayOfWeek}
                      </TableCell>

                      {/* 3. Attendance Status */}
                      <TableCell>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            day.attendanceStatus === 'Present'
                              ? 'bg-emerald-100 text-emerald-800'
                              : day.attendanceStatus === 'In Progress' || day.attendanceStatus === 'Active'
                                ? 'bg-blue-100 text-blue-800'
                                : day.attendanceStatus === 'Absent'
                                  ? 'bg-rose-100 text-rose-800'
                                  : day.attendanceStatus === 'On Leave'
                                    ? 'bg-purple-100 text-purple-800'
                                    : day.attendanceStatus === 'Holiday'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {day.attendanceStatus || '—'}
                        </span>
                      </TableCell>

                      {/* 4. Login Time */}
                      <TableCell className="font-mono text-[11px] text-slate-700">
                        {day.attendanceLogin}
                      </TableCell>

                      {/* 5. Logout Time */}
                      <TableCell className="font-mono text-[11px] text-slate-700">
                        {day.attendanceLogout}
                      </TableCell>

                      {/* Login Location Name */}
                      <TableCell className="text-slate-600 max-w-xs truncate" title={day.loginLocationName || day.loginLocation}>
                        {day.loginLocationName || 'Location unavailable'}
                      </TableCell>

                      {/* Logout Location Name */}
                      <TableCell className="text-slate-600 max-w-xs truncate" title={day.logoutLocationName || day.logoutLocation}>
                        {day.logoutLocationName || 'Location unavailable'}
                      </TableCell>

                      {/* Number of Activities */}
                      <TableCell className="text-center font-bold text-slate-900">
                        {day.activitiesCount}
                      </TableCell>

                      {/* Activity Names / Summary */}
                      <TableCell className="text-slate-800 max-w-xs truncate" title={day.activitySummary}>
                        <span className={isMissing ? 'italic text-slate-400' : 'font-medium'}>
                          {day.activitySummary}
                        </span>
                      </TableCell>

                      {/* Activity Duration */}
                      <TableCell className="text-right text-slate-700 font-mono">
                        {day.totalActivityDurationFormatted || `${day.totalActivityDurationMinutes}m`}
                      </TableCell>

                      {/* Working Period */}
                      <TableCell className="text-right text-slate-700 font-mono">
                        {day.workingPeriodFormatted || '—'}
                      </TableCell>

                      {/* Participant Count */}
                      <TableCell className="text-center font-bold text-slate-900">
                        {day.participantContacts}
                        {day.participantContacts > 0 && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            (M:{day.maleParticipants} F:{day.femaleParticipants})
                          </span>
                        )}
                      </TableCell>

                      {/* Leave Status */}
                      <TableCell className="whitespace-nowrap">
                        {day.leaveStatus !== 'None' ? (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            {day.leaveStatus}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>

                      {/* Completion / Report Status */}
                      <TableCell className="whitespace-nowrap">
                        {getStatusBadge(day.reportStatus)}
                      </TableCell>

                      {/* Review Status */}
                      <TableCell className="text-slate-700 whitespace-nowrap">
                        {day.reviewStatus}
                      </TableCell>

                      {/* Reviewer Remarks */}
                      <TableCell className="text-slate-600 max-w-xs truncate" title={day.reviewRemarks}>
                        {day.reviewRemarks || '—'}
                      </TableCell>

                      {/* Individual Daily PDF Link */}
                      <TableCell className="text-center">
                        {day.reportId ? (
                          <a
                            href={`/api/field-reports/${day.reportId}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                            title="Download Daily PDF"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>

                      {/* Expandable Activities Toggle */}
                      <TableCell className="text-center">
                        {hasActivities ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleExpandDate(day.date)}
                            className="h-7 px-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50"
                          >
                            {isExpanded ? (
                              <span className="flex items-center gap-1">
                                Hide <ChevronUp className="h-3 w-3" />
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                {day.activitiesList!.length} Acts <ChevronDown className="h-3 w-3" />
                              </span>
                            )}
                          </Button>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expandable Detail Section for Multiple Activities */}
                    {isExpanded && hasActivities && (
                      <TableRow className="bg-emerald-50/30 border-b border-emerald-100">
                        <TableCell colSpan={18} className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-emerald-600" />
                                Recorded Field Activities for {formatReadableDate(day.date)} ({day.activitiesList!.length} Slots)
                              </h4>
                              <span className="text-[11px] text-slate-500 font-medium">
                                Total Activity Duration: {day.totalActivityDurationFormatted}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {day.activitiesList!.map((act, aIdx) => (
                                <div
                                  key={aIdx}
                                  className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs space-y-1.5 text-xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <span className="font-bold text-slate-900 text-xs">
                                        Slot {act.slotNumber}: {act.activityNameLabel}
                                      </span>
                                      <span className="block text-[10px] text-emerald-700 font-semibold">
                                        {act.activityType} • {act.village} {act.wadi ? `(${act.wadi})` : ''}
                                      </span>
                                    </div>
                                    <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                      {act.durationMinutes}m
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-0.5">
                                    <span>Time: {act.startTime} - {act.endTime}</span>
                                    <span className="font-semibold text-slate-700">
                                      Contacts: {act.participants} (M:{act.maleParticipants} F:{act.femaleParticipants})
                                    </span>
                                  </div>

                                  {act.farmerName && act.farmerName !== '—' && (
                                    <p className="text-[11px] text-slate-600">
                                      <strong className="text-slate-800">Farmer:</strong> {act.farmerName}
                                    </p>
                                  )}

                                  <div className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg">
                                    <p className="font-medium">
                                      <strong>Obs:</strong> {act.observations}
                                    </p>
                                    {act.issues && act.issues !== '—' && (
                                      <p className="text-amber-800 mt-1">
                                        <strong>Issues:</strong> {act.issues}
                                      </p>
                                    )}
                                  </div>

                                  <div className="text-[10px] text-slate-500 space-y-0.5 pt-1">
                                    <p>
                                      <strong className="text-slate-600">Start Location:</strong> {act.startLocationName}
                                    </p>
                                    <p>
                                      <strong className="text-slate-600">End Location:</strong> {act.endLocationName}
                                    </p>
                                  </div>

                                  {act.photoUrls && act.photoUrls.length > 0 && (
                                    <div className="pt-1 flex items-center gap-1.5">
                                      <ImageIcon className="h-3 w-3 text-emerald-600" />
                                      <span className="text-[10px] font-bold text-emerald-800">
                                        {act.photoUrls.length} Photo Evidence Attached
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
