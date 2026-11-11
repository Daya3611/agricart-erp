import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { reviewFieldReport } from '@/lib/services/field-report-service';
import { fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { sendEmail } from '@/lib/email/resend';
import { getReportReviewStatusEmail } from '@/lib/email/templates';
import { FieldReport, UserProfile } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { id } = await params;
    const body = await req.json();

    const actionStatus = (body.actionStatus || body.status || '').toString().trim().toLowerCase();
    const comment = body.comment !== undefined ? body.comment : (body.comments || '');

    if (!['approved', 'correction_requested', 'edit_requested', 'rejected'].includes(actionStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid review action status.' }, { status: 400 });
    }

    const result = await reviewFieldReport(sessionUser, id, actionStatus as any, comment);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    try {
      const fieldDoc = (await fetchDocument(ERP_COLLECTIONS.fieldReports, id)) as FieldReport | null;
      if (fieldDoc) {
        let recipientEmail = fieldDoc.staffEmail;
        if (!recipientEmail && fieldDoc.staffUid) {
          const emp = (await fetchDocument(ERP_COLLECTIONS.employees, fieldDoc.staffUid)) as UserProfile | null;
          recipientEmail = emp?.email || '';
        }
        if (recipientEmail) {
          const { subject, html } = getReportReviewStatusEmail({
            recipientName: fieldDoc.staffName || 'Team Member',
            reportDate: fieldDoc.reportDate || new Date().toISOString(),
            status: actionStatus,
            reviewerName: sessionUser.fullName,
            comments: comment,
          });
          await sendEmail({
            to: recipientEmail,
            subject,
            html,
            emailType: actionStatus === 'approved' ? 'report_approved' : 'correction_requested',
            staffUid: fieldDoc.staffUid,
            reportId: id,
          });
        }
      }
    } catch (mailErr) {
      console.warn('Failed to send field report review email:', mailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
