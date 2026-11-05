import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { FieldActivityRecord } from '@/types';
import { getLiveActivitiesForAdmin } from '@/lib/services/field-activity-service';
import { getOperationalDateString, normalizeReportDate } from '@/lib/utils/date-utils';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req, ['super_admin', 'admin', 'manager']);
    const { searchParams } = new URL(req.url);

    const view = searchParams.get('view')?.toLowerCase();
    const dateParam = searchParams.get('date');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const staffUid = searchParams.get('staffUid');
    const departmentId = searchParams.get('departmentId');
    const centerId = searchParams.get('centerId');
    const status = searchParams.get('status')?.toUpperCase();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    // Live view shortcut
    if (view === 'live') {
      const live = await getLiveActivitiesForAdmin(dateParam || undefined);
      return apiSuccess(live, 'Active live operations monitor');
    }

    let queryFilters: { field: string; op: any; value: any }[] = [];

    if (dateParam) {
      queryFilters.push({ field: 'reportDate', op: '==', value: normalizeReportDate(dateParam) });
    }
    if (staffUid) {
      queryFilters.push({ field: 'staffUid', op: '==', value: staffUid });
    }

    let activities = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, queryFilters)) as FieldActivityRecord[];

    // Scoping for manager
    if (user.role === 'manager') {
      activities = activities.filter(
        (a) =>
          (user.departmentId && a.departmentId === user.departmentId) ||
          Boolean(a.centerId && user.assignedCenterIds?.includes(a.centerId))
      );
    }

    // Range filtering
    if (startDateParam || endDateParam) {
      if (startDateParam) activities = activities.filter((a) => a.reportDate >= startDateParam);
      if (endDateParam) activities = activities.filter((a) => a.reportDate <= endDateParam);
    }
    if (departmentId && departmentId !== 'all') {
      activities = activities.filter((a) => a.departmentId === departmentId);
    }
    if (centerId && centerId !== 'all') {
      activities = activities.filter((a) => a.centerId === centerId);
    }
    if (status && status !== 'ALL') {
      activities = activities.filter((a) => (a.activityStatus?.toUpperCase() || '') === status);
    }

    // Sort descending by reportDate, then activity start time
    activities.sort((a, b) => {
      const dateCmp = b.reportDate.localeCompare(a.reportDate);
      if (dateCmp !== 0) return dateCmp;
      return (b.activityStartAt || '').localeCompare(a.activityStartAt || '');
    });

    const total = activities.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = activities.slice(startIndex, startIndex + limit);

    return apiSuccess(paginated, undefined, {
      total,
      page,
      limit,
      totalPages,
      inProgressCount: activities.filter((a) => a.activityStatus === 'IN_PROGRESS').length,
      completedCount: activities.filter((a) => a.activityStatus === 'COMPLETED').length,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}
