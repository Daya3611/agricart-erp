import { AttendanceSession } from '@/types';
import { getOperationalDateString, getTimeZoneMinutesOfDay } from '@/lib/utils/date-utils';

export type ResolvedAttendanceStatus =
  | 'Present'
  | 'In Progress'
  | 'On Leave'
  | 'Holiday'
  | 'Weekly Off'
  | 'Upcoming'
  | 'Absent';

export interface AttendanceCutoffContext {
  timeZone: string;
  todayStr: string;
  nowMinutes: number;
  cutoffMinutes: number;
}

export interface DailyStatusResolution {
  attendanceStatus: ResolvedAttendanceStatus;
  reportStatusAggregator: string;
  reportStatusSummary: string;
  submissionStatus: string;
  isFuture: boolean;
  isToday: boolean;
  isCutoffPassed: boolean;
  isMissingAttendance: boolean;
  isMissingReport: boolean;
  isMissingActivity: boolean;
  isMissing: boolean;
}

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

/**
 * Normalizes workingDays arrays containing either numeric day indices (0..6) or day names ('Mon', 'Monday', etc.).
 */
export function normalizeWorkingDayIndices(
  workingDays?: Array<number | string> | null,
  fallback: number[] = [1, 2, 3, 4, 5, 6]
): number[] {
  if (!Array.isArray(workingDays) || workingDays.length === 0) {
    return fallback;
  }
  const normalized = new Set<number>();
  for (const item of workingDays) {
    if (typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 6) {
      normalized.add(item);
    } else if (typeof item === 'string') {
      const idx = DAY_NAME_TO_INDEX[item.trim().toLowerCase()];
      if (idx !== undefined) normalized.add(idx);
    }
  }
  return normalized.size > 0 ? Array.from(normalized) : fallback;
}

/**
 * Parses a "HH:MM" time string plus optional grace minutes into minutes since 00:00.
 */
export function parseCutoffMinutes(cutoffTime?: string | null, graceMinutes = 0): number {
  const raw = (cutoffTime || '19:00').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  const hours = match ? Math.min(23, Math.max(0, Number(match[1]))) : 19;
  const minutes = match ? Math.min(59, Math.max(0, Number(match[2]))) : 0;
  const grace = Number.isFinite(graceMinutes) && graceMinutes > 0 ? Math.round(graceMinutes) : 0;
  return hours * 60 + minutes + grace;
}

/**
 * Builds the operational date & cutoff comparison context in the configured timezone (default: Asia/Kolkata).
 */
export function buildAttendanceCutoffContext(params?: {
  now?: Date;
  timeZone?: string | null;
  cutoffTime?: string | null;
  graceMinutes?: number;
}): AttendanceCutoffContext {
  const now = params?.now || new Date();
  const timeZone = params?.timeZone || 'Asia/Kolkata';
  return {
    timeZone,
    todayStr: getOperationalDateString(now, timeZone),
    nowMinutes: getTimeZoneMinutesOfDay(now, timeZone),
    cutoffMinutes: parseCutoffMinutes(params?.cutoffTime, params?.graceMinutes || 0),
  };
}

/**
 * Determines whether attendance cutoff has elapsed for a given YYYY-MM-DD calendar date.
 * - Past dates (< todayStr): true
 * - Future dates (> todayStr): false
 * - Current date (=== todayStr): true only once operational local time reaches cutoff
 */
export function hasAttendanceCutoffPassedForDate(
  dateStr: string,
  ctx: AttendanceCutoffContext
): boolean {
  if (dateStr < ctx.todayStr) return true;
  if (dateStr > ctx.todayStr) return false;
  return ctx.nowMinutes >= ctx.cutoffMinutes;
}

/**
 * Returns true if an attendance session has login recorded without completed logout.
 */
export function isIncompleteAttendanceSession(attendance?: AttendanceSession | null): boolean {
  if (!attendance) return false;
  if (attendance.status === 'active' || attendance.attendanceStatus === 'active') {
    return true;
  }
  const hasLogout = Boolean(
    (attendance.logoutTimestamp && String(attendance.logoutTimestamp).trim()) ||
      (attendance.logoutAt && String(attendance.logoutAt).trim())
  );
  return !hasLogout;
}

/**
 * Resolves attendance status, report status, and missing flags consistently for a single calendar day.
 * Guarantees future dates and pre-cutoff current day are never marked Absent or Missing Attendance,
 * while never overriding Weekly Off, Holiday, or Approved Leave with Upcoming.
 */
