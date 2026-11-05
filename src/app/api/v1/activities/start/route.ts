import { NextResponse } from 'next/server';
import {
  requireMobileAuth,
  apiSuccess,
  apiError,
  parseAndValidate,
  checkRateLimit,
  MobileActivityStartSchema,
} from '@/lib/api/v1-helper';
import { startFieldActivity } from '@/lib/services/field-activity-service';
import { fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { ActivityChoiceKey, FieldActivityRecord, GpsCoordinate, LocationCaptureStatus } from '@/types';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function POST(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);

    // Rate limiting: 20 activity starts per minute per employee
    if (!checkRateLimit(`act_start_${user.uid}`, 20, 60)) {
      return apiError('Too many activity start requests. Please slow down.', 429, undefined, 'RATE_LIMITED');
    }

    const { data, errorResponse } = await parseAndValidate(req, MobileActivityStartSchema);
    if (errorResponse) return errorResponse;

    const chosenId = data!.clientActivityId || data!.activityId;

    // Idempotency check for offline retries: if an activity with this UUID already exists, return it
    if (chosenId) {
      const existing = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, chosenId)) as FieldActivityRecord | null;
      if (existing) {
        if (existing.staffUid !== user.uid) {
          return apiError('FORBIDDEN: Activity UUID belongs to another employee.', 403);
        }
        return apiSuccess(
          {
            activity: existing,
            activityId: existing.id || chosenId,
            isIdempotentReplay: true,
            syncStatus: 'synced',
          },
          'Activity retrieved from existing sync'
        );
      }
    }

    const gpsInput: GpsCoordinate | null = data!.gps
      ? {
          latitude: data!.gps.latitude,
          longitude: data!.gps.longitude,
          accuracy: data!.gps.accuracy ?? 0,
          timestamp: data!.gps.timestamp || new Date().toISOString(),
          capturedAt: data!.gps.timestamp || new Date().toISOString(),
          placeName: data!.gps.placeName ?? undefined,
        }
      : null;

    const locStatus: LocationCaptureStatus =
      data!.locationStatus === 'captured'
        ? 'captured'
        : data!.locationStatus === 'permission_denied'
        ? 'denied'
        : 'unavailable';

    const activityTypeChoice: 'single_farmer' | 'group' =
      data!.activityType === 'single_farmer' ? 'single_farmer' : 'group';

    const result = await startFieldActivity(user, {
      activityId: chosenId,
      slotNumber: data!.slotNumber,
      reportDate: data!.reportDate,
      activityName: data!.activityName as ActivityChoiceKey,
      activityNameLabel: data!.activityNameLabel,
      activityOther: data!.activityOther ?? undefined,
      village: data!.village ?? undefined,
      wadi: data!.wadi ?? undefined,
      gps: gpsInput,
      locationStatus: locStatus,
      initialDetails: {
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
      },
    });

    if (!result.success) {
      return apiError(result.error || 'Failed to start activity.', 400);
    }

    return apiSuccess(
      {
        activity: result.activity,
        activityId: result.activityId,
        serverTimestamp: new Date().toISOString(),
        clientTimestamp: data!.clientTimestamp || null,
        syncStatus: 'synced',
      },
      'Activity started and saved to database',
      undefined,
      201
    );
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}
