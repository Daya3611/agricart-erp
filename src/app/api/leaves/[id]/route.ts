import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, hasRolePermission } from '@/lib/auth/permissions';
import { fetchDocument, deleteDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { LeaveRecord } from '@/types';
import { logAuditAction } from '@/lib/services/audit-service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { id } = await params;

    const leave = (await fetchDocument(ERP_COLLECTIONS.leaveRecords, id)) as LeaveRecord | null;
    if (!leave) {
      return NextResponse.json({ success: false, error: 'Leave record not found' }, { status: 404 });
    }

    // Role scoping
    if (sessionUser.role === 'staff' && leave.staffUid !== sessionUser.uid) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (sessionUser.role === 'manager' && leave.departmentId !== sessionUser.departmentId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true, leave });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { id } = await params;

    const leave = (await fetchDocument(ERP_COLLECTIONS.leaveRecords, id)) as LeaveRecord | null;
    if (!leave) {
      return NextResponse.json({ success: false, error: 'Leave record not found' }, { status: 404 });
    }

    // Can only cancel if pending/draft, or if super_admin/admin
    const isAdmin = hasRolePermission(sessionUser.role, 'admin');
    const isOwner = leave.enteredByUid === sessionUser.uid || leave.staffUid === sessionUser.uid;

    if (!isAdmin && (!isOwner || leave.approvalStatus !== 'pending')) {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel approved or rejected leaves without administrative rights.' },
        { status: 403 }
      );
    }

    await deleteDocument(ERP_COLLECTIONS.leaveRecords, id);

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'delete_leave',
      resourceType: 'leave',
      resourceId: id,
      details: `Deleted leave record for ${leave.staffName} (${leave.startDate} to ${leave.endDate})`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
