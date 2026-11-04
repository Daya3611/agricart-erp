import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { startFieldActivity } from '@/lib/services/field-activity-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const body = await req.json().catch(() => ({}));

    const result = await startFieldActivity(sessionUser, body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      activity: result.activity,
      activityId: result.activityId,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
