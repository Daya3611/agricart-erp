import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, hasRolePermission } from '@/lib/auth/permissions';
import {
  getAttendanceSessionsForEmployee,
  getAllAttendanceSessionsForRange,
  getTodayAttendanceSession,
} from '@/lib/services/attendance-service';
import { getOperationalDateString } from '@/lib/utils/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const isAdminOrManager = hasRolePermission(sessionUser.role, 'manager');
    const targetEmployeeUid = searchParams.get('employeeUid') || (isAdminOrManager ? undefined : sessionUser.uid);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // If staff requests another employee's attendance, forbid
    if (!isAdminOrManager && targetEmployeeUid && targetEmployeeUid !== sessionUser.uid) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You can only view your own attendance records.' },
        { status: 403 }
      );
    }

    if (date) {
      const today = getOperationalDateString();
      if (date === today && targetEmployeeUid) {
        const session = await getTodayAttendanceSession(targetEmployeeUid);
        return NextResponse.json({
          success: true,
          sessions: session ? [session] : [],
        });
      }
    }

    const start = startDate || date || getOperationalDateString();
    const end = endDate || date || start;

    let sessions = [];
    if (targetEmployeeUid) {
      sessions = await getAttendanceSessionsForEmployee(targetEmployeeUid, start, end);
    } else if (isAdminOrManager) {
      sessions = await getAllAttendanceSessionsForRange(start, end);
    } else {
      sessions = await getAttendanceSessionsForEmployee(sessionUser.uid, start, end);
    }

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
