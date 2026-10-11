import { NextResponse } from 'next/server';
import { requireAdmin, requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { adminAuth } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/resend';
import { getPasswordResetEmail } from '@/lib/email/templates';
import { logAuditAction } from '@/lib/services/audit-service';
import { UserProfile } from '@/types';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { id } = await params;

    // Staff can only trigger reset for their own account, otherwise must be admin
    if (sessionUser.role === 'staff' && sessionUser.uid !== id) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN: You can only reset password for your own account.' }, { status: 403 });
    }

    const employee = (await fetchDocument(ERP_COLLECTIONS.employees, id)) as UserProfile | null;
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found.' }, { status: 404 });
    }

    if (employee.accountStatus === 'deactivated') {
      return NextResponse.json({ success: false, error: 'Cannot reset password for a deactivated account.' }, { status: 400 });
    }

    let resetUrl = '';
    try {
      resetUrl = await adminAuth.generatePasswordResetLink(employee.email);
    } catch (authErr: any) {
      return NextResponse.json({ success: false, error: `Failed to generate reset link: ${authErr.message}` }, { status: 500 });
    }

    const { subject, html } = getPasswordResetEmail({
      recipientName: employee.fullName,
      resetUrl,
    });

    const emailResult = await sendEmail({
      to: employee.email,
      subject,
      html,
      emailType: 'staff_invitation',
      staffUid: employee.uid,
    });

    await logAuditAction({
      actorUid: sessionUser.uid,
      actorName: sessionUser.fullName,
      actorRole: sessionUser.role,
      action: 'reset_password_request',
      resourceType: 'user',
      resourceId: id,
      details: `Generated password reset link for ${employee.fullName} (${employee.email})`,
    });

    return NextResponse.json({
      success: true,
      message: `Password reset instructions sent to ${employee.email}.`,
      resetUrl: process.env.NODE_ENV !== 'production' ? resetUrl : undefined,
    });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
