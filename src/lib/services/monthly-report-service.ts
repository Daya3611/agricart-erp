import { fetchCollection, fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import {
  AttendanceSession,
  FieldActivityRecord,
  FieldReport,
  MonthlyReportDay,
  MonthlyReportSummary,
  ReportAttachment,
  UserProfile,
} from '@/types';
import { getApprovedLeavesForMonth } from '@/lib/services/leave-service';
import { getGlobalReportingSettings } from '@/lib/services/settings-service';
import { formatDateTimeIST, formatTimeIST } from '@/lib/utils/date-utils';
import {
  calculateActivitiesSummary,
  getHumanPlaceName,
  isSingleFarmerActivity,
  mergeDayActivities,
  mergeEvidenceUrls,
  resolveActivityNameLabel,
  resolveSupportLabels,
} from '@/lib/utils/field-activity-calculations';

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

function inferFilenameFromUrl(url: string, fallback: string): string {
  try {
    if (url.includes('/api/uploads/view')) {
      const parsed = new URL(url, 'http://localhost');
      const pathParam = parsed.searchParams.get('path') || '';
      const base = pathParam.split('/').pop();
      if (base) return decodeURIComponent(base);
    }
    if (!url.startsWith('data:')) {
      const parsed = new URL(url, 'http://localhost');
      const base = parsed.pathname.split('/').pop();
      if (base && base !== 'view') return decodeURIComponent(base);
    }
  } catch {
    // fallback below
  }
  return fallback;
}

/**
 * Deterministically generates a monthly activity report for a specific employee and calendar month
 * exclusively using the new Field Activity Reporting system
 * (erp_field_reports, erp_field_activities, erp_attendance_sessions, erp_leave_records).
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

  // 4. Fetch NEW Field Reports & standalone Field Activities exclusively
  const [allFieldReports, allStandaloneActivities, allAttendance, approvedLeaves] = await Promise.all([
    fetchCollection(ERP_COLLECTIONS.fieldReports, [
      { field: 'staffUid', op: '==', value: staffUid },
    ]) as Promise<FieldReport[]>,
    fetchCollection(ERP_COLLECTIONS.fieldActivities, [
      { field: 'staffUid', op: '==', value: staffUid },
    ]) as Promise<FieldActivityRecord[]>,
    fetchCollection(ERP_COLLECTIONS.attendanceSessions, [
      { field: 'employeeUid', op: '==', value: staffUid },
    ]) as Promise<AttendanceSession[]>,
    getApprovedLeavesForMonth(staffUid, year, month),
  ]);

  const monthReports = allFieldReports.filter(
    (r) => r.reportDate >= monthStart && r.reportDate <= monthEnd
  );
  const reportByDate = new Map<string, FieldReport>();
  for (const r of monthReports) {
    reportByDate.set(r.reportDate, r);
  }

  const activitiesByDate = new Map<string, FieldActivityRecord[]>();
  for (const rec of allStandaloneActivities) {
    if (rec.reportDate >= monthStart && rec.reportDate <= monthEnd) {
      const list = activitiesByDate.get(rec.reportDate) || [];
      list.push(rec);
      activitiesByDate.set(rec.reportDate, list);
    }
  }

  const monthAttendance = allAttendance.filter((s) => s.date >= monthStart && s.date <= monthEnd);
  const attendanceByDate = new Map<string, AttendanceSession>();
  for (const a of monthAttendance) {
    attendanceByDate.set(a.date, a);
  }

  // 5. Calculate aggregate statistics across every calendar day
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
    const standaloneForDay = activitiesByDate.get(dateStr) || [];
    const mergedActivities = mergeDayActivities(report?.activities || [], standaloneForDay);

    const attendance = attendanceByDate.get(dateStr);
    const leave = approvedLeaves.find((l) => dateStr >= l.startDate && dateStr <= l.endDate);

    const hasActivities = mergedActivities.length > 0;
    const isSubmittedReport = Boolean(
      report &&
        (report.finalized ||
          ['submitted', 'under_review', 'approved', 'rejected', 'correction_requested', 'edit_requested', 'resubmitted'].includes(
            report.status
          ))
    );

    if (attendance) {
      daysAttended++;
    } else if (!isWeeklyOff && !isHoliday && !leave) {
      missingAttendanceDays++;
    }

    const daySummary = hasActivities ? calculateActivitiesSummary(mergedActivities, false).summary : null;

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
      totalFarmerContacts += daySummary.totalParticipantContacts || 0;
      maleParticipants += daySummary.totalMaleParticipants || 0;
      femaleParticipants += daySummary.totalFemaleParticipants || 0;
    } else if (attendance) {
      totalWorkingPeriodMinutes += attendance.attendanceDurationMinutes || attendance.durationMinutes || 0;
    }

    if (leave) {
      approvedLeaveDays++;
    }

    if (isSubmittedReport && report) {
      submittedReportDays++;
      if (report.status === 'approved') approvedReportDays++;
      else if (['rejected', 'correction_requested', 'edit_requested'].includes(report.status)) {
        daysRequiringCorrection++;
      } else if (['submitted', 'under_review', 'resubmitted'].includes(report.status)) {
        pendingReviewDays++;
      }
    } else if (!leave && !isWeeklyOff && !isHoliday) {
      missingReportDays++;
    }

    const hasConflict = Boolean(isSubmittedReport && leave);
    if (hasConflict) conflictDays++;

    // Format Times & Locations strictly in Asia/Kolkata
    const loginTime = formatTimeIST(attendance?.loginTimestamp);
    const logoutTime = formatTimeIST(attendance?.logoutTimestamp);

    const loginLoc = getHumanPlaceName(attendance?.loginGps);
    const logoutLoc =
      attendance?.logoutType === 'automatic_midnight'
        ? 'Auto-closed at midnight (Location unavailable)'
        : getHumanPlaceName(attendance?.logoutGps);

    let summaryText = 'No activities recorded';
    const activitiesList: any[] = [];
    const attachments: ReportAttachment[] = [];

    if (hasActivities) {
      const actNames = mergedActivities.map((a) => {
        const base = resolveActivityNameLabel(a);
        return a.activityOther?.trim() ? `${base} (${a.activityOther.trim()})` : base;
      });
      summaryText = `${mergedActivities.length} activit${mergedActivities.length === 1 ? 'y' : 'ies'}: ${actNames.join(', ')}`;

      mergedActivities.forEach((act) => {
        const startLoc = getHumanPlaceName(act.activityStartLocation || act.activityStartGps);
        const endLoc = getHumanPlaceName(act.activityEndLocation || act.activityEndGps);
        const photos = mergeEvidenceUrls(act.photoUrl, act.photoEvidence);
        const videos = mergeEvidenceUrls(act.videoUrl, act.videoEvidence);
        const isSingle = isSingleFarmerActivity(act);
        const title = resolveActivityNameLabel(act);
        const durMins = act.activityDurationMinutes ?? act.durationMinutes ?? 0;

        activitiesList.push({
          slotNumber: act.slotNumber,
          activityStatus: act.activityStatus,
          activityName: act.activityName,
          activityNameLabel: title,
          activityOther: act.activityOther || '',
          activityType:
            act.activityName === 'desk_job' ? 'Office' : isSingle ? 'Single Farmer' : 'Group',
          village: act.village || '—',
          wadi: act.wadi || '—',
          farmerName: act.farmerName || '—',
          groupDetails: act.groupDetails || '',
          startTime: formatTimeIST(act.activityStartAt || act.activityStart),
          endTime: formatTimeIST(act.activityEndAt || act.activityEnd),
          startTimeIso: act.activityStartAt || act.activityStart || '',
          endTimeIso: act.activityEndAt || act.activityEnd || '',
          durationMinutes: durMins,
          participants: act.totalParticipants || 0,
          maleParticipants: act.maleParticipants || 0,
          femaleParticipants: act.femaleParticipants || 0,
          observations: act.observations || '—',
          issues: act.farmerIssues || '—',
          supportProvided: resolveSupportLabels(act),
          supportOther: act.supportOther || '',
          followUpRequired: Boolean(act.followUpRequired),
          followUpDetails: act.followUpDetails || '',
          followUpDate: act.followUpDate || '',
          startLocationName: startLoc,
          endLocationName: endLoc,
          startLocation: act.activityStartLocation || act.activityStartGps || null,
          endLocation: act.activityEndLocation || act.activityEndGps || null,
          photoUrls: photos,
          videoUrls: videos,
        });

        // Collect photo attachments
        photos.forEach((url, pIdx) => {
          attachments.push({
            id: `att_${report?.id || dateStr}_${act.slotNumber}_p${pIdx}`,
            reportId: report?.id || `field_rep_${staffUid}_${dateStr}`,
            staffUid,
            uploadedByUid: staffUid,
            storagePath: url,
            downloadUrl: url,
            originalFilename: inferFilenameFromUrl(url, `Activity_${act.slotNumber}_Photo_${pIdx + 1}.jpg`),
            caption: `Slot #${act.slotNumber}: ${title}${act.village ? ` (${act.village})` : ''}`,
            fileSize: 0,
            mimeType: 'image/jpeg',
            uploadedAt: act.activityEndAt || act.activityStartAt || new Date().toISOString(),
          });
        });

        // Collect video attachments
        videos.forEach((url, vIdx) => {
          attachments.push({
            id: `att_${report?.id || dateStr}_${act.slotNumber}_v${vIdx}`,
            reportId: report?.id || `field_rep_${staffUid}_${dateStr}`,
            staffUid,
            uploadedByUid: staffUid,
            storagePath: url,
            downloadUrl: url,
            originalFilename: inferFilenameFromUrl(url, `Activity_${act.slotNumber}_Video_${vIdx + 1}.mp4`),
            caption: `Slot #${act.slotNumber}: ${title} Video`,
            fileSize: 0,
            mimeType: 'video/mp4',
            uploadedAt: act.activityEndAt || act.activityStartAt || new Date().toISOString(),
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

    let statusLabel: MonthlyReportDay['reportStatus'] = 'Missing';
    if (isSubmittedReport && report) {
      if (report.status === 'approved') statusLabel = 'Approved';
      else if (['rejected', 'correction_requested', 'edit_requested'].includes(report.status)) {
        statusLabel = 'Correction Requested';
      } else if (['submitted', 'under_review', 'resubmitted'].includes(report.status)) {
        statusLabel = 'Submitted';
      }
    } else if (hasActivities) {
      statusLabel = 'In Progress' as any;
    } else if (leave) {
      statusLabel = 'On Leave';
    } else if (isHoliday) {
      statusLabel = 'Holiday' as any;
    } else if (isWeeklyOff) {
      statusLabel = 'Weekly Off' as any;
    }

    const reviewerName = report?.reviewerName;
    const reviewStatusText = reviewerName
      ? `${report?.status === 'approved' ? 'Approved' : 'Reviewed'} by ${reviewerName}`
      : report?.status === 'approved'
      ? 'Approved'
      : isSubmittedReport
      ? 'Pending Review'
      : '—';

    let remarksText = report?.reviewComments || report?.editRequest?.reason || '—';
    if (hasConflict) {
      remarksText = `[CONFLICT] Activity reported on approved ${leave?.leaveType?.toUpperCase()} leave. ${
        remarksText !== '—' ? remarksText : ''
      }`;
    }

    const subTime = report?.submittedAt ? formatTimeIST(report.submittedAt) : '—';

    days.push({
      date: dateStr,
      dayNumber: d,
      dayOfWeek,
      dailyActivity: summaryText,
      reportStatus: statusLabel,
      submissionTime: subTime,
      submittedAt: report?.submittedAt ? formatDateTimeIST(report.submittedAt) : undefined,
      reviewStatus: reviewStatusText,
      reviewerName: report?.reviewerName,
      remarks: remarksText,
      reportId: report?.id,
      leaveId: leave?.id,
      leaveType: leave?.leaveType,
      crpCode: report?.crpCode || '',
      blockTaluka: report?.blockTaluka || '',
      farmersVisited: daySummary?.totalParticipantContacts || 0,
      meetingsConducted: mergedActivities.filter(
        (a) => !isSingleFarmerActivity(a) && a.activityName !== 'desk_job'
      ).length,
      hasConflict,
      conflictDetails: hasConflict
        ? `Conflict: Report submitted on approved ${leave?.leaveType} leave date.`
        : undefined,
      attachments,
      attendanceStatus: attendance
        ? attendance.status === 'active'
          ? 'Active'
          : 'Present'
        : leave
        ? 'On Leave'
        : isHoliday
        ? 'Holiday'
        : isWeeklyOff
        ? 'Weekly Off'
        : 'Absent',
      loginTime,
      logoutTime,
      loginLocationName: loginLoc,
      logoutLocationName: logoutLoc,
      activitiesCount: mergedActivities.length,
      activitiesList,
      activityDurationMinutes: daySummary?.totalActivityMinutes || 0,
      workingPeriodMinutes: daySummary?.totalWorkingPeriodMinutes || 0,
      participantCount: daySummary?.totalParticipantContacts || 0,
      maleParticipants: daySummary?.totalMaleParticipants || 0,
      femaleParticipants: daySummary?.totalFemaleParticipants || 0,
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
