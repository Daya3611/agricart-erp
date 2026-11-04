import { fetchCollection, fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import {
  FieldReport,
  AttendanceSession,
  MonthlyReportDay,
  MonthlyReportSummary,
  ReportAttachment,
  UserProfile,
} from '@/types';
import { getApprovedLeavesForMonth } from '@/lib/services/leave-service';
import { getGlobalReportingSettings } from '@/lib/services/settings-service';

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

function getHumanPlaceName(loc?: { placeName?: string } | null): string {
  if (!loc || !loc.placeName || loc.placeName.trim() === '' || loc.placeName === 'Location name unavailable') {
    return 'Location unavailable';
  }
  return loc.placeName.trim();
}

/**
 * Deterministically generates a monthly activity report for a specific employee and calendar month
 * exclusively using the new Field Activity Reporting system (erp_field_reports, erp_attendance_sessions, erp_leave_records).
 * Never queries legacy Daily Report collections.
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

  // 2. Fetch Centralized Reporting Settings (Working Days & Holidays)
  const reportingConfig = await getGlobalReportingSettings();
  const workingDaysConfig = reportingConfig.workingDays || [1, 2, 3, 4, 5, 6];
  const holidaysConfig = reportingConfig.holidays || [];

  // 3. Calendar boundaries
  const totalCalendarDays = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(totalCalendarDays).padStart(2, '0')}`;

  // 4. Fetch NEW Field Reports exclusively
  const allFieldReports = (await fetchCollection(ERP_COLLECTIONS.fieldReports, [
    { field: 'staffUid', op: '==', value: staffUid },
  ])) as FieldReport[];

  const monthReports = allFieldReports.filter(
    (r) => r.reportDate >= monthStart && r.reportDate <= monthEnd && r.status !== 'draft'
  );

  const reportByDate = new Map<string, FieldReport>();
  for (const r of monthReports) {
    reportByDate.set(r.reportDate, r);
  }

  // 5. Fetch Attendance Sessions exclusively
  const allAttendance = (await fetchCollection(ERP_COLLECTIONS.attendanceSessions, [
    { field: 'employeeUid', op: '==', value: staffUid },
  ])) as AttendanceSession[];

  const monthAttendance = allAttendance.filter((s) => s.date >= monthStart && s.date <= monthEnd);
  const attendanceByDate = new Map<string, AttendanceSession>();
  for (const a of monthAttendance) {
    attendanceByDate.set(a.date, a);
  }

  // 6. Fetch Approved Leaves
  const approvedLeaves = await getApprovedLeavesForMonth(staffUid, year, month);

  // 7. Calculate aggregate statistics
  let daysAttended = 0;
  let daysWithActivities = 0;
  let totalActivities = 0;
  let completedActivities = 0;
  let totalActivityMinutes = 0;
  let totalWorkingPeriodMinutes = 0;
  let totalFarmerContacts = 0;
  let maleParticipants = 0;
  let femaleParticipants = 0;
  let approvedReportDays = 0;
  let daysRequiringCorrection = 0;
  let approvedLeaveDays = 0;
  let missingReportDays = 0;
  let missingAttendanceDays = 0;
  let submittedReportDays = 0;
  let pendingReviewDays = 0;
  let conflictDays = 0;

  const days: MonthlyReportDay[] = [];

  for (let d = 1; d <= totalCalendarDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${dayStr}`;

    const dayDate = new Date(`${dateStr}T12:00:00Z`);
    const dayOfWeekIdx = dayDate.getUTCDay();
    const dayOfWeek = DAYS_OF_WEEK[dayOfWeekIdx];

    const isWeeklyOff = !workingDaysConfig.includes(dayOfWeekIdx);
    const holiday = holidaysConfig.find((h) => h.date === dateStr);
    const isHoliday = Boolean(holiday);

    const report = reportByDate.get(dateStr);
    const attendance = attendanceByDate.get(dateStr);
    const leave = approvedLeaves.find((l) => dateStr >= l.startDate && dateStr <= l.endDate);

    const hasActivities = Boolean(report && Array.isArray(report.activities) && report.activities.length > 0);
    const hasReport = Boolean(report && report.status !== 'draft');

    if (attendance) {
      daysAttended++;
    } else if (!isWeeklyOff && !isHoliday && !leave) {
      missingAttendanceDays++;
    }

    if (hasActivities) {
      daysWithActivities++;
      const acts = report!.activities || [];
      totalActivities += acts.length;
      completedActivities += acts.filter((a) => !a.activityEnd || a.activityEnd.trim() !== '').length;

      const summary = report!.summary;
      totalActivityMinutes += summary?.totalActivityMinutes || acts.reduce((acc, a) => acc + (a.durationMinutes || 0), 0);
      totalWorkingPeriodMinutes += summary?.totalWorkingPeriodMinutes || 0;
      totalFarmerContacts += summary?.totalParticipantContacts || acts.reduce((acc, a) => acc + (a.totalParticipants || 0), 0);
      maleParticipants += summary?.totalMaleParticipants || acts.reduce((acc, a) => acc + (a.maleParticipants || 0), 0);
      femaleParticipants += summary?.totalFemaleParticipants || acts.reduce((acc, a) => acc + (a.femaleParticipants || 0), 0);
    }

    if (leave) {
      approvedLeaveDays++;
    }

    if (hasReport) {
      submittedReportDays++;
      if (report!.status === 'approved') approvedReportDays++;
      else if (['rejected', 'correction_requested', 'edit_requested'].includes(report!.status)) daysRequiringCorrection++;
      else if (['submitted', 'under_review', 'resubmitted'].includes(report!.status)) pendingReviewDays++;
    } else if (!leave && !isWeeklyOff && !isHoliday) {
      missingReportDays++;
    }

    const hasConflict = Boolean(hasReport && leave);
    if (hasConflict) conflictDays++;

    // Format Times & Locations
    const loginTime = attendance?.loginTimestamp
      ? new Date(attendance.loginTimestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '—';
    const logoutTime = attendance?.logoutTimestamp
      ? new Date(attendance.logoutTimestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '—';

    const loginLoc = getHumanPlaceName(attendance?.loginGps);
    const logoutLoc = attendance?.logoutType === 'automatic_midnight'
      ? 'Auto-closed at midnight (Location unavailable)'
      : getHumanPlaceName(attendance?.logoutGps);

    // Build Activity Summary & List
    let summaryText = 'No activities recorded';
    const activitiesList: any[] = [];
    const attachments: ReportAttachment[] = [];

    if (hasActivities) {
      const actNames = report!.activities.map((a) => a.activityNameLabel || a.activityName?.replace(/_/g, ' '));
      summaryText = `${report!.activities.length} activit${report!.activities.length === 1 ? 'y' : 'ies'}: ${actNames.join(', ')}`;

      report!.activities.forEach((act) => {
        const startLoc = getHumanPlaceName(act.activityStartLocation || act.activityStartGps);
        const endLoc = getHumanPlaceName(act.activityEndLocation || act.activityEndGps);

        activitiesList.push({
          slotNumber: act.slotNumber,
          activityName: act.activityName,
          activityNameLabel: act.activityNameLabel || act.activityName?.replace(/_/g, ' '),
          activityType: act.activityType === 'single_farmer' ? 'Single Farmer' : (act.activityName === 'desk_job' ? 'Office' : 'Group'),
          village: act.village || '—',
          wadi: act.wadi || '—',
          farmerName: act.farmerName || '—',
          startTime: act.activityStart ? new Date(act.activityStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
          endTime: act.activityEnd ? new Date(act.activityEnd).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
          durationMinutes: act.durationMinutes || 0,
          participants: act.totalParticipants || 0,
          maleParticipants: act.maleParticipants || 0,
          femaleParticipants: act.femaleParticipants || 0,
          observations: act.observations || '—',
          issues: act.farmerIssues || '—',
          supportProvided: act.supportProvided || [],
          followUpRequired: Boolean(act.followUpRequired),
          followUpDetails: act.followUpDetails || undefined,
          startLocationName: startLoc,
          endLocationName: endLoc,
          photoUrls: [...(act.photoEvidence || []), ...(act.photoUrl ? [act.photoUrl] : [])],
        });

        // Collect photo attachments for PDF generator
        const photos = [...(act.photoEvidence || []), ...(act.photoUrl ? [act.photoUrl] : [])];
        photos.forEach((url, pIdx) => {
          attachments.push({
            id: `att_${report!.id}_${act.slotNumber}_${pIdx}`,
            reportId: report!.id,
            staffUid,
            uploadedByUid: staffUid,
            storagePath: url,
            downloadUrl: url,
            originalFilename: `Photo_${act.slotNumber}_${pIdx + 1}.jpg`,
            fileSize: 500000,
            mimeType: 'image/jpeg',
            uploadedAt: act.activityStart || new Date().toISOString(),
          });
        });
      });
    } else if (leave) {
      summaryText = `Approved Leave: ${leave.leaveType?.toUpperCase() || 'LEAVE'} - ${leave.reason || 'Scheduled absence'}`;
    } else if (isHoliday) {
      summaryText = `Official Holiday: ${holiday?.name || 'Holiday'}`;
    } else if (isWeeklyOff) {
      summaryText = 'Weekly Off';
    } else if (attendance) {
      summaryText = 'Attended - No field activities logged';
    }

    // Determine Status Label
    let statusLabel: MonthlyReportDay['reportStatus'] = 'Missing';
    if (hasReport) {
      if (report!.status === 'approved') statusLabel = 'Approved';
      else if (['rejected', 'correction_requested', 'edit_requested'].includes(report!.status)) statusLabel = 'Correction Requested';
      else if (['submitted', 'under_review', 'resubmitted'].includes(report!.status)) statusLabel = 'Submitted';
    } else if (leave) {
      statusLabel = 'On Leave';
    } else if (isHoliday) {
      statusLabel = 'Holiday' as any;
    } else if (isWeeklyOff) {
      statusLabel = 'Weekly Off' as any;
    }

    // Reviewer & Remarks
    const reviewerName = report?.reviewerName;
    const reviewStatusText = reviewerName
      ? `${report?.status === 'approved' ? 'Approved' : 'Reviewed'} by ${reviewerName}`
      : (report?.status === 'approved' ? 'Approved' : (hasReport ? 'Pending Review' : '—'));

    let remarksText = report?.reviewComments || '—';
    if (hasConflict) {
      remarksText = `[CONFLICT] Activity reported on approved ${leave?.leaveType?.toUpperCase()} leave. ${remarksText !== '—' ? remarksText : ''}`;
    }

    let subTime = '—';
    if (report?.submittedAt) {
      subTime = new Date(report.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }

    days.push({
      date: dateStr,
      dayNumber: d,
      dayOfWeek,
      dailyActivity: summaryText,
      reportStatus: statusLabel,
      submissionTime: subTime,
      reviewStatus: reviewStatusText,
      remarks: remarksText,
      reportId: report?.id,
      leaveId: leave?.id,
      leaveType: leave?.leaveType,
      farmersVisited: report?.summary?.totalParticipantContacts || (report?.activities?.reduce((acc, a) => acc + (a.totalParticipants || 0), 0) || 0),
      meetingsConducted: report?.activities?.filter((a) => a.activityType === 'group' || a.activityName === 'training').length || 0,
      hasConflict,
      conflictDetails: hasConflict ? `Conflict: Report submitted on approved ${leave?.leaveType} leave date.` : undefined,
      attachments,
      // Extra fields for rich table & PDF
      attendanceStatus: attendance ? (attendance.status === 'active' ? 'Active' : 'Present') : (leave ? 'On Leave' : (isHoliday ? 'Holiday' : (isWeeklyOff ? 'Weekly Off' : 'Absent'))),
      loginTime,
      logoutTime,
      loginLocationName: loginLoc,
      logoutLocationName: logoutLoc,
      activitiesCount: report?.activities?.length || 0,
      activitiesList,
      activityDurationMinutes: report?.summary?.totalActivityMinutes || 0,
      workingPeriodMinutes: report?.summary?.totalWorkingPeriodMinutes || 0,
      participantCount: report?.summary?.totalParticipantContacts || 0,
      maleParticipants: report?.summary?.totalMaleParticipants || 0,
      femaleParticipants: report?.summary?.totalFemaleParticipants || 0,
      leaveStatus: leave ? (leave.leaveType ? leave.leaveType.toUpperCase() : 'LEAVE') : 'None',
    } as any);
  }

  const totalActivityHours = Math.round((totalActivityMinutes / 60) * 10) / 10;
  const totalWorkingHours = Math.round((totalWorkingPeriodMinutes / 60) * 10) / 10;

  return {
    employee,
    year,
    month,
    monthName: `${MONTH_NAMES[month - 1]} ${year}`,
    generatedAt: new Date().toISOString(),
    stats: {
      totalCalendarDays,
      daysAttended,
      daysWithActivities,
      totalActivities,
      completedActivities,
      totalActivityDuration: totalActivityHours,
      totalWorkingPeriod: totalWorkingHours,
      totalFarmerContacts,
      maleParticipants,
      femaleParticipants,
      approvedReportDays,
      daysRequiringCorrection,
      daysOnLeave: approvedLeaveDays,
      missingAttendanceDays,
      submittedReportDays,
      approvedLeaveDays,
      pendingReviewDays,
      correctionRequestedDays: daysRequiringCorrection,
      conflictDays,
      totalFarmersVisited: totalFarmerContacts,
      totalMeetingsConducted: 0,
      missingReportDays,
    } as any,
    days,
  };
}
