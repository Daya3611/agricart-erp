import { format, subDays, startOfMonth, endOfMonth, parseISO, isAfter } from 'date-fns';

export function getOperationalDateString(date: Date = new Date(), timeZone = 'Asia/Kolkata'): string {
  // Format as YYYY-MM-DD in the specified timezone (Agricart default: Asia/Kolkata)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function normalizeReportDate(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return getOperationalDateString();
  }
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const d = parseISO(trimmed);
    if (!isNaN(d.getTime())) {
      return format(d, 'yyyy-MM-dd');
    }
  } catch {
    // fallback to current operational date
  }
  return getOperationalDateString();
}

export function getTodayDateString(): string {
  return getOperationalDateString();
}

/**
 * Returns the operational calendar { year, month } in the specified timezone (default: Asia/Kolkata).
 * Avoids UTC boundary shifts around month-end.
 */
export function getOperationalYearMonth(
  date: Date = new Date(),
  timeZone = 'Asia/Kolkata'
): { year: number; month: number } {
  const dateStr = getOperationalDateString(date, timeZone);
  const [y, m] = dateStr.split('-').map(Number);
  return { year: y, month: m };
}

/**
 * Returns minutes since 00:00 (0..1439) in the specified timezone using 24-hour clock (h23).
 */
export function getTimeZoneMinutesOfDay(date: Date = new Date(), timeZone = 'Asia/Kolkata'): number {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  const [hourStr, minStr] = formatted.split(':');
  const h = Number(hourStr);
  const m = Number(minStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function formatReadableDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = parseISO(dateStr);
    return format(d, 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

export function formatTimeIST(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(isoStr);
  }
}

export function formatTime24IST(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return String(isoStr);
  }
}

export function formatDateTimeIST(isoStr?: string | null): string {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(isoStr);
  }
}

export function formatReadableDateTime(isoStr?: string): string {
  return formatDateTimeIST(isoStr);
}

export function getDateRangeFromPreset(preset: string): { startDate: string; endDate: string } {
  const now = new Date();
  const todayStr = getOperationalDateString(now);

  switch (preset) {
    case 'all':
    case 'all_time':
      return { startDate: '1970-01-01', endDate: '2099-12-31' };
    case 'today':
      return { startDate: todayStr, endDate: todayStr };
    case 'yesterday': {
      const y = subDays(now, 1);
      const yStr = getOperationalDateString(y);
      return { startDate: yStr, endDate: yStr };
    }
    case 'last7': {
      const d = subDays(now, 6);
      return { startDate: getOperationalDateString(d), endDate: todayStr };
    }
    case 'last30': {
      const d = subDays(now, 29);
      return { startDate: getOperationalDateString(d), endDate: todayStr };
    }
    case 'this_month': {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return { startDate: getOperationalDateString(start), endDate: getOperationalDateString(end) };
    }
    case 'fy': {
      // Indian Financial Year: April 1 to March 31
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed (0 = Jan, 3 = April)
      const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
      const fyEndYear = fyStartYear + 1;
      return {
        startDate: `${fyStartYear}-04-01`,
        endDate: `${fyEndYear}-03-31`,
      };
    }
    default:
      return { startDate: '1970-01-01', endDate: '2099-12-31' };
  }
}

export function checkIfLateSubmission(reportDate: string, submissionIsoTime: string, deadlineTimeStr = '19:00'): boolean {
  try {
    const [hours, minutes] = deadlineTimeStr.split(':').map(Number);
    // Agricart FPC operational timezone is Asia/Kolkata (+05:30)
    const deadlineDate = new Date(`${reportDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+05:30`);
    const actualSubmission = new Date(submissionIsoTime);
    return isAfter(actualSubmission, deadlineDate);
  } catch {
    return false;
  }
}
