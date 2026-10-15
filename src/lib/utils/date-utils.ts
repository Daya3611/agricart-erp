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

export function formatReadableDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = parseISO(dateStr);
    return format(d, 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

export function formatReadableDateTime(isoStr?: string): string {
  if (!isoStr) return 'N/A';
  try {
    const d = parseISO(isoStr);
    return format(d, 'dd MMM yyyy, hh:mm a');
  } catch {
    return isoStr;
  }
}

export function getDateRangeFromPreset(preset: string): { startDate: string; endDate: string } {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  switch (preset) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };
    case 'yesterday': {
      const y = subDays(now, 1);
      const yStr = format(y, 'yyyy-MM-dd');
      return { startDate: yStr, endDate: yStr };
    }
    case 'last7': {
      const d = subDays(now, 6);
      return { startDate: format(d, 'yyyy-MM-dd'), endDate: todayStr };
    }
    case 'last30': {
      const d = subDays(now, 29);
      return { startDate: format(d, 'yyyy-MM-dd'), endDate: todayStr };
    }
    case 'this_month': {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') };
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
      return { startDate: format(subDays(now, 30), 'yyyy-MM-dd'), endDate: todayStr };
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
