import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { createOrUpdateFieldReport, listFieldReports } from '@/lib/services/field-report-service';
import { sendEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const departmentId = searchParams.get('departmentId') || undefined;
    const centerId = searchParams.get('centerId') || undefined;
    const status = searchParams.get('status') || undefined;
    const staffUid = searchParams.get('staffUid') || undefined;
    const reportDate = searchParams.get('reportDate') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const reports = await listFieldReports(sessionUser, {
      departmentId,
      centerId,
      status,
      staffUid,
      reportDate,
      startDate,
      endDate,
    });

    return NextResponse.json({ success: true, reports });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message, reports: [] }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const body = await req.json();

    const result = await createOrUpdateFieldReport(sessionUser, body);

    if (!result.success) {
      const isDuplicate = result.error?.includes('already been submitted');
      return NextResponse.json({ success: false, error: result.error }, { status: isDuplicate ? 409 : 400 });
    }

    if (body.finalizeNow && sessionUser.email) {
      const subject = `Submission Receipt: Field Activity Report for ${body.reportDate || 'Today'}`;
      const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #16a34a;">Field Activity Report Finalized</h2>
          <p>Dear ${sessionUser.fullName},</p>
          <p>Your field activity report for <strong>${body.reportDate}</strong> has been successfully finalized and forwarded for administrative review.</p>
          <p><strong>Status:</strong> Finalized & Submitted</p>
        </div>
      `;
      try {
        await sendEmail({
          to: sessionUser.email,
          subject,
          html,
          emailType: 'report_submitted',
          staffUid: sessionUser.uid,
          reportId: result.reportId,
        });
      } catch (mailErr) {
        console.warn('Submission confirmation email error:', mailErr);
      }
    }

    return NextResponse.json({ success: true, reportId: result.reportId });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