export function resolveDailyAttendanceAndReportState(params: {
  dateStr: string;
  cutoffCtx: AttendanceCutoffContext;
  attendance?: AttendanceSession | null;
  leave?: { leaveType?: string; approvalStatus?: string } | null;
  isHoliday: boolean;
  isWeeklyOff: boolean;
  hasActivities: boolean;
  hasSubmittedReport: boolean;
  reportStatus?: string | null;
}): DailyStatusResolution {
  const {
    dateStr,
    cutoffCtx,
    attendance,
    leave,
    isHoliday,
    isWeeklyOff,
    hasActivities,
    hasSubmittedReport,
    reportStatus,
  } = params;

  const isFuture = dateStr > cutoffCtx.todayStr;
  const isToday = dateStr === cutoffCtx.todayStr;
  const isCutoffPassed = hasAttendanceCutoffPassedForDate(dateStr, cutoffCtx);
  const incompleteLogout = isIncompleteAttendanceSession(attendance);

  // 1. Attendance Status strictly follows the priority order:
  //    Attendance (In Progress / Present) -> Approved Leave -> Holiday -> Weekly Off -> Upcoming (future or pre-cutoff today) -> Absent
  let attendanceStatus: ResolvedAttendanceStatus;
  if (attendance) {
    attendanceStatus = incompleteLogout ? 'In Progress' : 'Present';
  } else if (leave) {
    attendanceStatus = 'On Leave';
  } else if (isHoliday) {
    attendanceStatus = 'Holiday';
  } else if (isWeeklyOff) {
    attendanceStatus = 'Weekly Off';
  } else if (isFuture || !isCutoffPassed) {
    attendanceStatus = 'Upcoming';
  } else {
    attendanceStatus = 'Absent';
  }

  // 2. Missing flags apply only on scheduled workdays whose cutoff has elapsed
  const isScheduledWorkday = !isWeeklyOff && !isHoliday;
  const isMissingAttendance = Boolean(isScheduledWorkday && isCutoffPassed && !attendance && !leave);
  const isMissingReport = Boolean(isScheduledWorkday && isCutoffPassed && !hasSubmittedReport && !leave);
  const isMissingActivity = Boolean(isScheduledWorkday && isCutoffPassed && attendance && !hasSubmittedReport && !leave);

  // 3. Aggregator (Admin Monthly & Excel) Report Status
  let reportStatusAggregator: string;
  if (hasSubmittedReport && reportStatus) {
    if (reportStatus === 'approved') reportStatusAggregator = 'Approved';
    else if (reportStatus === 'correction_requested' || reportStatus === 'edit_requested') {
      reportStatusAggregator = 'Correction Required';
    } else if (reportStatus === 'rejected') reportStatusAggregator = 'Rejected';
    else reportStatusAggregator = 'Submitted';
  } else if (hasActivities) {
    reportStatusAggregator = 'In Progress';
  } else if (leave) {
    reportStatusAggregator = 'On Leave';
  } else if (isHoliday) {
    reportStatusAggregator = 'Holiday';
  } else if (isWeeklyOff) {
    reportStatusAggregator = 'Weekly Off';
  } else if (attendance) {
    reportStatusAggregator = attendanceStatus === 'In Progress' ? 'In Progress' : 'Present';
  } else if (isFuture || !isCutoffPassed) {
    reportStatusAggregator = 'Upcoming';
  } else {
    reportStatusAggregator = 'Missing Attendance';
  }

  // 4. Single-Employee Summary (Staff Monthly UI / PDF / DOCX) Report Status
  let reportStatusSummary: string;
  if (hasSubmittedReport && reportStatus) {
    if (reportStatus === 'approved') reportStatusSummary = 'Approved';
    else if (['rejected', 'correction_requested', 'edit_requested'].includes(reportStatus)) {
      reportStatusSummary = 'Correction Requested';
    } else {
      reportStatusSummary = 'Submitted';
    }
  } else if (hasActivities) {
    reportStatusSummary = 'In Progress';
  } else if (leave) {
    reportStatusSummary = 'On Leave';
  } else if (isHoliday) {
    reportStatusSummary = 'Holiday';
  } else if (isWeeklyOff) {
    reportStatusSummary = 'Weekly Off';
  } else if (attendance) {
    reportStatusSummary = attendanceStatus === 'In Progress' ? 'In Progress' : 'Present';
  } else if (isFuture || !isCutoffPassed) {
    reportStatusSummary = 'Upcoming';
  } else {
    reportStatusSummary = 'Missing';
  }

  // 5. Submission Status column (Excel/UI)
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
            : isFuture || !isCutoffPassed
              ? 'Upcoming'
              : 'Missing';

  return {
    attendanceStatus,
    reportStatusAggregator,
    reportStatusSummary,
    submissionStatus,
    isFuture,
    isToday,
    isCutoffPassed,
    isMissingAttendance,
    isMissingReport,
    isMissingActivity,
    isMissing: reportStatusAggregator === 'Missing' || reportStatusAggregator === 'Missing Attendance',
  };
}

/**
 * Calculates attendance percentage strictly from elapsed working days up to cutoff,
 * ensuring future dates never lower attendance percentage or inflate absence counts.
 * Returns null when zero expected working days have elapsed and no attendance was logged yet.
 */
export function calculateAttendancePercentage(params: {
  daysAttended: number;
  elapsedWorkingDays: number;
  elapsedLeaveOnWorkdays: number;
  leaveCountsAsWorkingDay?: boolean;
}): number | null {
  const { daysAttended, elapsedWorkingDays, elapsedLeaveOnWorkdays, leaveCountsAsWorkingDay = false } = params;
  const expectedElapsedDays = leaveCountsAsWorkingDay
    ? elapsedWorkingDays
    : Math.max(0, elapsedWorkingDays - elapsedLeaveOnWorkdays);
  const denominator = Math.max(daysAttended, expectedElapsedDays);
  if (denominator <= 0) {
    return null;
  }
  return Math.min(100, Math.round((daysAttended / denominator) * 1000) / 10);
}
