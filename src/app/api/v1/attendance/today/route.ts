import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { getTodayAttendanceSession } from '@/lib/services/attendance-service';
import { getOperationalDateString } from '@/lib/utils/date-utils';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);
    const session = await getTodayAttendanceSession(user.uid);
    const todayStr = getOperationalDateString();

    const isCheckedIn = Boolean(session && session.status === 'active');
    const isCheckedOut = Boolean(session && session.status === 'closed');
    const isNotStarted = !session;

    return apiSuccess({
      date: todayStr,
      hasSession: Boolean(session),
      state: isCheckedOut ? 'LOGGED_OUT' : isCheckedIn ? 'LOGGED_IN' : 'NOT_LOGGED_IN',
      isCheckedIn,
      isCheckedOut,
      session,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

