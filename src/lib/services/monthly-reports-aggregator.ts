import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import {
  AttendanceSession,
  EmployeeDailyActivityDetail,
  EmployeeDailyRecordItem,
  EmployeeMonthlySummaryItem,
  FieldActivityRecord,
  FieldReport,
  MonthlyReportsDataset,
  UserProfile,
} from '@/types';
import { formatGpsCompact } from '@/lib/utils/geolocation';
import { formatDateTimeIST, formatTimeIST } from '@/lib/utils/date-utils';
import {
  calculateActivitiesSummary,
  getHumanPlaceName,
  isSingleFarmerActivity,
  mergeDayActivities,
  mergeEvidenceUrls,
  normalizeActivityStatus,
  resolveActivityNameLabel,
  resolveSupportLabels,
} from '@/lib/utils/field-activity-calculations';
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

/**
 * Builds a complete monthly dataset combining Employees, Field Reports,
 * standalone Field Activity slots, Attendance Sessions, and Leaves.
 * Uses strictly Asia/Kolkata formatting and zero truncation across every exported/UI field.
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
  const includeGps = reportingConfig.includeGpsInExports !== false;

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
    employees = employees.filter(
      (e) => Array.isArray(e.assignedCenterIds) && e.assignedCenterIds.includes(params.centerId!)
    );
  }
  if (params.employeeUid && params.employeeUid !== 'all') {
    employees = employees.filter((e) => e.uid === params.employeeUid);
  }

  // 2. Fetch NEW Field Reports, standalone Field Activities, Attendance Sessions, and Approved Leaves in parallel
  const [allFieldReports, allStandaloneActivities, allAttendance, allLeaves] = await Promise.all([
    fetchCollection(ERP_COLLECTIONS.fieldReports) as Promise<FieldReport[]>,
    fetchCollection(ERP_COLLECTIONS.fieldActivities) as Promise<FieldActivityRecord[]>,
    fetchCollection(ERP_COLLECTIONS.attendanceSessions) as Promise<AttendanceSession[]>,
    fetchCollection(ERP_COLLECTIONS.leaveRecords) as Promise<any[]>,
  ]);

  const monthReports = allFieldReports.filter(
    (r) => r.reportDate >= startDateStr && r.reportDate <= endDateStr
  );
  const monthStandalone = allStandaloneActivities.filter(
    (a) => a.reportDate >= startDateStr && a.reportDate <= endDateStr
  );
  const monthAttendance = allAttendance.filter((s) => s.date >= startDateStr && s.date <= endDateStr);
  const monthLeaves = allLeaves.filter(
    (l) => l.approvalStatus === 'approved' && l.startDate <= endDateStr && l.endDate >= startDateStr
  );

  const reportsByEmpDate = new Map<string, FieldReport>();
  for (const r of monthReports) {
    reportsByEmpDate.set(`${r.staffUid}_${r.reportDate}`, r);
  }

  const standaloneByEmpDate = new Map<string, FieldActivityRecord[]>();
  for (const rec of monthStandalone) {
    const key = `${rec.staffUid}_${rec.reportDate}`;
    const list = standaloneByEmpDate.get(key) || [];
    list.push(rec);
    standaloneByEmpDate.set(key, list);
  }

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
      const standaloneForDay = standaloneByEmpDate.get(`${emp.uid}_${dateStr}`) || [];
      const mergedActivities = mergeDayActivities(report?.activities || [], standaloneForDay);
      const attendance = attendanceByEmpDate.get(`${emp.uid}_${dateStr}`);
      const leave = monthLeaves.find(
        (l) => l.staffUid === emp.uid && dateStr >= l.startDate && dateStr <= l.endDate
      );

      const hasActivities = mergedActivities.length > 0;
      const hasSubmittedReport = Boolean(
        report &&
          (report.finalized ||
            ['submitted', 'under_review', 'approved', 'rejected', 'correction_requested', 'edit_requested', 'resubmitted'].includes(
              report.status
            ))
      );

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
          loginTimestamp: formatTimeIST(attendance.loginTimestamp),
          logoutTimestamp: formatTimeIST(attendance.logoutTimestamp),
          loginGps: includeGps ? formatGpsCompact(attendance.loginGps) : getHumanPlaceName(attendance.loginGps),
          logoutGps: includeGps ? formatGpsCompact(attendance.logoutGps) : getHumanPlaceName(attendance.logoutGps),
          loginAccuracy: attendance.loginGps?.accuracy ? `${attendance.loginGps.accuracy}m` : '—',
          logoutAccuracy: attendance.logoutGps?.accuracy ? `${attendance.logoutGps.accuracy}m` : '—',
          logoutType: attendance.logoutType || '—',
          attendanceStatus: attendance.status.toUpperCase(),
          workingDuration: workingDurationText,
        });
      } else if (!isWeeklyOff && !isHoliday && !leave) {
        missingAttendanceDays++;
      }

      const daySummary = hasActivities ? calculateActivitiesSummary(mergedActivities, false).summary : null;
      const activitiesDetailList: EmployeeDailyActivityDetail[] = [];

      const reportStatusNormalized = report?.status
        ? report.status.replace(/_/g, ' ').toUpperCase()
        : hasActivities
        ? 'DRAFT / IN PROGRESS'
        : '—';
      const correctionHistoryText = report
        ? (report.revisionNumber || 1) > 1
          ? `Revision #${report.revisionNumber}${report.editRequest?.reason ? ` (${report.editRequest.reason})` : ''}`
          : report.editRequest?.reason
          ? `Edit Requested (${report.editRequest.reason})`
          : 'Initial Submission'
        : '—';

      if (hasSubmittedReport && report) {
        if (report.status === 'approved') {
          reportsApproved++;
        } else if (report.status === 'rejected') {
          reportsRejected++;
          reportsRequiringCorrection++;
        } else if (report.status === 'correction_requested' || report.status === 'edit_requested') {
          reportsRequiringCorrection++;
        } else if (['submitted', 'under_review', 'resubmitted'].includes(report.status)) {
          reportsPendingReview++;
        }

        if (report.isLate) lateSubmissions++;

        if (
          report.reviewerName ||
          report.status === 'approved' ||
          report.reviewComments ||
          report.editRequest
        ) {
          reviewHistoryRows.push({
            employeeId: emp.employeeId,
            employeeName: emp.fullName,
            reportDate: dateStr,
            submittedTimestamp: report.submittedAt ? formatDateTimeIST(report.submittedAt) : '—',
            reviewTimestamp: report.reviewedAt ? formatDateTimeIST(report.reviewedAt) : '—',
            reviewer:
              report.reviewerName ||
              report.editRequest?.requesterName ||
              (report.status === 'approved' ? 'Supervisor Verified' : 'Pending'),
            reviewStatus: report.status.replace(/_/g, ' ').toUpperCase(),
            remarks:
              report.reviewComments ||
              (report.editRequest
                ? `${report.editRequest.reason}${report.editRequest.instructions ? ` (${report.editRequest.instructions})` : ''}`
                : '—'),
            correctionHistory: correctionHistoryText,
          });
        }
      }

      if (hasActivities && daySummary) {
        daysWithActivities++;
        totalActivities += mergedActivities.length;
        completedActivities += mergedActivities.filter(
          (a) =>
            a.activityStatus === 'COMPLETED' ||
            a.activityStatus === 'completed' ||
            Boolean((a.activityEndAt || a.activityEnd)?.trim())
        ).length;

        totalActivityMinutes += daySummary.totalActivityMinutes || 0;
        totalWorkingPeriodMinutes +=
          daySummary.totalWorkingPeriodMinutes || attendance?.attendanceDurationMinutes || attendance?.durationMinutes || 0;
        totalDeskJobMinutes += daySummary.totalDeskJobMinutes || 0;
        totalFieldActivityMinutes += daySummary.totalFieldActivityMinutes || 0;
        totalFarmerContacts += daySummary.totalParticipantContacts || 0;
        totalMaleParticipants += daySummary.totalMaleParticipants || 0;
        totalFemaleParticipants += daySummary.totalFemaleParticipants || 0;

        mergedActivities.forEach((act) => {
          const startLocObj = act.activityStartLocation || act.activityStartGps;
          const endLocObj = act.activityEndLocation || act.activityEndGps;
          const startLocName = getHumanPlaceName(startLocObj);
          const endLocName = getHumanPlaceName(endLocObj);
          const startGpsCoord = includeGps ? formatGpsCompact(startLocObj) : 'Hidden by policy';
          const endGpsCoord = includeGps ? formatGpsCompact(endLocObj) : 'Hidden by policy';

          const photos = mergeEvidenceUrls(act.photoUrl, act.photoEvidence);
          const videos = mergeEvidenceUrls(act.videoUrl, act.videoEvidence);
          const supportLabels = resolveSupportLabels(act);
          const supportText = supportLabels.length > 0 ? supportLabels.join(', ') : 'None';
          const isSingle = isSingleFarmerActivity(act);
          const activityTypeLabel =
            act.activityName === 'desk_job' ? 'Office' : isSingle ? 'Single Farmer' : 'Group';
          const title = resolveActivityNameLabel(act);
          const durMins = act.activityDurationMinutes ?? act.durationMinutes ?? 0;
          const startTimeIST = formatTimeIST(act.activityStartAt || act.activityStart);
          const endTimeIST = formatTimeIST(act.activityEndAt || act.activityEnd);
          const startTimeIso = act.activityStartAt || act.activityStart || '';
          const endTimeIso = act.activityEndAt || act.activityEnd || '';
          const normSlotStatus = normalizeActivityStatus(act);
          const slotStatusText =
            normSlotStatus === 'COMPLETED'
              ? 'Completed'
              : normSlotStatus === 'IN_PROGRESS'
              ? 'In Progress'
              : normSlotStatus === 'CANCELLED'
              ? 'Cancelled'
              : 'Not Started';

          const followUpDisplay = act.followUpRequired
            ? `Yes${act.followUpDate ? ` [${act.followUpDate}]` : ''}${
                act.followUpDetails ? `: ${act.followUpDetails}` : ''
              }`
            : 'No';

          activitiesDetailList.push({
            slotNumber: act.slotNumber,
            activityName: act.activityName,
            activityNameLabel: title,
            activityOther: act.activityOther || '',
            activityType: activityTypeLabel,
            village: act.village || '—',
            wadi: act.wadi || '—',
            farmerName: act.farmerName || '—',
            groupDetails: act.groupDetails || '',
            startTime: startTimeIST,
            endTime: endTimeIST,
            durationMinutes: durMins,
            participants: act.totalParticipants || 0,
            maleParticipants: act.maleParticipants || 0,
            femaleParticipants: act.femaleParticipants || 0,
            observations: act.observations || '—',
            issues: act.farmerIssues || '—',
            supportProvided: supportLabels,
            supportOther: act.supportOther || '',
            followUpRequired: Boolean(act.followUpRequired),
            followUpDetails: act.followUpDetails || undefined,
            followUpDate: act.followUpDate || undefined,
            startLocationName: startLocName,
            endLocationName: endLocName,
            photoUrls: photos,
            videoUrls: videos,
            status: slotStatusText,
          });

          allActivitiesRows.push({
            reportDate: dateStr,
            employeeId: emp.employeeId,
            employeeName: emp.fullName,
            departmentName: emp.departmentName || 'Field Operations',
            centerName: emp.assignedCenterNames?.[0] || 'Nashik Center',
            crpCode: report?.crpCode || '—',
            blockTaluka: report?.blockTaluka || '—',
            slotNumber: act.slotNumber,
            activityStatus: slotStatusText,
            activityName: title,
            activityOther: act.activityOther || '—',
            activityType: activityTypeLabel,
            village: act.village || '—',
            wadi: act.wadi || '—',
            farmerName: act.farmerName || '—',
            groupDetails: act.groupDetails || '—',
            startTime: startTimeIST,
            endTime: endTimeIST,
            startTimeIso,
            endTimeIso,
            durationMinutes: durMins,
            participants: act.totalParticipants || 0,
            maleParticipants: act.maleParticipants || 0,
            femaleParticipants: act.femaleParticipants || 0,
            observations: act.observations || '—',
            issues: act.farmerIssues || '—',
            supportProvided: supportText,
            supportOther: act.supportOther || '—',
            followUpRequired: Boolean(act.followUpRequired),
            followUpDetails: act.followUpDetails || '—',
            followUpDate: act.followUpDate || '—',
            followUp: followUpDisplay,
            startGps:
              startLocName !== 'Location unavailable' && includeGps
                ? `${startLocName} (${startGpsCoord})`
                : includeGps
                ? startGpsCoord
                : startLocName,
            startGpsCoords: startGpsCoord,
            startGpsLocationName: startLocName,
            endGps:
              endLocName !== 'Location unavailable' && includeGps
                ? `${endLocName} (${endGpsCoord})`
                : includeGps
                ? endGpsCoord
                : endLocName,
            endGpsCoords: endGpsCoord,
            endGpsLocationName: endLocName,
            photoEvidenceRefs: photos.length > 0 ? photos.join('\n') : 'None',
            photoUrls: photos,
            videoEvidenceRefs: videos.length > 0 ? videos.join('\n') : 'None',
            videoUrls: videos,
            reviewStatus: reportStatusNormalized,
            reviewerName: report?.reviewerName || '—',
            reviewComments: report?.reviewComments || report?.editRequest?.reason || '—',
            correctionHistory: correctionHistoryText,
          });
        });
      }

      if (hasSubmittedReport) {
        daysReportSubmitted++;
      } else if (!leave && !isWeeklyOff && !isHoliday) {
        daysReportMissing++;
        if (attendance) {
          missingActivityDays++;
        }
      }

      let attendanceStatus = 'Absent';
      if (attendance) {
        attendanceStatus =
          attendance.status === 'active' ? 'Active' : attendance.systemClosed ? 'Auto-Closed' : 'Present';
      } else if (leave) {
        attendanceStatus = 'On Leave';
      } else if (isHoliday) {
        attendanceStatus = 'Holiday';
      } else if (isWeeklyOff) {
        attendanceStatus = 'Weekly Off';
      }

      const loginTime = formatTimeIST(attendance?.loginTimestamp);
      const logoutTime = formatTimeIST(attendance?.logoutTimestamp);
      const loginLoc = getHumanPlaceName(attendance?.loginGps);
      const logoutLoc =
        attendance?.logoutType === 'automatic_midnight'
          ? 'Auto-closed at midnight (Location unavailable)'
          : getHumanPlaceName(attendance?.logoutGps);
      const finalLoc = getHumanPlaceName(report?.finalizationGps);

      let activitySummaryText = 'No activities recorded';
      if (hasActivities) {
        const actNames = mergedActivities.map((a) => {
          const base = resolveActivityNameLabel(a);
          return a.activityOther?.trim() ? `${base} (${a.activityOther.trim()})` : base;
        });
        activitySummaryText = `${mergedActivities.length} activit${
          mergedActivities.length === 1 ? 'y' : 'ies'
        }: ${actNames.join(', ')}`;
      } else if (leave) {
        activitySummaryText = `Approved Leave: ${leave.leaveType?.toUpperCase() || 'LEAVE'}`;
      } else if (isHoliday) {
        activitySummaryText = `Official Holiday: ${holiday?.name || 'Holiday'}`;
      } else if (isWeeklyOff) {
        activitySummaryText = 'Weekly Off';
      } else if (attendance) {
        activitySummaryText = 'Attended — No activities logged';
      }

      let overallReportStatus = 'Missing';
      if (hasSubmittedReport && report) {
        if (report.status === 'approved') overallReportStatus = 'Approved';
        else if (report.status === 'correction_requested' || report.status === 'edit_requested') {
          overallReportStatus = 'Correction Required';
        } else if (report.status === 'rejected') overallReportStatus = 'Rejected';
        else overallReportStatus = 'Submitted';
      } else if (hasActivities) {
        overallReportStatus = 'In Progress';
      } else if (leave) {
        overallReportStatus = 'On Leave';
      } else if (isHoliday) {
        overallReportStatus = 'Holiday';
      } else if (isWeeklyOff) {
        overallReportStatus = 'Weekly Off';
      } else if (attendance) {
        overallReportStatus = 'Present';
      } else {
        overallReportStatus = 'Missing Attendance';
      }

      const actCount = mergedActivities.length;
      const totalActMins = daySummary?.totalActivityMinutes || 0;
      const totalActDurFormatted =
        totalActMins > 0 ? `${Math.floor(totalActMins / 60)}h ${totalActMins % 60}m` : '0m';

      const wpMins = daySummary?.totalWorkingPeriodMinutes || attendance?.durationMinutes || 0;
      const wpFormatted = wpMins > 0 ? `${(wpMins / 60).toFixed(1)} hrs` : '0 hrs';

      const totalParts = daySummary?.totalParticipantContacts || 0;
      const maleParts = daySummary?.totalMaleParticipants || 0;
      const femaleParts = daySummary?.totalFemaleParticipants || 0;
      const fieldMins = daySummary?.totalFieldActivityMinutes || 0;
      const deskMins = daySummary?.totalDeskJobMinutes || 0;

      const leaveStatus = leave ? (leave.leaveType ? leave.leaveType.toUpperCase() : 'APPROVED LEAVE') : 'None';
      const submissionStatus = hasSubmittedReport
        ? 'Submitted'
        : hasActivities
        ? 'Draft'
        : leave
        ? 'On Leave'
        : isHoliday
        ? 'Holiday'
        : isWeeklyOff
        ? 'Weekly Off'
        : 'Missing';
      const activityCompletionStatus = hasActivities
        ? report?.finalized
          ? 'Completed'
          : 'In Progress'
        : attendance
        ? 'No Activities Recorded'
        : 'N/A';

      let reviewStatus = '—';
      if (hasSubmittedReport && report) {
        if (report.status === 'approved') reviewStatus = 'Approved';
        else if (report.status === 'correction_requested' || report.status === 'edit_requested') {
          reviewStatus = 'Correction Required';
        } else if (report.status === 'rejected') reviewStatus = 'Rejected';
        else reviewStatus = 'Pending Review';
      } else if (leave) {
        reviewStatus = 'Approved';
      }

      const reviewer = report?.reviewerName || (leave?.approvedByName ? `Leave: ${leave.approvedByName}` : '—');
      const reviewRemarks =
        report?.reviewComments ||
        report?.editRequest?.reason ||
        (leave?.reason ? `Leave: ${leave.reason}` : '—');

      let gpsAvailability = 'None';
      if (attendance?.loginGps && attendance?.logoutGps) {
        gpsAvailability = 'Login + Logout';
      } else if (attendance?.loginGps) {
        gpsAvailability = 'Login Only';
      } else if (report?.finalizationGps) {
        gpsAvailability = 'Report Finalized';
      } else if (
        hasActivities &&
        mergedActivities.some((a) => a.activityStartGps || a.activityStartLocation || a.activityEndGps || a.activityEndLocation)
      ) {
        gpsAvailability = 'Activities GPS';
      }

      const subTime = report?.submittedAt ? formatTimeIST(report.submittedAt) : '—';

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
        firstActivityStart: daySummary?.firstActivityStart || '—',
        lastActivityEnd: daySummary?.lastActivityEnd || '—',
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
