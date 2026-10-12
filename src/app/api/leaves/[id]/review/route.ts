import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { processLeaveApproval } from '@/lib/services/leave-service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { id } = await params;
    const body = await req.json();

    const action = body.action || body.status;
    if (action !== 'approved' && action !== 'rejected') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "approved" or "rejected".' },
        { status: 400 }
      );
    }

    const rejectionReason = body.rejectionReason || body.comment || '';

    const result = await processLeaveApproval(sessionUser, id, action, rejectionReason);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
