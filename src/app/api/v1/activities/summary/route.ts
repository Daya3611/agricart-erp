import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { getStaffActivitiesForDate } from '@/lib/services/field-activity-service';
import { calculateActivitiesSummary } from '@/lib/utils/field-activity-calculations';
import { getOperationalDateString, normalizeReportDate } from '@/lib/utils/date-utils';
import { getTodayAttendanceSession } from '@/lib/services/attendance-service';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);
    const { searchParams } = new URL(req.url);

    const dateParam = searchParams.get('date') || getOperationalDateString();
    const normalizedDate = normalizeReportDate(dateParam);
    const targetUid = searchParams.get('employeeUid') || user.uid;

    if (user.role === 'staff' && targetUid !== user.uid) {
      return apiError('FORBIDDEN: You cannot view another employee\'s summary.', 403);
    }

    const activities = await getStaffActivitiesForDate(targetUid, normalizedDate);
    const { summary, errors } = calculateActivitiesSummary(activities as any);
    const attendanceSession = await getTodayAttendanceSession(targetUid);

    return apiSuccess({
      date: normalizedDate,
      employeeUid: targetUid,
      summary,
      activitiesCount: activities.length,
      inProgressCount: activities.filter((a) => a.activityStatus === 'IN_PROGRESS').length,
      completedCount: activities.filter((a) => a.activityStatus === 'COMPLETED').length,
      validationErrors: errors,
      attendance: attendanceSession ? {
        status: attendanceSession.status,
        loginAt: attendanceSession.loginAt,
        logoutAt: attendanceSession.logoutAt,
        durationMinutes: attendanceSession.durationMinutes,
      } : null,
      activities,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

