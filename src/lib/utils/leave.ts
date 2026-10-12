/**
 * Calculates number of leave days inclusive of start and end date.
 * If half-day is checked and start date equals end date, returns 0.5.
 */
export function calculateLeaveDays(startDate: string, endDate: string, isHalfDay = false): number {
  if (!startDate || !endDate) return 0;
  if (isHalfDay && startDate === endDate) {
    return 0.5;
  }
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const diffTime = end.getTime() - start.getTime();
  if (diffTime < 0) return 0;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diffDays, 1);
}
