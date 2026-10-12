'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Building2,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { MonthlyReportSummary, UserProfile } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { exportMonthlyReportToPDF, exportMonthlyReportToDOCX } from '@/lib/utils/monthly-report-export';

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
    try {
      await exportMonthlyReportToPDF(report);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleDownloadDOCX = async () => {
    if (!report) return;
    setExportingDOCX(true);
    try {
      await exportMonthlyReportToDOCX(report);
    } catch (err) {
      console.error('DOCX export failed:', err);
    } finally {
      setExportingDOCX(false);
    }
  };

  const statusBadges: Record<string, { label: string; variant: any }> = {
    Approved: { label: 'Approved', variant: 'default' },
    Submitted: { label: 'Submitted', variant: 'info' },
    'Under Review': { label: 'Under Review', variant: 'info' },
    'Correction Requested': { label: 'Correction', variant: 'destructive' },
    'On Leave': { label: 'On Leave', variant: 'purple' },
    Missing: { label: 'Missing', variant: 'warning' },
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-emerald-600" /> My Monthly Activity & Leave Report
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Review your calendar activity log for the month and export signed official PDF or Word copies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleDownloadPDF}
            disabled={!report || exportingPDF || loading}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
          >
            <Download className={`h-4 w-4 mr-1.5 ${exportingPDF ? 'animate-bounce' : ''}`} />
            {exportingPDF ? 'Generating...' : 'Export PDF'}
          </Button>

          <Button
            variant="outline"
            onClick={handleDownloadDOCX}
            disabled={!report || exportingDOCX || loading}
            className="border-slate-300 text-slate-800 hover:bg-slate-50 font-bold text-xs"
          >
            <FileSpreadsheet className={`h-4 w-4 mr-1.5 text-blue-600 ${exportingDOCX ? 'animate-bounce' : ''}`} />
            {exportingDOCX ? 'Generating...' : 'Export DOCX'}
          </Button>
        </div>
      </div>

      {/* Month & Year Selectors */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Month:</span>
              <Select
                pill
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="w-36 text-xs font-semibold"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Year:</span>
              <Select
                pill
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="w-28 text-xs font-semibold"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </Select>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchMonthlyReport}
            disabled={loading}
            className="text-xs font-bold text-emerald-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </CardContent>
      </Card>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Report Summary */}
      {report && (
        <>
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                {report.monthName} — Performance Record
              </span>
              <h2 className="text-lg font-extrabold text-slate-900">
                {report.employee.fullName} ({report.employee.employeeId})
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5 font-medium">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" /> {report.employee.departmentName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" /> {report.employee.centerName}
                </span>
              </div>
            </div>

            <div className="text-right text-[11px] text-slate-400 font-medium">
              Generated: {new Date(report.generatedAt).toLocaleDateString('en-IN')}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Days</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{report.stats.totalCalendarDays}</span>
            </div>

            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Submitted</span>
              <span className="text-xl font-black text-emerald-800 mt-0.5 block">{report.stats.submittedReportDays}</span>
            </div>

            <div className="p-3.5 bg-emerald-100/70 rounded-2xl border border-emerald-300 text-center">
              <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">Approved</span>
              <span className="text-xl font-black text-emerald-950 mt-0.5 block">{report.stats.approvedReportDays}</span>
            </div>

            <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 text-center">
              <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">On Leave</span>
              <span className="text-xl font-black text-purple-900 mt-0.5 block">{report.stats.approvedLeaveDays}</span>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-center">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Missing</span>
              <span className="text-xl font-black text-amber-900 mt-0.5 block">{report.stats.missingReportDays}</span>
            </div>
          </div>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-900">
                Daily Calendar Record ({report.days.length} Days)
              </CardTitle>
              <CardDescription>
                Activity breakdown and verified approvals for {report.monthName}
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                        {day.date}
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
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadges[day.reportStatus]?.variant || 'secondary'} className="text-[10px]">
                          {statusBadges[day.reportStatus]?.label || day.reportStatus}
                        </Badge>
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
