import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { createOrUpdateReport } from '@/lib/services/report-service';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { sendEmail } from '@/lib/email/resend';
import { DailyReport } from '@/types';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const departmentId = searchParams.get('departmentId');
    const centerId = searchParams.get('centerId');
    const status = searchParams.get('status');
    const staffUid = searchParams.get('staffUid');
    const reportDate = searchParams.get('reportDate');

    const filters: { field: string; op: '==' | '>=' | '<=' | 'array-contains'; value: any }[] = [];

    if (sessionUser.role === 'staff') {
      filters.push({ field: 'staffUid', op: '==', value: sessionUser.uid });
    } else if (sessionUser.role === 'manager' && sessionUser.departmentId) {
      filters.push({ field: 'departmentId', op: '==', value: sessionUser.departmentId });
    }

    if (staffUid && sessionUser.role !== 'staff') {
      filters.push({ field: 'staffUid', op: '==', value: staffUid });
    }
    if (departmentId) {
      filters.push({ field: 'departmentId', op: '==', value: departmentId });
    }
    if (centerId) {
      filters.push({ field: 'centerId', op: '==', value: centerId });
    }
    if (status && status !== 'all') {
      filters.push({ field: 'status', op: '==', value: status });
    }
    if (reportDate) {
      filters.push({ field: 'reportDate', op: '==', value: reportDate });
    }

    let reports = (await fetchCollection(ERP_COLLECTIONS.dailyReports, filters)) as DailyReport[];

    reports.sort((a: DailyReport, b: DailyReport) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, reports });
  } catch (err: any) {
    if (err.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: err.message, reports: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const body = await req.json();

    const result = await createOrUpdateReport(sessionUser, body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    if (body.submitNow && sessionUser.email) {
      const subject = `Submission Receipt: Daily Activity Report for ${body.reportDate || 'Today'}`;
      const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #16a34a;">Report Submission Confirmed</h2>
          <p>Dear ${sessionUser.fullName},</p>
          <p>Your daily activity report for <strong>${body.reportDate}</strong> has been successfully submitted and forwarded to your department head for review.</p>
          <p><strong>Status:</strong> Submitted</p>
        </div>
      `;
      await sendEmail({
        to: sessionUser.email,
        subject,
        html,
        emailType: 'report_submitted',
        staffUid: sessionUser.uid,
        reportId: result.reportId,
      });
    }

    return NextResponse.json({ success: true, reportId: result.reportId });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

