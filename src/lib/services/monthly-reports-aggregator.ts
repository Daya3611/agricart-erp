import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import {
  AttendanceSession,
  FieldReport,
  FieldActivitySlot,
  MonthlyReportsDataset,
  EmployeeMonthlySummaryItem,
  EmployeeDailyRecordItem,
  EmployeeDailyActivityDetail,
  UserProfile,
} from '@/types';
import { formatGpsCoordinates, formatGpsCompact, getGoogleMapsUrl } from '@/lib/utils/geolocation';
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
 * Builds a complete monthly dataset combining Employees, Field Reports, Attendance Sessions, and Leaves.
 * Purely and exclusively calculated from the new Field Activity Reporting system in Firestore.
 * Does NOT query or combine legacy Daily Report collections.
 */
export async function buildMonthlyReportsDataset(params: {
  year: number;
  month: number;
  departmentId?: string;
  centerId?: string;
  employeeUid?: string;
  reportStatus?: string;
  attendanceStatus?: string;
}): Promise<MonthlyReportsDataset> {
  const { year, month } = params;
  const monthName = `${MONTH_NAMES[month - 1]} ${year}`;

  const reportingConfig = await getGlobalReportingSettings();
  const workingDaysConfig = reportingConfig.workingDays || [1, 2, 3, 4, 5, 6];
  const holidaysConfig = reportingConfig.holidays || [];

  const daysInMonth = new Date(year, month, 0).getDate();
  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  // 1. Fetch active employees
  let employees = (await fetchCollection(ERP_COLLECTIONS.employees)) as UserProfile[];
  employees = employees.filter((e) => e.accountStatus !== 'deactivated');

  if (params.departmentId && params.departmentId !== 'all') {
    employees = employees.filter((e) => e.departmentId === params.departmentId);
  }
  if (params.centerId && params.centerId !== 'all') {
    employees = employees.filter((e) => Array.isArray(e.assignedCenterIds) && e.assignedCenterIds.includes(params.centerId!));
  }
  if (params.employeeUid && params.employeeUid !== 'all') {
    employees = employees.filter((e) => e.uid === params.employeeUid);
  }

  // 2. Fetch NEW field reports in this month range exclusively (no legacy dailyReports)
  const allFieldReports = (await fetchCollection(ERP_COLLECTIONS.fieldReports)) as FieldReport[];
  const monthReports = allFieldReports.filter((r) => r.reportDate >= startDateStr && r.reportDate <= endDateStr);

  // 3. Fetch attendance sessions in this month range exclusively
  const allAttendance = (await fetchCollection(ERP_COLLECTIONS.attendanceSessions)) as AttendanceSession[];
  const monthAttendance = allAttendance.filter((s) => s.date >= startDateStr && s.date <= endDateStr);

  // 4. Fetch approved leaves in this month range
  const allLeaves = (await fetchCollection(ERP_COLLECTIONS.leaveRecords)) as any[];
  const monthLeaves = allLeaves.filter(
    (l) => l.approvalStatus === 'approved' && l.startDate <= endDateStr && l.endDate >= startDateStr
  );

  // Group reports by staffUid_reportDate
  const reportsByEmpDate = new Map<string, FieldReport>();
  for (const r of monthReports) {
    reportsByEmpDate.set(`${r.staffUid}_${r.reportDate}`, r);
  }

  // Group attendance by employeeUid_date
  const attendanceByEmpDate = new Map<string, AttendanceSession>();
  for (const s of monthAttendance) {
    attendanceByEmpDate.set(`${s.employeeUid}_${s.date}`, s);
  }

  const employeeSummaries: EmployeeMonthlySummaryItem[] = [];
  const dailyRecords: EmployeeDailyRecordItem[] = [];
  const allActivitiesRows: MonthlyReportsDataset['allActivities'] = [];
  const attendanceRows: MonthlyReportsDataset['attendanceRecords'] = [];
  const leaveRows: MonthlyReportsDataset['leaveRecords'] = [];
  const reviewHistoryRows: MonthlyReportsDataset['reviewHistory'] = [];

  for (const emp of employees) {
    let totalWorkingDays = 0;
    let daysAttended = 0;
    let presentDays = 0;
    let daysWithActivities = 0;
    let totalActivities = 0;
    let completedActivities = 0;
    let totalActivityMinutes = 0;
    let totalWorkingPeriodMinutes = 0;
    let totalDeskJobMinutes = 0;
    let totalFieldActivityMinutes = 0;
    let totalFarmerContacts = 0;
    let totalMaleParticipants = 0;
    let totalFemaleParticipants = 0;
    let daysReportSubmitted = 0;
    let daysReportMissing = 0;
    let missingAttendanceDays = 0;
    let missingActivityDays = 0;
    let reportsPendingReview = 0;
    let reportsApproved = 0;
    let reportsRejected = 0;
    let reportsRequiringCorrection = 0;
    let lateSubmissions = 0;
    let leaveDays = 0;

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayDate = new Date(`${dateStr}T12:00:00Z`);
      const dayOfWeekIdx = dayDate.getUTCDay();
      const dayOfWeek = DAYS_OF_WEEK[dayOfWeekIdx];

      const isWeeklyOff = !workingDaysConfig.includes(dayOfWeekIdx);
      const holiday = holidaysConfig.find((h) => h.date === dateStr);
      const isHoliday = Boolean(holiday);

      if (!isWeeklyOff && !isHoliday) {
        totalWorkingDays++;
      }

      const report = reportsByEmpDate.get(`${emp.uid}_${dateStr}`);
      const attendance = attendanceByEmpDate.get(`${emp.uid}_${dateStr}`);
      const leave = monthLeaves.find((l) => l.staffUid === emp.uid && dateStr >= l.startDate && dateStr <= l.endDate);

      const hasActivities = Boolean(report && Array.isArray(report.activities) && report.activities.length > 0);
      const hasReport = Boolean(report && report.status !== 'draft');

      if (leave) {
        leaveDays++;
        leaveRows.push({
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          date: dateStr,
          leaveType: leave.leaveType ? leave.leaveType.toUpperCase() : 'GENERAL',
          reason: leave.reason || 'Scheduled absence',
          approvalStatus: 'Approved',
          approvedBy: leave.approvedByName || 'Supervisor',
        });
      }

      if (attendance) {
        daysAttended++;
        presentDays++;

        const durMin = attendance.attendanceDurationMinutes || attendance.durationMinutes || 0;
        const durHours = Math.floor(durMin / 60);
        const durRemMin = durMin % 60;
        const workingDurationText = durMin > 0 ? `${durHours}h ${durRemMin}m` : '—';

        attendanceRows.push({
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          attendanceDate: dateStr,
          loginTimestamp: attendance.loginTimestamp ? new Date(attendance.loginTimestamp).toLocaleTimeString('en-IN') : '—',
          logoutTimestamp: attendance.logoutTimestamp ? new Date(attendance.logoutTimestamp).toLocaleTimeString('en-IN') : '—',
          loginGps: formatGpsCompact(attendance.loginGps),
          logoutGps: formatGpsCompact(attendance.logoutGps),
          loginAccuracy: attendance.loginGps?.accuracy ? `${attendance.loginGps.accuracy}m` : '—',
          logoutAccuracy: attendance.logoutGps?.accuracy ? `${attendance.logoutGps.accuracy}m` : '—',
          logoutType: attendance.logoutType || '—',
          attendanceStatus: attendance.status.toUpperCase(),
          workingDuration: workingDurationText,
        });
      } else if (!isWeeklyOff && !isHoliday && !leave) {
        missingAttendanceDays++;
      }

      const activitiesDetailList: EmployeeDailyActivityDetail[] = [];

      if (hasActivities) {
        daysWithActivities++;
        const acts = report!.activities || [];
        totalActivities += acts.length;
        completedActivities += acts.filter((a) => Boolean(a.activityEnd && a.activityEnd.trim() !== '')).length;

        const summary = report!.summary;
        totalActivityMinutes += summary?.totalActivityMinutes || acts.reduce((acc, a) => acc + (a.durationMinutes || 0), 0);
        totalWorkingPeriodMinutes += summary?.totalWorkingPeriodMinutes || 0;
        totalDeskJobMinutes += summary?.totalDeskJobMinutes || 0;
        totalFieldActivityMinutes += summary?.totalFieldActivityMinutes || 0;
        totalFarmerContacts += summary?.totalParticipantContacts || acts.reduce((acc, a) => acc + (a.totalParticipants || 0), 0);
        totalMaleParticipants += summary?.totalMaleParticipants || acts.reduce((acc, a) => acc + (a.maleParticipants || 0), 0);
        totalFemaleParticipants += summary?.totalFemaleParticipants || acts.reduce((acc, a) => acc + (a.femaleParticipants || 0), 0);

        if (report!.status === 'approved') {
          reportsApproved++;
        } else if (report!.status === 'rejected') {
          reportsRejected++;
          reportsRequiringCorrection++;
        } else if (report!.status === 'correction_requested' || report!.status === 'edit_requested') {
          reportsRequiringCorrection++;
        } else if (['submitted', 'under_review', 'resubmitted'].includes(report!.status)) {
          reportsPendingReview++;
        }

        if (report!.isLate) lateSubmissions++;

        // Add review history entry
        if (report!.reviewerName || report!.status === 'approved' || report!.reviewComments) {
          reviewHistoryRows.push({
            employeeId: emp.employeeId,
            employeeName: emp.fullName,
            reportDate: dateStr,
            submittedTimestamp: report!.submittedAt ? new Date(report!.submittedAt).toLocaleString('en-IN') : '—',
            reviewTimestamp: report!.reviewedAt ? new Date(report!.reviewedAt).toLocaleString('en-IN') : '—',
            reviewer: report!.reviewerName || (report!.status === 'approved' ? 'Supervisor Verified' : 'Pending'),
            reviewStatus: report!.status.replace(/_/g, ' ').toUpperCase(),
            remarks: report!.reviewComments || '—',
            correctionHistory: report!.revisionNumber > 1 ? `Revision #${report!.revisionNumber}` : 'Initial Submission',
          });
        }

        // Add activities detail rows for Sheet 3 & UI expandable drawer
        acts.forEach((act) => {
          const startLocName = getHumanPlaceName(act.activityStartLocation || act.activityStartGps);
          const endLocName = getHumanPlaceName(act.activityEndLocation || act.activityEndGps);
          const startGpsCoord = formatGpsCompact(act.activityStartLocation || act.activityStartGps);
          const endGpsCoord = formatGpsCompact(act.activityEndLocation || act.activityEndGps);

          const photos = [...(act.photoEvidence || []), ...(act.photoUrl ? [act.photoUrl] : [])];

          activitiesDetailList.push({
            slotNumber: act.slotNumber,
            activityName: act.activityName,
            activityNameLabel: act.activityNameLabel || act.activityName?.replace(/_/g, ' ') || 'Activity',
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
            startLocationName: startLocName,
            endLocationName: endLocName,
            photoUrls: photos,
            status: act.activityStatus || 'completed',
          });

          allActivitiesRows.push({
            reportDate: dateStr,
            employeeId: emp.employeeId,
            employeeName: emp.fullName,
            slotNumber: act.slotNumber,
            activityName: act.activityNameLabel || act.activityName?.replace(/_/g, ' ') || 'Activity',
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
            supportProvided: Array.isArray(act.supportProvided) ? act.supportProvided.join(', ') : 'None',
            followUp: act.followUpRequired ? `Yes (${act.followUpDetails || ''})` : 'No',
            startGps: startLocName !== 'Location unavailable' ? `${startLocName} (${startGpsCoord})` : startGpsCoord,
            startGpsCoords: startGpsCoord,
            startGpsLocationName: startLocName,
            endGps: endLocName !== 'Location unavailable' ? `${endLocName} (${endGpsCoord})` : endGpsCoord,
            endGpsCoords: endGpsCoord,
            endGpsLocationName: endLocName,
            photoEvidenceRefs: photos.length > 0 ? `${photos.length} photo(s)` : 'None',
          });
        });
      }

      if (hasReport) {
        daysReportSubmitted++;
      } else if (!leave && !isWeeklyOff && !isHoliday) {
        daysReportMissing++;
        if (attendance) {
          missingActivityDays++;
        }
      }

      // Accurate Attendance Status
      let attendanceStatus = 'Absent';
      if (attendance) {
        attendanceStatus = attendance.status === 'active' ? 'Active' : (attendance.systemClosed ? 'Auto-Closed' : 'Present');
      } else if (leave) {
        attendanceStatus = 'On Leave';
      } else if (isHoliday) {
        attendanceStatus = 'Holiday';
      } else if (isWeeklyOff) {
        attendanceStatus = 'Weekly Off';
      }

      // Times and Locations
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
      const finalLoc = getHumanPlaceName(report?.finalizationGps);

      // Activity Summary
      let activitySummaryText = 'No activities recorded';
      if (hasActivities) {
        const actNames = report!.activities.map((a) => a.activityNameLabel || a.activityName?.replace(/_/g, ' '));
        activitySummaryText = `${report!.activities.length} activit${report!.activities.length === 1 ? 'y' : 'ies'}: ${actNames.join(', ')}`;
      } else if (leave) {
        activitySummaryText = `Approved Leave: ${leave.leaveType?.toUpperCase() || 'LEAVE'}`;
      } else if (isHoliday) {
        activitySummaryText = `Official Holiday: ${holiday?.name || 'Holiday'}`;
      } else if (isWeeklyOff) {
        activitySummaryText = 'Weekly Off';
      } else if (attendance) {
        activitySummaryText = 'Attended — No activities logged';
      }

      // Accurate Overall Status
      let overallReportStatus = 'Missing';
      if (hasReport) {
        if (report!.status === 'approved') overallReportStatus = 'Approved';
        else if (report!.status === 'correction_requested' || report!.status === 'edit_requested') overallReportStatus = 'Correction Required';
        else overallReportStatus = 'Submitted';
      } else if (leave) {
        overallReportStatus = 'On Leave';
      } else if (isHoliday) {
        overallReportStatus = 'Holiday';
      } else if (isWeeklyOff) {
        overallReportStatus = 'Weekly Off';
      } else if (attendance) {
        overallReportStatus = hasActivities ? 'Activities Recorded' : 'Present';
      } else {
        overallReportStatus = 'Missing Attendance';
      }

      // Numeric metrics
      const actCount = report?.activities?.length || 0;
      const totalActMins = report?.summary?.totalActivityMinutes || 0;
      const totalActDurFormatted = totalActMins > 0 ? `${Math.floor(totalActMins / 60)}h ${totalActMins % 60}m` : '0m';

      const wpMins = report?.summary?.totalWorkingPeriodMinutes || (attendance?.durationMinutes || 0);
      const wpFormatted = wpMins > 0 ? `${(wpMins / 60).toFixed(1)} hrs` : '0 hrs';

      const totalParts = report?.summary?.totalParticipantContacts || (report?.activities?.reduce((acc, a) => acc + (a.totalParticipants || 0), 0) || 0);
      const maleParts = report?.summary?.totalMaleParticipants || 0;
      const femaleParts = report?.summary?.totalFemaleParticipants || 0;

      const fieldMins = report?.summary?.totalFieldActivityMinutes || 0;
      const deskMins = report?.summary?.totalDeskJobMinutes || 0;

      const leaveStatus = leave ? (leave.leaveType ? leave.leaveType.toUpperCase() : 'APPROVED LEAVE') : 'None';
      const submissionStatus = hasReport ? (report!.status === 'draft' ? 'Draft' : 'Submitted') : (leave ? 'On Leave' : (isHoliday ? 'Holiday' : (isWeeklyOff ? 'Weekly Off' : 'Missing')));
      const activityCompletionStatus = hasActivities ? (report!.finalized ? 'Completed' : 'In Progress') : (attendance ? 'No Activities Recorded' : 'N/A');

      let reviewStatus = '—';
      if (hasReport) {
        if (report!.status === 'approved') reviewStatus = 'Approved';
        else if (report!.status === 'correction_requested' || report!.status === 'edit_requested') reviewStatus = 'Correction Required';
        else if (report!.status === 'rejected') reviewStatus = 'Rejected';
        else reviewStatus = 'Pending Review';
      } else if (leave) {
        reviewStatus = 'Approved';
      }

      const reviewer = report?.reviewerName || (leave?.approvedByName ? `Leave: ${leave.approvedByName}` : '—');
      const reviewRemarks = report?.reviewComments || (leave?.reason ? `Leave: ${leave.reason}` : '—');

      let gpsAvailability = 'None';
      if (attendance?.loginGps && attendance?.logoutGps) {
        gpsAvailability = 'Login + Logout';
      } else if (attendance?.loginGps) {
        gpsAvailability = 'Login Only';
      } else if (report?.finalizationGps) {
        gpsAvailability = 'Report Finalized';
      } else if (hasActivities && report!.activities.some((a) => a.activityStartGps || a.activityEndGps)) {
        gpsAvailability = 'Activities GPS';
      }

      let subTime = '—';
      if (report?.submittedAt) {
        subTime = new Date(report.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }

      dailyRecords.push({
        date: dateStr,
        dayOfWeek: dayOfWeek.slice(0, 3),
        attendanceStatus,
        attendanceLogin: loginTime,
        attendanceLogout: logoutTime,
        loginLocationName: loginLoc,
        logoutLocationName: logoutLoc,
        activitySummary: activitySummaryText,
        activitiesCount: actCount,
        activitiesList: activitiesDetailList,
        totalActivityDurationMinutes: totalActMins,
        totalActivityDurationFormatted: totalActDurFormatted,
        workingPeriodMinutes: wpMins,
        workingPeriodFormatted: wpFormatted,
        participantContacts: totalParts,
        maleParticipants: maleParts,
        femaleParticipants: femaleParts,
        fieldActivityMinutes: fieldMins,
        fieldActivityTimeFormatted: `${fieldMins} mins`,
        deskJobDurationMinutes: deskMins,
        deskWorkTimeFormatted: `${deskMins} mins`,
        leaveStatus,
        submissionStatus,
        activityCompletionStatus,
        reviewStatus,
        reviewer,
        reviewRemarks,
        gpsAvailability,
        employeeId: emp.employeeId,
        employeeName: emp.fullName,
        employeeUid: emp.uid,
        loginLocation: loginLoc,
        logoutLocation: logoutLoc,
        loginGps: attendance?.loginGps || null,
        logoutGps: attendance?.logoutGps || null,
        logoutType: attendance?.logoutType || null,
        firstActivityStart: report?.summary?.firstActivityStart || '—',
        lastActivityEnd: report?.summary?.lastActivityEnd || '—',
        submissionTimestamp: subTime,
        reportStatus: overallReportStatus,
        finalizationLocation: finalLoc,
        finalizationGps: report?.finalizationGps || null,
        isMissing: overallReportStatus === 'Missing' || overallReportStatus === 'Missing Attendance',
        isWeeklyOff,
        isHoliday,
        holidayName: holiday?.name,
        reportId: report?.id,
      });
    }

    const totalActivityHours = Math.round((totalActivityMinutes / 60) * 10) / 10;
    const totalWorkingHours = Math.round((totalWorkingPeriodMinutes / 60) * 10) / 10;
    const totalDeskJobHours = Math.round((totalDeskJobMinutes / 60) * 10) / 10;
    const totalFieldActivityHours = Math.round((totalFieldActivityMinutes / 60) * 10) / 10;

    employeeSummaries.push({
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      employeeUid: emp.uid,
      departmentName: emp.departmentName || 'Field Operations',
      centerName: emp.assignedCenterNames?.[0] || 'Nashik Center',
      reportingMonth: monthName,
      totalCalendarDays: daysInMonth,
      totalWorkingDays,
      daysAttended,
      presentDays,
      daysWithActivities,
      totalActivities,
      completedActivities,
      totalActivityMinutes,
      totalActivityHours,
      totalWorkingPeriodMinutes,
      totalWorkingHours,
      totalDeskJobHours,
      totalFieldActivityHours,
      totalFarmerContacts,
      totalMaleParticipants,
      totalFemaleParticipants,
      daysReportSubmitted,
      approvedActivityDays: reportsApproved,
      reportsApproved,
      daysRequiringCorrection: reportsRequiringCorrection,
      reportsRequiringCorrection,
      reportsRejected,
      reportsPendingReview,
      daysOnLeave: leaveDays,
      leaveDays,
      missingAttendanceDays,
      missingActivityDays,
      daysReportMissing,
      lateSubmissions,
      totalDaysWorked: daysWithActivities,
      totalAttendanceSessions: daysAttended,
    });
  }

  return {
    year,
    month,
    monthName,
    filters: params,
    employeeSummaries,
    dailyRecords,
    allActivities: allActivitiesRows,
    attendanceRecords: attendanceRows,
    leaveRecords: leaveRows,
    reviewHistory: reviewHistoryRows,
  };
}
