import { fetchCollection, fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { DailyReport, MonthlyReportDay, MonthlyReportSummary, UserProfile } from '@/types';
import { getApprovedLeavesForMonth } from '@/lib/services/leave-service';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Deterministically generates a monthly activity report for a specific employee and calendar month.
 * Populates one row for every calendar day (1 to 28/29/30/31) without UTC timezone drift.
 */
export async function generateMonthlyReport(
  staffUid: string,
  year: number,
  month: number
): Promise<MonthlyReportSummary> {
  // 1. Fetch Employee Profile
  const employeeDoc = (await fetchDocument(ERP_COLLECTIONS.employees, staffUid)) as UserProfile | null;
  const employee = {
    uid: staffUid,
    employeeId: employeeDoc?.employeeId || 'EMP-UNKNOWN',
    fullName: employeeDoc?.fullName || 'Staff',
    email: employeeDoc?.email || '',
    designation: employeeDoc?.designation || 'Field Staff',
    departmentName: employeeDoc?.departmentName || 'Field Operations',
    centerName: employeeDoc?.assignedCenterNames?.[0] || 'Main Center',
  };

  // 2. Determine exact calendar days in this month
  const totalCalendarDays = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(totalCalendarDays).padStart(2, '0')}`;

  // 3. Fetch reports and approved leaves for this month
  const allReports = (await fetchCollection(ERP_COLLECTIONS.dailyReports, [
    { field: 'staffUid', op: '==', value: staffUid },
  ])) as DailyReport[];

  const monthReports = allReports.filter(
    (r) => r.reportDate >= monthStart && r.reportDate <= monthEnd && r.status !== 'draft'
  );

  // Map reports by date (YYYY-MM-DD)
  const reportByDate = new Map<string, DailyReport>();
  for (const r of monthReports) {
    reportByDate.set(r.reportDate, r);
  }

  const approvedLeaves = await getApprovedLeavesForMonth(staffUid, year, month);

  // 4. Build daily rows for every calendar day
  const days: MonthlyReportDay[] = [];
  let submittedReportDays = 0;
  let approvedReportDays = 0;
  let missingReportDays = 0;
  let approvedLeaveDays = 0;
  let pendingReviewDays = 0;
  let correctionRequestedDays = 0;
  let conflictDays = 0;
  let totalFarmersVisited = 0;
  let totalMeetingsConducted = 0;

  for (let d = 1; d <= totalCalendarDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${dayStr}`;

    // Get exact Day of Week using noon timestamp to avoid timezone boundary shifts
    const dayDate = new Date(`${dateStr}T12:00:00Z`);
    const dayOfWeek = DAYS_OF_WEEK[dayDate.getUTCDay()];

    const report = reportByDate.get(dateStr);
    const leave = approvedLeaves.find((l) => dateStr >= l.startDate && dateStr <= l.endDate);

    if (report) {
      submittedReportDays++;
      totalFarmersVisited += report.farmersVisited || 0;
      totalMeetingsConducted += report.meetingsConducted || 0;

      if (report.status === 'approved') approvedReportDays++;
      if (report.status === 'submitted' || report.status === 'under_review') pendingReviewDays++;
      if (report.status === 'correction_requested') correctionRequestedDays++;

      const hasConflict = Boolean(leave);
      if (hasConflict) conflictDays++;

      // Build deterministic activity summary
      let summaryText = report.activities?.trim() || 'Work activities logged.';
      if (report.completedTasks && report.completedTasks.trim()) {
        summaryText += ` | Completed: ${report.completedTasks.trim()}`;
      }
      if ((report.farmersVisited || 0) > 0 || (report.meetingsConducted || 0) > 0) {
        summaryText += ` (Visited: ${report.farmersVisited || 0} farmers, Conducted: ${report.meetingsConducted || 0} meetings)`;
      }

      let subTime = '—';
      if (report.submittedAt) {
        try {
          subTime = new Date(report.submittedAt).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
        } catch {
          subTime = 'Recorded';
        }
      }

      let statusLabel: MonthlyReportDay['reportStatus'] = 'Submitted';
      if (report.status === 'approved') statusLabel = 'Approved';
      else if (report.status === 'correction_requested') statusLabel = 'Correction Requested';
      else if (report.status === 'under_review') statusLabel = 'Under Review';

      const reviewLabel = report.reviewerName
        ? `${report.status === 'approved' ? 'Approved' : 'Reviewed'} by ${report.reviewerName}`
        : report.status === 'approved'
          ? 'Approved'
          : 'Pending Review';

      let remarksText = report.reviewComments || '—';
      if (hasConflict) {
        remarksText = `⚠️ Overlaps with approved ${leave?.leaveType.toUpperCase()} leave. ${remarksText !== '—' ? remarksText : ''}`;
      }

      days.push({
        date: dateStr,
        dayNumber: d,
        dayOfWeek,
        dailyActivity: summaryText,
        reportStatus: statusLabel,
        submissionTime: subTime,
        reviewStatus: reviewLabel,
        remarks: remarksText,
        reportId: report.id,
        leaveId: leave?.id,
        leaveType: leave?.leaveType,
        farmersVisited: report.farmersVisited || 0,
        meetingsConducted: report.meetingsConducted || 0,
        hasConflict,
        conflictDetails: hasConflict ? `Conflict: Report submitted on approved ${leave?.leaveType} leave date.` : undefined,
      });
    } else if (leave) {
      approvedLeaveDays++;
      const durationLabel = leave.isHalfDay ? `Half-Day (${leave.halfDayType === 'second_half' ? '2nd Half' : '1st Half'})` : 'Full Day';
      days.push({
        date: dateStr,
        dayNumber: d,
        dayOfWeek,
        dailyActivity: `Approved Leave: ${leave.leaveType.toUpperCase()} (${durationLabel}) - ${leave.reason || 'Scheduled absence'}`,
        reportStatus: 'On Leave',
        submissionTime: '—',
        reviewStatus: leave.approvedByName ? `Approved by ${leave.approvedByName}` : 'Approved',
        remarks: `Leave Ref: #${leave.id.slice(-6)}`,
        leaveId: leave.id,
        leaveType: leave.leaveType,
      });
    } else {
      missingReportDays++;
      days.push({
        date: dateStr,
        dayNumber: d,
        dayOfWeek,
        dailyActivity: 'No daily report submitted',
        reportStatus: 'Missing',
        submissionTime: '—',
        reviewStatus: '—',
        remarks: '—',
      });
    }
  }

  const nowIso = new Date().toISOString();

  return {
    employee,
    year,
    month,
    monthName: `${MONTH_NAMES[month - 1]} ${year}`,
    generatedAt: nowIso,
    stats: {
      totalCalendarDays,
      submittedReportDays,
      approvedReportDays,
      missingReportDays,
      approvedLeaveDays,
      pendingReviewDays,
      correctionRequestedDays,
      conflictDays,
      totalFarmersVisited,
      totalMeetingsConducted,
    },
    days,
  };
}
