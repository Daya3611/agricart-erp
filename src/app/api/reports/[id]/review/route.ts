import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, ReportReviewSchema } from '@/lib/auth/permissions';
import { reviewReport } from '@/lib/services/report-service';
import { fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { sendEmail } from '@/lib/email/resend';
import { getReportReviewStatusEmail } from '@/lib/email/templates';
import { DailyReport } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser();
    const { id: reportId } = await params;

    const reportDoc = (await fetchDocument(ERP_COLLECTIONS.dailyReports, reportId)) as DailyReport | null;
    if (!reportDoc) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      reportId,
      status: reportDoc.status,
      reviewerUid: reportDoc.reviewerUid,
      reviewerName: reportDoc.reviewerName,
      reviewedAt: reportDoc.reviewedAt,
      reviewComments: reportDoc.reviewComments || '',
      revisionNumber: reportDoc.revisionNumber || 1,
    });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const reviewer = await requireAuthenticatedUser();
    const { id: reportId } = await params;
    const body = await req.json();

    // Accept both status and actionStatus, and normalize comments
    const statusInput = body.status || body.actionStatus;
    const commentInput = body.comment !== undefined ? body.comment : (body.comments !== undefined ? body.comments : '');

    const parseResult = ReportReviewSchema.safeParse({
      reportId,
      status: statusInput,
      comment: commentInput,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { status: actionStatus, comment } = parseResult.data;

    // Verify reviewer role has permission to review reports
    if (!['super_admin', 'admin', 'manager'].includes(reviewer.role)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN: Only administrators and managers can review reports.' },
        { status: 403 }
      );
    }

    let result;
    if (actionStatus === 'edit_requested') {
      const { requestReportEdit } = await import('@/lib/services/report-service');
      result = await requestReportEdit(
        { uid: reviewer.uid, fullName: reviewer.fullName, role: reviewer.role },
        reportId,
        { reason: comment || 'Edit requested by supervisor.', instructions: body.instructions || '' }
      );
    } else {
      result = await reviewReport(
        { uid: reviewer.uid, fullName: reviewer.fullName, role: reviewer.role },
        reportId,
        actionStatus,
        comment
      );
    }

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // Send email notification to report author
    const reportDoc = (await fetchDocument(ERP_COLLECTIONS.dailyReports, reportId)) as DailyReport | null;
    if (reportDoc && reportDoc.staffEmail) {
      const { subject, html } = getReportReviewStatusEmail({
        recipientName: reportDoc.staffName,
        reportDate: reportDoc.reportDate,
        status: actionStatus,
        reviewerName: reviewer.fullName,
        comments: comment,
      });

      await sendEmail({
        to: reportDoc.staffEmail,
        subject,
        html,
        emailType: actionStatus === 'approved' ? 'report_approved' : 'correction_requested',
        staffUid: reportDoc.staffUid,
        reportId,
      });
    }

    return NextResponse.json({ success: true, message: `Report review updated to ${actionStatus}` });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
