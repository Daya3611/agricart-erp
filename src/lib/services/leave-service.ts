import { fetchCollection, fetchDocument, saveDocument, updateDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { LeaveRecord, LeaveStatus, LeaveType, UserProfile, UserRole } from '@/types';
import { logAuditAction } from '@/lib/services/audit-service';
import { hasRolePermission } from '@/lib/auth/permissions';
import { sendEmail } from '@/lib/email/resend';

export interface CreateLeaveInput {
  staffUid: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isHalfDay?: boolean;
  halfDayType?: 'first_half' | 'second_half';
  reason: string;
  attachmentUrl?: string;
  status?: LeaveStatus; // 'pending' or 'draft'
}

import { calculateLeaveDays } from '@/lib/utils/leave';
export { calculateLeaveDays };

/**
 * Checks for overlapping approved or pending leaves for the same staff member.
 */
export async function checkLeaveOverlap(
  staffUid: string,
  startDate: string,
  endDate: string,
  excludeLeaveId?: string
): Promise<{ hasOverlap: boolean; overlappingLeave?: LeaveRecord }> {
  const existingLeaves = (await fetchCollection(ERP_COLLECTIONS.leaveRecords, [
    { field: 'staffUid', op: '==', value: staffUid },
  ])) as LeaveRecord[];

  const activeLeaves = existingLeaves.filter(
    (l) =>
      l.id !== excludeLeaveId &&
      (l.approvalStatus === 'approved' || l.approvalStatus === 'pending')
  );

  for (const leave of activeLeaves) {
    // Overlap condition: start <= leave.endDate && end >= leave.startDate
    if (startDate <= leave.endDate && endDate >= leave.startDate) {
      return { hasOverlap: true, overlappingLeave: leave };
    }
  }

  return { hasOverlap: false };
}

/**
 * Creates a new leave record.
 */
export async function createLeaveRecord(
  actor: UserProfile,
  input: CreateLeaveInput
): Promise<{ success: boolean; leaveId?: string; error?: string }> {
  try {
    const { staffUid, leaveType, startDate, endDate, isHalfDay, halfDayType, reason, attachmentUrl } = input;

    if (!startDate || !endDate) {
      return { success: false, error: 'Start date and End date are required.' };
    }
    if (endDate < startDate) {
      return { success: false, error: 'End date cannot be earlier than start date.' };
    }
    if (!reason || reason.trim().length < 3) {
      return { success: false, error: 'Please provide a valid reason for the leave (min 3 characters).' };
    }

    // 1. Fetch target staff profile
    const targetUser = (await fetchDocument(ERP_COLLECTIONS.employees, staffUid)) as UserProfile | null;
    if (!targetUser) {
      return { success: false, error: 'Target employee not found.' };
    }

    // 2. Authorization check
    if (actor.role === 'staff' && actor.uid !== staffUid) {
      return { success: false, error: 'FORBIDDEN: Staff members cannot create leaves for other employees.' };
    }
    if (actor.role === 'manager' && actor.uid !== staffUid) {
      const isDeptMatch = actor.departmentId && targetUser.departmentId === actor.departmentId;
      const isCenterMatch = actor.assignedCenterIds?.some((c) => targetUser.assignedCenterIds?.includes(c));
      if (!isDeptMatch && !isCenterMatch) {
        return { success: false, error: 'FORBIDDEN: Restricted to employees in your assigned department or centers.' };
      }
    }

    // 3. Overlap check
    const { hasOverlap, overlappingLeave } = await checkLeaveOverlap(staffUid, startDate, endDate);
    if (hasOverlap && overlappingLeave) {
      return {
        success: false,
        error: `Conflicting leave exists for ${targetUser.fullName}: ${overlappingLeave.startDate} to ${overlappingLeave.endDate} (Status: ${overlappingLeave.approvalStatus.toUpperCase()}).`,
      };
    }

    // 4. Calculate duration
    const daysCount = calculateLeaveDays(startDate, endDate, isHalfDay);

    const now = new Date().toISOString();
    const docId = `leave_${staffUid}_${Date.now()}`;
    const initialStatus: LeaveStatus = input.status === 'draft' ? 'draft' : 'pending';

    const newLeave: LeaveRecord = {
      id: docId,
      staffUid,
      employeeId: targetUser.employeeId || 'N/A',
      staffName: targetUser.fullName,
      staffEmail: targetUser.email,
      departmentId: targetUser.departmentId || '',
      departmentName: targetUser.departmentName || 'Field Operations',
      centerId: targetUser.assignedCenterIds?.[0] || '',
      centerName: targetUser.assignedCenterNames?.[0] || 'Main Center',
      startDate,
      endDate,
      daysCount,
      isHalfDay: Boolean(isHalfDay),
      halfDayType: isHalfDay ? halfDayType || 'first_half' : undefined,
      leaveType,
      approvalStatus: initialStatus,
      reason: reason.trim(),
      attachmentUrl: attachmentUrl || undefined,
      enteredByUid: actor.uid,
      enteredByName: actor.fullName,
      enteredByRole: actor.role,
      auditHistory: [
        {
          status: initialStatus,
          actorUid: actor.uid,
          actorName: actor.fullName,
          actorRole: actor.role,
          timestamp: now,
          note: `Leave record created for ${daysCount} day(s) (${leaveType})`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    await saveDocument(ERP_COLLECTIONS.leaveRecords, docId, newLeave);

    await logAuditAction({
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRole: actor.role,
      action: 'create_leave',
      resourceType: 'leave',
      resourceId: docId,
      details: `Created ${leaveType} leave for ${targetUser.fullName} (${startDate} to ${endDate}, ${daysCount} days)`,
      newValues: { status: initialStatus, daysCount, startDate, endDate },
    });

    return { success: true, leaveId: docId };
  } catch (err: any) {
    console.error('createLeaveRecord error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Processes leave approval or rejection.
 */
export async function processLeaveApproval(
  approver: UserProfile,
  leaveId: string,
  action: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const leave = (await fetchDocument(ERP_COLLECTIONS.leaveRecords, leaveId)) as LeaveRecord | null;
    if (!leave) {
      return { success: false, error: 'Leave record not found.' };
    }

    // Prevent transitions if already finalized
    if (leave.approvalStatus === 'approved') {
      return { success: false, error: 'Leave is already approved.' };
    }
    if (leave.approvalStatus === 'rejected') {
      return { success: false, error: 'Leave is already rejected.' };
    }

    // Role check: Admin, Super Admin, or Manager
    if (!hasRolePermission(approver.role, 'manager')) {
      return { success: false, error: 'FORBIDDEN: Administrative or Manager approval authorization required.' };
    }

    // Manager scope check
    if (approver.role === 'manager') {
      const isDeptMatch = approver.departmentId && leave.departmentId === approver.departmentId;
      if (!isDeptMatch) {
        return { success: false, error: 'FORBIDDEN: You can only approve leave records for your assigned department.' };
      }
    }

    // NON-NEGOTIABLE RULE: Prevent self-approval
    if (approver.uid === leave.staffUid) {
      return { success: false, error: 'FORBIDDEN: You cannot approve or reject your own leave record.' };
    }

    // Rejection reason is required
    if (action === 'rejected' && (!rejectionReason || rejectionReason.trim().length < 3)) {
      return { success: false, error: 'Please provide a clear rejection reason explaining the decision (min 3 characters).' };
    }

    const now = new Date().toISOString();
    const historyEntry = {
      status: action as LeaveStatus,
      actorUid: approver.uid,
      actorName: approver.fullName,
      actorRole: approver.role,
      timestamp: now,
      note: action === 'approved' ? 'Leave approved' : `Leave rejected: ${rejectionReason}`,
    };

    const updatePayload: Partial<LeaveRecord> = {
      approvalStatus: action,
      updatedAt: now,
      auditHistory: [...(leave.auditHistory || []), historyEntry],
    };

    if (action === 'approved') {
      updatePayload.approvedByUid = approver.uid;
      updatePayload.approvedByName = approver.fullName;
      updatePayload.approvedAt = now;
      updatePayload.rejectedByUid = undefined;
      updatePayload.rejectedByName = undefined;
      updatePayload.rejectedAt = undefined;
      updatePayload.rejectionReason = undefined;
    } else {
      updatePayload.rejectedByUid = approver.uid;
      updatePayload.rejectedByName = approver.fullName;
      updatePayload.rejectedAt = now;
      updatePayload.rejectionReason = rejectionReason?.trim();
      updatePayload.approvedByUid = undefined;
      updatePayload.approvedByName = undefined;
      updatePayload.approvedAt = undefined;
    }

    await updateDocument(ERP_COLLECTIONS.leaveRecords, leaveId, updatePayload);

    await logAuditAction({
      actorUid: approver.uid,
      actorName: approver.fullName,
      actorRole: approver.role,
      action: action === 'approved' ? 'approve_leave' : 'reject_leave',
      resourceType: 'leave',
      resourceId: leaveId,
      details: `${action === 'approved' ? 'Approved' : 'Rejected'} leave for ${leave.staffName} (${leave.startDate} to ${leave.endDate})`,
      previousValues: { status: leave.approvalStatus },
      newValues: { status: action, rejectionReason: action === 'rejected' ? rejectionReason : undefined },
    });

    // Notify employee via email if available
    if (leave.staffEmail) {
      const subject = `Leave Request ${action.toUpperCase()}: ${leave.startDate} to ${leave.endDate}`;
      const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: ${action === 'approved' ? '#16a34a' : '#dc2626'};">
            Leave Request ${action === 'approved' ? 'Approved ✅' : 'Rejected ❌'}
          </h2>
          <p>Dear ${leave.staffName},</p>
          <p>Your leave request from <strong>${leave.startDate}</strong> to <strong>${leave.endDate}</strong> (${leave.daysCount} day(s), ${leave.leaveType.toUpperCase()}) has been <strong>${action.toUpperCase()}</strong> by ${approver.fullName}.</p>
          ${action === 'rejected' && rejectionReason ? `<p style="background: #fef2f2; padding: 10px; border-radius: 6px; color: #991b1b;"><strong>Reason for Rejection:</strong> ${rejectionReason}</p>` : ''}
          <p style="color: #64748b; font-size: 12px; margin-top: 15px;">Agricart FPC Management System</p>
        </div>
      `;
      sendEmail({
        to: leave.staffEmail,
        subject,
        html,
        emailType: 'admin_notification',
        staffUid: leave.staffUid,
      }).catch((e) => console.error('Failed to send leave status email:', e));
    }

    return { success: true };
  } catch (err: any) {
    console.error('processLeaveApproval error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves approved leaves that overlap with a specific month.
 */
export async function getApprovedLeavesForMonth(
  staffUid: string,
  year: number,
  month: number
): Promise<LeaveRecord[]> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const allStaffLeaves = (await fetchCollection(ERP_COLLECTIONS.leaveRecords, [
    { field: 'staffUid', op: '==', value: staffUid },
    { field: 'approvalStatus', op: '==', value: 'approved' },
  ])) as LeaveRecord[];

  return allStaffLeaves.filter((l) => l.startDate <= monthEnd && l.endDate >= monthStart);
}
