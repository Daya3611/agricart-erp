import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { reviewFieldReport } from '@/lib/services/field-report-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { id } = await params;
    const body = await req.json();

    const { actionStatus, comment } = body;

    if (!['approved', 'correction_requested', 'rejected'].includes(actionStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid review action status.' }, { status: 400 });
    }

    const result = await reviewFieldReport(sessionUser, id, actionStatus, comment);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
