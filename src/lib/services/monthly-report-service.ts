import { fetchCollection, fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { DailyReport, MonthlyReportDay, MonthlyReportSummary, ReportAttachment, UserProfile } from '@/types';
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

  // Fetch all attachments for this staff member to ensure 100% complete evidence coverage
  const allStaffAttachments = (await fetchCollection(ERP_COLLECTIONS.reportAttachments, [
    { field: 'staffUid', op: '==', value: staffUid },
  ])) as ReportAttachment[];

  const attachmentsByReportId = new Map<string, ReportAttachment[]>();
  for (const att of allStaffAttachments) {
    if (att.reportId) {
      const existing = attachmentsByReportId.get(att.reportId) || [];
      existing.push(att);
      attachmentsByReportId.set(att.reportId, existing);
    }
  }

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
      if (report.status === 'submitted' || report.status === 'under_review' || report.status === 'resubmitted') pendingReviewDays++;
      if (report.status === 'correction_requested' || report.status === 'edit_requested') correctionRequestedDays++;

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
      else if (report.status === 'correction_requested' || report.status === 'edit_requested') statusLabel = 'Correction Requested';
      else if (report.status === 'under_review' || report.status === 'resubmitted') statusLabel = 'Under Review';

      const reviewLabel = report.reviewerName
        ? `${report.status === 'approved' ? 'Approved' : 'Reviewed'} by ${report.reviewerName}`
        : report.status === 'approved'
          ? 'Approved'
          : 'Pending Review';

      let remarksText = report.reviewComments || '—';
      if (hasConflict) {
        remarksText = `[CONFLICT] Overlaps with approved ${leave?.leaveType.toUpperCase()} leave. ${remarksText !== '—' ? remarksText : ''}`;
      }

      // Combine attachments from report object and standalone attachment collection without duplicates
      const reportAttachments = Array.isArray(report.attachments) ? report.attachments : [];
      const collectionAttachments = attachmentsByReportId.get(report.id) || [];
      const seenAttachmentKeys = new Set<string>();
      const mergedAttachments: ReportAttachment[] = [];

      for (const att of [...reportAttachments, ...collectionAttachments]) {
        const key = att.id || att.storagePath || att.originalFilename;
        if (key && !seenAttachmentKeys.has(key)) {
          seenAttachmentKeys.add(key);
          mergedAttachments.push(att);
        }
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
        attachments: mergedAttachments,
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
