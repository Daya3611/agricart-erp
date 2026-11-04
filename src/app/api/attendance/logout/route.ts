import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { recordAttendanceLogout } from '@/lib/services/attendance-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const body = await req.json().catch(() => ({}));
    const { gps, locationStatus } = body;

    const result = await recordAttendanceLogout(sessionUser, gps, locationStatus);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      session: result.session,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
