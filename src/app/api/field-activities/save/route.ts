import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { updateFieldActivityProgress } from '@/lib/services/field-activity-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const body = await req.json().catch(() => ({}));
    const { activityId, updates } = body;

    if (!activityId) {
      return NextResponse.json({ success: false, error: 'activityId is required.' }, { status: 400 });
    }

    const result = await updateFieldActivityProgress(sessionUser, activityId, updates || {});

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      activity: result.activity,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
