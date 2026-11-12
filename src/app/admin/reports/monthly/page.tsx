'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Eye,
  User,
  Building2,
  MapPin,
  ChevronRight,
  ExternalLink,
  FileText,
  CalendarOff,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from 'lucide-react';
import {
  MonthlyReportsDataset,
  EmployeeMonthlySummaryItem,
  EmployeeDailyRecordItem,
  UserProfile,
  Department,
  Center,
  DailyReport,
} from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { getGoogleMapsUrl } from '@/lib/utils/geolocation';
import { ReportReviewModal } from '@/components/reports/ReportReviewModal';
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

export default function AdminMonthlyReportPage() {
  const { year: defaultYear, month: defaultMonth } = getOperationalYearMonth();
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth);
  const [selectedEmployeeUid, setSelectedEmployeeUid] = useState<string>('all');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [selectedCenterId, setSelectedCenterId] = useState<string>('all');
  const [selectedReportStatus, setSelectedReportStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [dataset, setDataset] = useState<MonthlyReportsDataset | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected employee for detailed daily drill-down view
  const [detailEmployeeUid, setDetailEmployeeUid] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Review modal state
  const [reviewReport, setReviewReport] = useState<DailyReport | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const toggleExpandDate = (dateStr: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  // Initial load of master data
  useEffect(() => {
    async function loadMasters() {
      try {
        const [authRes, deptRes, centerRes, staffRes] = await Promise.all([
          fetch('/api/auth/session'),
          fetch('/api/departments'),
          fetch('/api/centers'),
          fetch('/api/staff?limit=200'),
        ]);

        const [authData, deptData, centerData, staffData] = await Promise.all([
          authRes.json(),
          deptRes.json(),
          centerRes.json(),
          staffRes.json(),
        ]);

        if (authData?.user) setCurrentUser(authData.user);
        if (deptData?.departments) setDepartments(deptData.departments);
        if (centerData?.centers) setCenters(centerData.centers);
        if (staffData?.users) setEmployees(staffData.users);
      } catch (err) {
        console.error('Failed to load masters:', err);
      }
    }
    loadMasters();
  }, []);

  // Fetch monthly reports dataset exclusively from Field Activity records
  const fetchDataset = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth),
      });

      if (selectedEmployeeUid && selectedEmployeeUid !== 'all') {
        q.set('staffUid', selectedEmployeeUid);
      }
      if (selectedDepartmentId && selectedDepartmentId !== 'all') {
        q.set('departmentId', selectedDepartmentId);
      }
      if (selectedCenterId && selectedCenterId !== 'all') {
        q.set('centerId', selectedCenterId);
      }
      if (selectedReportStatus && selectedReportStatus !== 'all') {
        q.set('status', selectedReportStatus);
      }

      const res = await fetch(`/api/reports/monthly?${q.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch monthly report dataset.');
      }
      setDataset(data.dataset);
    } catch (err: any) {
      setErrorMsg(err.message);
      setDataset(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataset();
  }, [
    selectedYear,
    selectedMonth,
    selectedEmployeeUid,
    selectedDepartmentId,
    selectedCenterId,
    selectedReportStatus,
  ]);

  // Export Monthly Reports (.xlsx)
  const handleExportExcel = async (specificEmployeeUid?: string) => {
    setExportingExcel(true);
    setErrorMsg(null);
    try {
      const q = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth),
      });

      const empUid = specificEmployeeUid || (selectedEmployeeUid !== 'all' ? selectedEmployeeUid : undefined);
      if (empUid) {
        q.set('employeeUid', empUid);
      }
      if (selectedDepartmentId && selectedDepartmentId !== 'all') {
        q.set('departmentId', selectedDepartmentId);
      }
      if (selectedCenterId && selectedCenterId !== 'all') {
        q.set('centerId', selectedCenterId);
      }

      const url = `/api/reports/monthly/excel?${q.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Server responded with status ${res.status}`);
      }

      const blob = await res.blob();
      const monthStr = String(selectedMonth).padStart(2, '0');
      const filename = empUid
        ? `Agricart_Monthly_Report_${selectedYear}-${monthStr}_Employee.xlsx`
        : `Agricart_Monthly_Activity_Report_${selectedYear}-${monthStr}.xlsx`;

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('Monthly Excel export failed:', err);
      setErrorMsg(`Excel export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportMonthlyPDF = async (specificEmployeeUid?: string) => {
    setExportingPDF(true);
    setErrorMsg(null);
    try {
      const targetUid = specificEmployeeUid || (selectedEmployeeUid !== 'all' ? selectedEmployeeUid : undefined);
      if (!targetUid) {
        throw new Error('Please select an employee or click into an employee record to export their monthly PDF.');
      }

      const url = `/api/reports/monthly/pdf?year=${selectedYear}&month=${selectedMonth}&staffUid=${targetUid}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Server responded with status ${res.status}`);
      }

      const blob = await res.blob();
      const filename = `Agricart_Monthly_Report_${selectedYear}-${String(selectedMonth).padStart(2, '0')}.pdf`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('Monthly PDF export failed:', err);
      setErrorMsg(err.message || 'Failed to export monthly PDF.');
    } finally {
      setExportingPDF(false);
    }
  };

  // Filtered employee summaries based on search query
  const filteredSummaries = useMemo(() => {
    if (!dataset?.employeeSummaries) return [];
    if (!searchQuery.trim()) return dataset.employeeSummaries;
    const q = searchQuery.toLowerCase().trim();
    return dataset.employeeSummaries.filter(
      (s) =>
        s.employeeName.toLowerCase().includes(q) ||
        s.employeeId.toLowerCase().includes(q) ||
        s.departmentName.toLowerCase().includes(q) ||
        s.centerName.toLowerCase().includes(q)
    );
  }, [dataset?.employeeSummaries, searchQuery]);

  // Detailed daily records for selected employee
  const selectedEmpDetail = useMemo(() => {
    if (!detailEmployeeUid || !dataset) return null;
    const summary = dataset.employeeSummaries.find((s) => s.employeeUid === detailEmployeeUid);
    let records = dataset.dailyRecords.filter((r) => r.employeeUid === detailEmployeeUid);

    if (selectedReportStatus && selectedReportStatus !== 'all') {
      const target = selectedReportStatus.toLowerCase();
      records = records.filter(
        (r) =>
          r.reportStatus?.toLowerCase() === target ||
          r.attendanceStatus?.toLowerCase() === target
      );
    }

    return { summary, records };
  }, [detailEmployeeUid, dataset, selectedReportStatus]);

  const handleOpenReview = (rec: EmployeeDailyRecordItem) => {
    if (!rec.reportId) return;
    const fakeDailyReport: any = {
      id: rec.reportId,
      staffUid: rec.employeeUid,
      staffName: rec.employeeName,
      employeeId: rec.employeeId,
      reportDate: rec.date,
      status: rec.reportStatus?.toLowerCase().replace(/ /g, '_') || 'submitted',
    };
    setReviewReport(fakeDailyReport);
    setReviewModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header and Excel Export Action (DOCX removed per spec) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-emerald-600" /> Employee Monthly Field Activity Reports
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Aggregated metrics calculated exclusively from real Field Activity records and verified GPS device check-ins.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleExportExcel()}
            disabled={exportingExcel || loading}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9 rounded-xl shadow-xs"
          >
            <FileSpreadsheet className={`h-4 w-4 mr-1.5 ${exportingExcel ? 'animate-bounce' : ''}`} />
            {exportingExcel ? 'Generating Workbook...' : 'Export Consolidated Excel (.xlsx)'}
          </Button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Year:</span>
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="w-24 text-xs font-semibold h-8"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </Select>
            </div>

            {/* Month Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Month:</span>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="w-32 text-xs font-semibold h-8"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Employee Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Employee:</span>
              <Select
                value={selectedEmployeeUid}
                onChange={(e) => setSelectedEmployeeUid(e.target.value)}
                className="w-48 text-xs font-semibold h-8"
              >
                <option value="all">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.uid} value={emp.uid}>
                    {emp.fullName} ({emp.employeeId})
                  </option>
                ))}
              </Select>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Dept:</span>
              <Select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="w-40 text-xs font-semibold h-8"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Center Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Center:</span>
              <Select
                value={selectedCenterId}
                onChange={(e) => setSelectedCenterId(e.target.value)}
                className="w-36 text-xs font-semibold h-8"
              >
                <option value="all">All Centers</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">Status:</span>
              <Select
                value={selectedReportStatus}
                onChange={(e) => setSelectedReportStatus(e.target.value)}
                className="w-40 text-xs font-semibold h-8"
              >
                <option value="all">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Approved">Approved</option>
                <option value="Correction Required">Correction Required</option>
                <option value="Present">Present</option>
                <option value="In Progress">In Progress</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Activities Recorded">Activities Recorded</option>
                <option value="On Leave">On Leave</option>
                <option value="Holiday">Holiday</option>
                <option value="Weekly Off">Weekly Off</option>
                <option value="Missing Attendance">Missing Attendance</option>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={fetchDataset}
              disabled={loading}
              className="text-xs font-bold text-emerald-700 h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          {/* Search box */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by employee name, ID, department, or center..."
              className="text-xs h-8 border-none bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
        </CardContent>
      </Card>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Employee Monthly Summary Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Employee Monthly Summary ({filteredSummaries.length} Employees)
              </CardTitle>
              <CardDescription className="text-xs">
                Aggregate monthly activity records for {dataset?.monthName || 'selected month'}. Click any row to inspect the full 20-column daily breakdown.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading monthly summaries from Firestore...</div>
          ) : filteredSummaries.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No employee activity records found for this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Employee</TableHead>
                    <TableHead className="font-bold">Department & Center</TableHead>
                    <TableHead className="text-right font-bold">Days Attended</TableHead>
                    <TableHead className="text-right font-bold">Activity Days</TableHead>
                    <TableHead className="text-right font-bold">Total Acts</TableHead>
                    <TableHead className="text-right font-bold">Task Hrs</TableHead>
                    <TableHead className="text-right font-bold">Work Hrs</TableHead>
                    <TableHead className="text-right font-bold">Contacts</TableHead>
                    <TableHead className="text-center font-bold">Reports</TableHead>
                    <TableHead className="text-right font-bold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSummaries.map((emp) => (
                    <TableRow
                      key={emp.employeeUid}
                      className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                      onClick={() => setDetailEmployeeUid(emp.employeeUid)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-bold text-slate-900">{emp.employeeName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{emp.employeeId}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <div>
                          <p className="font-medium text-slate-900">{emp.departmentName}</p>
                          <p className="text-[10px] text-slate-500">{emp.centerName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-800">
                        {emp.daysAttended ?? emp.presentDays ?? 0}
                        {emp.attendancePercentage !== null && emp.attendancePercentage !== undefined && (
                          <span className="text-[10px] text-slate-500 block font-medium">
                            ({emp.attendancePercentage}%)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-blue-800">
                        {emp.daysWithActivities ?? emp.totalDaysWorked ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">
                        {emp.totalActivities}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-800">
                        {emp.totalActivityHours}h
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-800">
                        {emp.totalWorkingHours}h
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {emp.totalFarmerContacts}
                        <span className="text-[10px] text-slate-500 block font-normal">
                          (M:{emp.totalMaleParticipants} F:{emp.totalFemaleParticipants})
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[11px] font-bold text-emerald-700">
                            {emp.daysReportSubmitted} submitted
                          </span>
                          {(emp.missingAttendanceDays ?? emp.daysReportMissing) > 0 && (
                            <span className="text-[10px] font-bold text-amber-700">
                              {emp.missingAttendanceDays ?? emp.daysReportMissing} missing
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailEmployeeUid(emp.employeeUid);
                          }}
                          className="h-8 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                        >
                          View Details <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Monthly View Dialog: 20 Required Columns + Expandable Activities */}
      {selectedEmpDetail && (
        <Dialog
          open={Boolean(detailEmployeeUid)}
          onOpenChange={(open) => {
            if (!open) setDetailEmployeeUid(null);
          }}
          title={`Monthly Field Activity Log: ${selectedEmpDetail.summary?.employeeName} (${selectedEmpDetail.summary?.employeeId})`}
          description={`20-column daily breakdown for ${dataset?.monthName || 'Month'} with authorized location names`}
          maxWidth="max-w-7xl"
        >
          <div className="space-y-4">
            {/* Header KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Working Days</span>
                <span className="text-lg font-black text-slate-900">{selectedEmpDetail.summary?.totalWorkingDays ?? 0}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">Days Attended</span>
                <span className="text-lg font-black text-emerald-900">
                  {selectedEmpDetail.summary?.daysAttended ?? selectedEmpDetail.summary?.presentDays ?? 0}
                  {selectedEmpDetail.summary?.attendancePercentage !== null &&
                    selectedEmpDetail.summary?.attendancePercentage !== undefined && (
                      <span className="text-xs font-bold text-emerald-700 ml-1">
                        ({selectedEmpDetail.summary.attendancePercentage}%)
                      </span>
                    )}
                </span>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-[10px] font-bold text-blue-800 uppercase block">Total Activities</span>
                <span className="text-lg font-black text-blue-900">{selectedEmpDetail.summary?.totalActivities} ({selectedEmpDetail.summary?.totalActivityHours}h)</span>
              </div>
              <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200">
                <span className="text-[10px] font-bold text-purple-800 uppercase block">Farmer Contacts</span>
                <span className="text-lg font-black text-purple-900">{selectedEmpDetail.summary?.totalFarmerContacts}</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-amber-800 uppercase block">Missing Days</span>
                <span className="text-lg font-black text-amber-900">{selectedEmpDetail.summary?.missingAttendanceDays ?? selectedEmpDetail.summary?.daysReportMissing ?? 0}</span>
              </div>
            </div>

            {/* Daily calendar records table with 20 columns and expandable slots */}
            <div className="overflow-x-auto max-h-[60vh] border border-slate-200 rounded-xl">
              <Table className="min-w-[1700px] text-xs">
                <TableHeader className="sticky top-0 bg-slate-100 z-10">
                  <TableRow>
                    <TableHead className="w-24 whitespace-nowrap font-bold">1. Date</TableHead>
                    <TableHead className="w-14 whitespace-nowrap font-bold">2. Day</TableHead>
                    <TableHead className="w-28 whitespace-nowrap font-bold">3. Attendance</TableHead>
                    <TableHead className="w-20 whitespace-nowrap font-bold">4. Login</TableHead>
                    <TableHead className="w-20 whitespace-nowrap font-bold">5. Logout</TableHead>
                    <TableHead className="w-64 whitespace-nowrap font-bold">6. Daily Activities</TableHead>
                    <TableHead className="w-16 text-center font-bold">7. Count</TableHead>
                    <TableHead className="w-24 text-right font-bold">8. Duration</TableHead>
                    <TableHead className="w-24 text-right font-bold">9. Work Period</TableHead>
                    <TableHead className="w-20 text-center font-bold">10. Contacts</TableHead>
                    <TableHead className="w-16 text-center font-bold">11. Male</TableHead>
                    <TableHead className="w-16 text-center font-bold">12. Female</TableHead>
                    <TableHead className="w-24 text-right font-bold">13. Field Time</TableHead>
                    <TableHead className="w-24 text-right font-bold">14. Desk Time</TableHead>
                    <TableHead className="w-24 whitespace-nowrap font-bold">15. Leave Status</TableHead>
                    <TableHead className="w-28 whitespace-nowrap font-bold">16. Submission</TableHead>
                    <TableHead className="w-32 whitespace-nowrap font-bold">17. Review Status</TableHead>
                    <TableHead className="w-28 whitespace-nowrap font-bold">18. Reviewer</TableHead>
                    <TableHead className="w-36 whitespace-nowrap font-bold">19. Remarks</TableHead>
                    <TableHead className="w-32 whitespace-nowrap font-bold">20. GPS / Location</TableHead>
                    <TableHead className="w-28 text-center font-bold">Actions</TableHead>
                    <TableHead className="w-20 text-center font-bold">Slots</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedEmpDetail.records.map((r) => {
                    const isOff = r.isWeeklyOff || r.isHoliday;
                    const isUpcoming = r.attendanceStatus === 'Upcoming' || r.reportStatus === 'Upcoming';
                    const isMissing = !isUpcoming && r.isMissing;
                    const mapsUrl = r.loginGps ? getGoogleMapsUrl(r.loginGps) : (r.finalizationGps ? getGoogleMapsUrl(r.finalizationGps) : null);
                    const isExpanded = expandedDates.has(r.date);
                    const hasActivities = Array.isArray(r.activitiesList) && r.activitiesList.length > 0;

                    return (
                      <React.Fragment key={r.date}>
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
                            {r.date}
                          </TableCell>

                          {/* 2. Day */}
                          <TableCell className="font-semibold text-slate-500">
                            {r.dayOfWeek}
                          </TableCell>

                          {/* 3. Attendance Status */}
                          <TableCell>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.attendanceStatus === 'Present'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.attendanceStatus === 'In Progress' || r.attendanceStatus === 'Active'
                                    ? 'bg-blue-100 text-blue-800'
                                    : r.attendanceStatus === 'Absent'
                                      ? 'bg-rose-100 text-rose-800'
                                      : r.attendanceStatus === 'On Leave'
                                        ? 'bg-purple-100 text-purple-800'
                                        : r.attendanceStatus === 'Holiday'
                                          ? 'bg-indigo-100 text-indigo-800'
                                          : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {r.attendanceStatus || '—'}
                            </span>
                          </TableCell>

                          {/* 4. Login Time */}
                          <TableCell className="font-mono text-[11px] text-slate-700">
                            {r.attendanceLogin}
                          </TableCell>

                          {/* 5. Logout Time */}
                          <TableCell className="font-mono text-[11px] text-slate-700">
                            {r.attendanceLogout}
                          </TableCell>

                          {/* 6. Daily Activities */}
                          <TableCell className="text-slate-800 max-w-xs truncate" title={r.activitySummary}>
                            <span className={isMissing ? 'text-amber-700 italic font-medium' : 'font-medium'}>
                              {r.activitySummary}
                            </span>
                          </TableCell>

                          {/* 7. Activity Count */}
                          <TableCell className="text-center font-bold text-slate-900">
                            {r.activitiesCount || 0}
                          </TableCell>

                          {/* 8. Total Activity Duration */}
                          <TableCell className="text-right text-slate-700 font-mono">
                            {r.totalActivityDurationFormatted || `${r.totalActivityDurationMinutes}m`}
                          </TableCell>

                          {/* 9. Working Period */}
                          <TableCell className="text-right text-slate-700 font-mono">
                            {r.workingPeriodFormatted || `${r.workingPeriodMinutes}m`}
                          </TableCell>

                          {/* 10. Total Participants */}
                          <TableCell className="text-center font-bold text-slate-900">
                            {r.participantContacts || 0}
                          </TableCell>

                          {/* 11. Male Participants */}
                          <TableCell className="text-center text-slate-600">
                            {r.maleParticipants || 0}
                          </TableCell>

                          {/* 12. Female Participants */}
                          <TableCell className="text-center text-slate-600">
                            {r.femaleParticipants || 0}
                          </TableCell>

                          {/* 13. Field Time */}
                          <TableCell className="text-right text-slate-600">
                            {r.fieldActivityTimeFormatted || `${r.fieldActivityMinutes}m`}
                          </TableCell>

                          {/* 14. Desk Time */}
                          <TableCell className="text-right text-slate-600">
                            {r.deskWorkTimeFormatted || `${r.deskJobDurationMinutes}m`}
                          </TableCell>

                          {/* 15. Leave Status */}
                          <TableCell className="whitespace-nowrap">
                            {r.leaveStatus !== 'None' ? (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                {r.leaveStatus}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>

                          {/* 16. Submission Status */}
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant={
                                r.reportStatus === 'Approved'
                                  ? 'default'
                                  : r.reportStatus === 'Missing'
                                    ? 'warning'
                                    : 'secondary'
                              }
                              className="text-[10px]"
                            >
                              {r.reportStatus}
                            </Badge>
                          </TableCell>

                          {/* 17. Review Status */}
                          <TableCell className="text-slate-700 whitespace-nowrap">
                            {r.reviewStatus}
                          </TableCell>

                          {/* 18. Reviewer */}
                          <TableCell className="text-slate-700 whitespace-nowrap">
                            {r.reviewer || '—'}
                          </TableCell>

                          {/* 19. Review Remarks */}
                          <TableCell className="text-slate-600 max-w-xs truncate" title={r.reviewRemarks}>
                            {r.reviewRemarks || '—'}
                          </TableCell>

                          {/* 20. GPS / Location with Map Link */}
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                {r.gpsAvailability || 'None'}
                              </span>
                              {mapsUrl && (
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-700 hover:text-emerald-800 p-0.5 rounded hover:bg-emerald-50"
                                  title="Open GPS Location in Google Maps"
                                >
                                  <MapPin className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </TableCell>

                          {/* Actions: Daily PDF & Review Modal */}
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {r.reportId ? (
                                <>
                                  <a
                                    href={`/api/field-reports/${r.reportId}/pdf`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                    title="Download Daily PDF"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                  </a>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleOpenReview(r)}
                                    className="h-7 px-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                                    title="Review Report"
                                  >
                                    Review
                                  </Button>
                                </>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Expandable slots toggle */}
                          <TableCell className="text-center">
                            {hasActivities ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleExpandDate(r.date)}
                                className="h-7 px-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expandable Sub-table for Multiple Activities on this date */}
                        {isExpanded && hasActivities && (
                          <TableRow className="bg-emerald-50/20 border-b border-emerald-100">
                            <TableCell colSpan={22} className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5 text-emerald-600" />
                                    Detailed Field Activities for {r.date} ({r.activitiesList!.length} Slots)
                                  </h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                  {r.activitiesList!.map((act, aIdx) => (
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

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportExcel(selectedEmpDetail.summary?.employeeUid)}
                  disabled={exportingExcel}
                  className="text-xs font-bold border-emerald-600 text-emerald-800 hover:bg-emerald-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Export This Employee's Excel (.xlsx)
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportMonthlyPDF(selectedEmpDetail.summary?.employeeUid)}
                  disabled={exportingPDF}
                  className="text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5 mr-1 text-slate-600" /> Export Monthly PDF
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailEmployeeUid(null)}
                className="text-xs font-bold"
              >
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Report Review Modal */}
      {reviewModalOpen && reviewReport && currentUser && (
        <ReportReviewModal
          report={reviewReport}
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          currentUser={currentUser}
          onRefresh={fetchDataset}
        />
      )}
    </div>
  );
}
