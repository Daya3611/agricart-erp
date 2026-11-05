import { NextResponse } from 'next/server';
import {
  requireMobileAuth,
  apiSuccess,
  apiError,
} from '@/lib/api/v1-helper';
import { fetchDocument, updateDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { LeaveRecord } from '@/types';
import { processLeaveApproval } from '@/lib/services/leave-service';
import { logAuditAction } from '@/lib/services/audit-service';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireMobileAuth(req);
    const { id: leaveId } = await params;

    const leave = (await fetchDocument(ERP_COLLECTIONS.leaveRecords, leaveId)) as LeaveRecord | null;
    if (!leave) {
      return apiError('Leave record not found.', 404);
    }

    // Ownership check
    if (user.role === 'staff' && leave.staffUid !== user.uid) {
      return apiError('FORBIDDEN: You cannot view another employee\'s leave record.', 403);
    }

    return apiSuccess(leave);
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireMobileAuth(req);
    const { id: leaveId } = await params;
    const body = await req.json();

    const leave = (await fetchDocument(ERP_COLLECTIONS.leaveRecords, leaveId)) as LeaveRecord | null;
    if (!leave) {
      return apiError('Leave record not found.', 404);
    }

    // Action 1: Staff cancels their own pending leave request
    if (body.action === 'cancel' || body.action === 'cancelled') {
      if (leave.staffUid !== user.uid && user.role !== 'admin' && user.role !== 'super_admin') {
        return apiError('FORBIDDEN: You can only cancel your own leave request.', 403);
      }
      if (leave.approvalStatus !== 'pending' && leave.approvalStatus !== 'draft') {
        return apiError(`Cannot cancel leave with status: ${leave.approvalStatus}.`, 400);
      }

      const now = new Date().toISOString();
      await updateDocument(ERP_COLLECTIONS.leaveRecords, leaveId, {
        approvalStatus: 'cancelled',
        updatedAt: now,
      });

      await logAuditAction({
        actorUid: user.uid,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'cancel_leave',
        resourceType: 'leave',
        resourceId: leaveId,
        details: `Leave application for ${leave.startDate} to ${leave.endDate} was cancelled by ${user.fullName}.`,
      });

      return apiSuccess({ leaveId, status: 'cancelled' }, 'Leave application cancelled successfully');
    }

    // Action 2: Supervisor / Admin approves or rejects leave
    if (body.action === 'approved' || body.action === 'rejected') {
      const result = await processLeaveApproval(
        user,
        leaveId,
        body.action,
        body.rejectionReason || body.comment || ''
      );

      if (!result.success) {
        return apiError(result.error || `Failed to ${body.action} leave.`, 400);
      }

      return apiSuccess(
        { leaveId, status: body.action, decidedAt: new Date().toISOString() },
        `Leave successfully ${body.action}`
      );
    }

    return apiError('Invalid action. Must be "approved", "rejected", or "cancel".', 400);
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

