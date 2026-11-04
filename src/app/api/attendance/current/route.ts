import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { getTodayAttendanceSession } from '@/lib/services/attendance-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const session = await getTodayAttendanceSession(sessionUser.uid);

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
