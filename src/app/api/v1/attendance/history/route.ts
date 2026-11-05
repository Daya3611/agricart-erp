import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { AttendanceSession } from '@/types';
import { closeStaleMidnightSessions } from '@/lib/services/attendance-service';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);
    const { searchParams } = new URL(req.url);

    await closeStaleMidnightSessions();

    const targetUid = searchParams.get('employeeUid') || user.uid;

    // Staff can only view their own attendance history
    if (user.role === 'staff' && targetUid !== user.uid) {
      return apiError('FORBIDDEN: You cannot view another employee\'s attendance.', 403);
    }

    const monthStr = searchParams.get('month'); // e.g. "11" or "2026-11"
    const yearStr = searchParams.get('year') || String(new Date().getFullYear());
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '31', 10)));

    // Fetch user's attendance sessions
    let sessions = (await fetchCollection(ERP_COLLECTIONS.attendanceSessions, [
      { field: 'employeeUid', op: '==', value: targetUid },
    ])) as AttendanceSession[];

    // Date range filtering
    if (startDateParam || endDateParam) {
      if (startDateParam) sessions = sessions.filter((s) => s.date >= startDateParam);
      if (endDateParam) sessions = sessions.filter((s) => s.date <= endDateParam);
    } else if (monthStr) {
      const formattedMonth = monthStr.length === 1 ? `0${monthStr}` : monthStr.includes('-') ? monthStr.split('-')[1] : monthStr;
      const prefix = `${yearStr}-${formattedMonth}`;
      sessions = sessions.filter((s) => s.date.startsWith(prefix));
    } else if (yearStr) {
      sessions = sessions.filter((s) => s.date.startsWith(yearStr));
    }

    // Sort descending by date
    sessions.sort((a, b) => b.date.localeCompare(a.date));

    const total = sessions.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedSessions = sessions.slice(startIndex, startIndex + limit);

    return apiSuccess(paginatedSessions, undefined, {
      total,
      page,
      limit,
      totalPages,
      employeeUid: targetUid,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

