import { NextResponse } from 'next/server';
import {
  requireMobileAuth,
  apiSuccess,
  apiError,
  parseAndValidate,
  MobileActivityUpdateSchema,
} from '@/lib/api/v1-helper';
import { fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { ActivityChoiceKey, FieldActivityRecord } from '@/types';
import { updateFieldActivityProgress } from '@/lib/services/field-activity-service';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireMobileAuth(req);
    const { id: activityId } = await params;

    const activity = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, activityId)) as FieldActivityRecord | null;

    if (!activity) {
      return apiError('Activity not found in database.', 404);
    }

    // Ownership check: staff can only view own activity
    if (user.role === 'staff' && activity.staffUid !== user.uid) {
      return apiError('FORBIDDEN: You cannot access another employee\'s activity.', 403);
    }

    return apiSuccess(activity);
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireMobileAuth(req);
    const { id: activityId } = await params;

    const { data, errorResponse } = await parseAndValidate(req, MobileActivityUpdateSchema);
    if (errorResponse) return errorResponse;

    const activityTypeChoice: 'single_farmer' | 'group' | undefined =
      data!.activityType === 'single_farmer'
        ? 'single_farmer'
        : data!.activityType
        ? 'group'
        : undefined;

    const result = await updateFieldActivityProgress(user, activityId, {
      activityName: data!.activityName as ActivityChoiceKey | undefined,
      activityNameLabel: data!.activityNameLabel,
      activityOther: data!.activityOther ?? undefined,
      village: data!.village ?? undefined,
      wadi: data!.wadi ?? undefined,
      activityType: activityTypeChoice,
      farmerName: data!.farmerName ?? undefined,
      totalParticipants: data!.totalParticipants,
      maleParticipants: data!.maleParticipants,
      femaleParticipants: data!.femaleParticipants,
      observations: data!.observations ?? undefined,
      farmerIssues: data!.farmerIssues ?? undefined,
      supportProvided: data!.supportProvided,
      followUpRequired: data!.followUpRequired,
      followUpDetails: data!.followUpDetails ?? undefined,
      followUpDate: data!.followUpDate ?? undefined,
      photoUrl: data!.photoUrl ?? undefined,
      videoUrl: data!.videoUrl ?? undefined,
    });

    if (!result.success) {
      return apiError(result.error || 'Failed to update activity.', 400);
    }

    return apiSuccess(
      {
        activity: result.activity,
        serverTimestamp: new Date().toISOString(),
        clientTimestamp: data!.clientTimestamp || null,
        syncStatus: 'synced',
      },
      'Activity progress updated successfully'
    );
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}
