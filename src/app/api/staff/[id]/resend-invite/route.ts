import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/permissions';
import { fetchDocument, updateDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { adminAuth } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/resend';
import { getStaffInvitationEmail } from '@/lib/email/templates';
import { logAuditAction } from '@/lib/services/audit-service';
import { UserProfile } from '@/types';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAdmin();
    const { id } = await params;

    const employee = (await fetchDocument(ERP_COLLECTIONS.employees, id)) as UserProfile | null;
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found.' }, { status: 404 });
    }

    if (employee.accountStatus === 'deactivated') {
      return NextResponse.json(
        { success: false, error: 'Cannot resend invitation to a deactivated account. Reactivate the account first.' },
        { status: 400 }
      );
    }

    let setupUrl = `${process.env.APP_URL || 'http://localhost:3000'}/login`;
    try {
      setupUrl = await adminAuth.generatePasswordResetLink(employee.email);
    } catch (linkErr: any) {
      console.warn('Could not generate Firebase Auth password reset link:', linkErr.message);
    }

    const { subject, html } = getStaffInvitationEmail({
      recipientName: employee.fullName,
      employeeId: employee.employeeId,
      setupUrl,
      role: employee.role,
    });

    const emailResult = await sendEmail({
      to: employee.email,
      subject,
      html,
      emailType: 'staff_invitation',
      staffUid: employee.uid,
    });

    const invitationStatus = emailResult.success ? 'sent' : 'failed';
    const now = new Date().toISOString();

    await updateDocument(ERP_COLLECTIONS.employees, id, {
      invitationStatus,
      updatedAt: now,
    });

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'resend_invitation',
      resourceType: 'user',
      resourceId: id,
      details: `Resent invitation email to ${employee.fullName} (${employee.email})`,
    });

    if (!emailResult.success) {
      return NextResponse.json({
        success: false,
        error: `Failed to deliver email: ${emailResult.error}`,
        setupUrl,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Invitation resent successfully to ${employee.email}.`,
      invitationStatus: 'sent',
    });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
