import { NextResponse } from 'next/server';
import {
  requireMobileAuth,
  apiSuccess,
  apiError,
  parseAndValidate,
  checkRateLimit,
  MobileAttendanceCheckInSchema,
} from '@/lib/api/v1-helper';
import { recordAttendanceLogin } from '@/lib/services/attendance-service';
import { GpsCoordinate, LocationCaptureStatus } from '@/types';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function POST(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);

    // Rate limiting: 10 requests per minute per user for check-in
    if (!checkRateLimit(`checkin_${user.uid}`, 10, 60)) {
      return apiError('Too many check-in requests. Please wait a moment.', 429, undefined, 'RATE_LIMITED');
    }

    const { data, errorResponse } = await parseAndValidate(req, MobileAttendanceCheckInSchema);
    if (errorResponse) return errorResponse;

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

    const result = await recordAttendanceLogin(user, gpsInput, locStatus);

    if (!result.success) {
      return apiError(result.error || 'Failed to record check-in.', 400, { session: result.session });
    }

    return apiSuccess(
      {
        session: result.session,
        isNew: result.isNew,
        state: 'LOGGED_IN',
        serverTimestamp: new Date().toISOString(),
      },
      result.isNew ? 'Check-in recorded successfully' : 'Attendance session resumed'
    );
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}
