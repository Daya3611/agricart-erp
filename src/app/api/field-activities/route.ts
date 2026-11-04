import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, hasRolePermission } from '@/lib/auth/permissions';
import {
  getStaffActivitiesForDate,
  getLiveActivitiesForAdmin,
} from '@/lib/services/field-activity-service';
import { getOperationalDateString } from '@/lib/utils/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const isAdminOrManager = hasRolePermission(sessionUser.role, 'manager');
    const targetStaffUid = searchParams.get('staffUid') || (!isAdminOrManager ? sessionUser.uid : undefined);
    const date = searchParams.get('date') || getOperationalDateString();
    const live = searchParams.get('live') === 'true';

    // If staff tries to access another staff's activities, forbid
    if (!isAdminOrManager && targetStaffUid && targetStaffUid !== sessionUser.uid) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN: You can only view your own activities.' }, { status: 403 });
    }

    if (live && isAdminOrManager) {
      const liveData = await getLiveActivitiesForAdmin(date);
      return NextResponse.json({
        success: true,
        activeActivities: liveData.activeActivities,
        recentCompleted: liveData.recentCompleted,
      });
    }

    if (targetStaffUid) {
      const activities = await getStaffActivitiesForDate(targetStaffUid, date);
      return NextResponse.json({
        success: true,
        activities,
      });
    }

    if (isAdminOrManager) {
      const liveData = await getLiveActivitiesForAdmin(date);
      return NextResponse.json({
        success: true,
        activeActivities: liveData.activeActivities,
        recentCompleted: liveData.recentCompleted,
      });
    }

    const activities = await getStaffActivitiesForDate(sessionUser.uid, date);
    return NextResponse.json({
      success: true,
      activities,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message, activities: [] }, { status });
  }
}
