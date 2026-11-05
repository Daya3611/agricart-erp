import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { AttendanceSession } from '@/types';
import { closeStaleMidnightSessions } from '@/lib/services/attendance-service';
import { getOperationalDateString } from '@/lib/utils/date-utils';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req, ['super_admin', 'admin', 'manager']);
    const { searchParams } = new URL(req.url);

    await closeStaleMidnightSessions();

    const dateParam = searchParams.get('date');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const departmentId = searchParams.get('departmentId');
    const centerId = searchParams.get('centerId');
    const status = searchParams.get('status')?.toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    let queryFilters: { field: string; op: any; value: any }[] = [];
    if (dateParam) {
      queryFilters.push({ field: 'date', op: '==', value: dateParam });
    }

    let sessions = (await fetchCollection(ERP_COLLECTIONS.attendanceSessions, queryFilters)) as AttendanceSession[];

    // Scoping for manager
    if (user.role === 'manager') {
      sessions = sessions.filter(
        (s) =>
          (user.departmentId && s.departmentId === user.departmentId) ||
          user.assignedCenterIds?.includes(s.centerId)
      );
    }

    // Additional filters
    if (startDateParam || endDateParam) {
      if (startDateParam) sessions = sessions.filter((s) => s.date >= startDateParam);
      if (endDateParam) sessions = sessions.filter((s) => s.date <= endDateParam);
    }
    if (departmentId && departmentId !== 'all') {
      sessions = sessions.filter((s) => s.departmentId === departmentId);
    }
    if (centerId && centerId !== 'all') {
      sessions = sessions.filter((s) => s.centerId === centerId);
    }
    if (status && status !== 'all') {
      sessions = sessions.filter((s) => s.status?.toLowerCase() === status);
    }

    // Sort descending by date, then login timestamp
    sessions.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.loginAt || '').localeCompare(a.loginAt || '');
    });

    const total = sessions.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedSessions = sessions.slice(startIndex, startIndex + limit);

    return apiSuccess(paginatedSessions, undefined, {
      total,
      page,
      limit,
      totalPages,
      activeCount: sessions.filter((s) => s.status === 'active').length,
      closedCount: sessions.filter((s) => s.status === 'closed').length,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

