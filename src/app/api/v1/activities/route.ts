import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { FieldActivityRecord } from '@/types';
import { getOperationalDateString, normalizeReportDate } from '@/lib/utils/date-utils';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);
    const { searchParams } = new URL(req.url);

    const targetUid = searchParams.get('employeeUid') || user.uid;

    // Staff can only view their own activities
    if (user.role === 'staff' && targetUid !== user.uid) {
      return apiError('FORBIDDEN: You cannot view another employee\'s activities.', 403);
    }

    const dateParam = searchParams.get('date');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const statusParam = searchParams.get('status')?.toUpperCase();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    let queryFilters: { field: string; op: any; value: any }[] = [
      { field: 'staffUid', op: '==', value: targetUid },
    ];

    if (dateParam) {
      queryFilters.push({ field: 'reportDate', op: '==', value: normalizeReportDate(dateParam) });
    }

    let activities = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, queryFilters)) as FieldActivityRecord[];

    // Range filtering
    if (startDateParam || endDateParam) {
      if (startDateParam) activities = activities.filter((a) => a.reportDate >= startDateParam);
      if (endDateParam) activities = activities.filter((a) => a.reportDate <= endDateParam);
    }

    // Status filtering
    if (statusParam && statusParam !== 'ALL') {
      activities = activities.filter(
        (a) => (a.activityStatus?.toUpperCase() || '') === statusParam
      );
    }

    // Sort: primarily by reportDate descending, then by slotNumber ascending
    activities.sort((a, b) => {
      const dateCmp = b.reportDate.localeCompare(a.reportDate);
      if (dateCmp !== 0) return dateCmp;
      return (a.slotNumber || 0) - (b.slotNumber || 0);
    });

    const total = activities.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedActivities = activities.slice(startIndex, startIndex + limit);

    return apiSuccess(paginatedActivities, undefined, {
      total,
      page,
      limit,
      totalPages,
      employeeUid: targetUid,
      date: dateParam || undefined,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

