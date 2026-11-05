import { NextResponse } from 'next/server';
import {
  requireMobileAuth,
  apiSuccess,
  apiError,
  parseAndValidate,
  MobileActivityEndSchema,
} from '@/lib/api/v1-helper';
import { endFieldActivity } from '@/lib/services/field-activity-service';
import { GpsCoordinate, LocationCaptureStatus } from '@/types';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireMobileAuth(req);
    const { id: activityId } = await params;

    const { data, errorResponse } = await parseAndValidate(req, MobileActivityEndSchema);
    if (errorResponse) return errorResponse;

    const endGps: GpsCoordinate | null = data!.endGps
      ? {
          latitude: data!.endGps.latitude,
          longitude: data!.endGps.longitude,
          accuracy: data!.endGps.accuracy ?? 0,
          timestamp: data!.endGps.timestamp || new Date().toISOString(),
          capturedAt: data!.endGps.timestamp || new Date().toISOString(),
          placeName: data!.endGps.placeName ?? undefined,
        }
      : null;

    const locStatus: LocationCaptureStatus =
      data!.locationStatus === 'captured'
        ? 'captured'
        : data!.locationStatus === 'permission_denied'
        ? 'denied'
        : 'unavailable';

    const finalDetails = data!.finalDetails
      ? {
          village: data!.finalDetails.village ?? undefined,
          wadi: data!.finalDetails.wadi ?? undefined,
          farmerName: data!.finalDetails.farmerName ?? undefined,
          observations: data!.finalDetails.observations ?? undefined,
          farmerIssues: data!.finalDetails.farmerIssues ?? undefined,
          supportProvided: data!.finalDetails.supportProvided,
          photoUrl: data!.finalDetails.photoUrl ?? undefined,
          videoUrl: data!.finalDetails.videoUrl ?? undefined,
          totalParticipants: data!.finalDetails.totalParticipants,
          maleParticipants: data!.finalDetails.maleParticipants,
          femaleParticipants: data!.finalDetails.femaleParticipants,
        }
      : undefined;

    const result = await endFieldActivity(user, activityId, {
      endGps,
      locationStatus: locStatus,
      finalDetails,
    });

    if (!result.success) {
      return apiError(result.error || 'Failed to end activity.', 400);
    }

    return apiSuccess(
      {
        activity: result.activity,
        durationMinutes: result.activity?.durationMinutes || 0,
        activityStatus: 'COMPLETED',
        serverTimestamp: new Date().toISOString(),
        clientTimestamp: data!.clientTimestamp || null,
        syncStatus: 'synced',
      },
      'Activity completed and verified successfully'
    );
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}
