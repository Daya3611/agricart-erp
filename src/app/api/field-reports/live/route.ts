import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { FieldReport, FieldActivitySlot, FieldActivityRecord } from '@/types/field-activity';
import { getOperationalDateString } from '@/lib/utils/date-utils';
import {
  deduplicateActivityRecords,
  isActivityCompleted,
  isActivityInProgress,
} from '@/lib/utils/field-activity-calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();

    // Check admin or manager role
    if (!['super_admin', 'admin', 'manager'].includes(sessionUser.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN: Admin monitoring requires administrative privileges.',
          activeEmployees: [],
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || getOperationalDateString();
    const departmentId = searchParams.get('departmentId');
    const centerId = searchParams.get('centerId');

    // Fetch all activities for today from erp_field_activities, deduplicated by staffUid + slotNumber
    const rawDayActivities = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, [
      { field: 'reportDate', op: '==', value: date },
    ])) as FieldActivityRecord[];

    const dedupedDayActivities = deduplicateActivityRecords(
      rawDayActivities,
      (act) => `${act.staffUid || act.employeeUid}_${act.reportDate}_${Number(act.slotNumber) || 1}`
    );

    const liveActivities = dedupedDayActivities.filter((a) => isActivityInProgress(a));
    const completedActivities = dedupedDayActivities.filter((a) => isActivityCompleted(a));

    const activeList: any[] = [];
    const completedList: any[] = [];

    // Filter live activities by department or center if specified
    for (const act of liveActivities) {
      if (departmentId && departmentId !== 'all' && act.departmentId !== departmentId) continue;
      if (centerId && centerId !== 'all' && act.centerId !== centerId) continue;

      const startMs = new Date(act.activityStartAt || act.createdAt || Date.now()).getTime();
      const elapsedMins = Math.max(0, Math.round((Date.now() - startMs) / 60000));

      activeList.push({
        activityId: act.activityId || act.id,
        reportId: act.reportId || `field_rep_${act.staffUid}_${act.reportDate}`,
        staffUid: act.staffUid || act.employeeUid,
        staffName: act.employeeName || 'Staff Member',
        employeeId: act.employeeId,
        departmentName: act.departmentName || '',
        centerName: act.centerName || '',
        reportDate: act.reportDate,
        activeActivity: {
          slotNumber: act.slotNumber,
          activityStatus: 'IN_PROGRESS',
          activityName: act.activityName,
          activityNameLabel: act.activityNameLabel || act.activityName,
          village: act.village,
          wadi: act.wadi,
          activityStartAt: act.activityStartAt,
          activityStart: act.activityStartAt,
          activityStartLocation: act.activityStartLocation || act.activityStartGps,
          activityStartGps: act.activityStartLocation || act.activityStartGps,
          activityStartLocationStatus: act.activityStartLocationStatus,
          elapsedMinutes: elapsedMins,
        },
        completedCount: 0,
        totalDurationMinutes: elapsedMins,
      });
    }

    // Process completed activities
    for (const act of completedActivities) {
      if (departmentId && departmentId !== 'all' && act.departmentId !== departmentId) continue;
      if (centerId && centerId !== 'all' && act.centerId !== centerId) continue;

      completedList.push({
        activityId: act.activityId || act.id,
        reportId: act.reportId || `field_rep_${act.staffUid}_${act.reportDate}`,
        staffUid: act.staffUid || act.employeeUid,
        staffName: act.employeeName || 'Staff Member',
        employeeId: act.employeeId,
        departmentName: act.departmentName || '',
        centerName: act.centerName || '',
        reportDate: act.reportDate,
        activity: {
          slotNumber: act.slotNumber,
          activityStatus: 'COMPLETED',
          activityName: act.activityName,
          activityNameLabel: act.activityNameLabel || act.activityName,
          village: act.village,
          wadi: act.wadi,
          activityStartAt: act.activityStartAt,
          activityStart: act.activityStartAt,
          activityStartLocation: act.activityStartLocation || act.activityStartGps,
          activityEndAt: act.activityEndAt,
          activityEnd: act.activityEndAt,
          activityEndLocation: act.activityEndLocation || act.activityEndGps,
          durationMinutes: act.activityDurationMinutes || act.durationMinutes || 0,
        },
      });
    }

    // Sort completed by end time descending
    completedList.sort((a, b) => {
      const timeA = new Date(a.activity.activityEndAt || a.activity.activityEnd || 0).getTime();
      const timeB = new Date(b.activity.activityEndAt || b.activity.activityEnd || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({
      success: true,
      date,
      currentlyWorkingCount: activeList.length,
      activeEmployees: activeList,
      recentCompletedActivities: completedList.slice(0, 20),
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message, activeEmployees: [] }, { status });
  }
}
