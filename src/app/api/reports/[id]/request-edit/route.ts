import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, ReportEditRequestSchema } from '@/lib/auth/permissions';
import { requestReportEdit } from '@/lib/services/report-service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const reviewer = await requireAuthenticatedUser();
    const { id: reportId } = await params;
    const body = await req.json();

    const parseResult = ReportEditRequestSchema.safeParse({
      reportId,
      reason: body.reason,
      instructions: body.instructions || '',
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { reason, instructions } = parseResult.data;

    const result = await requestReportEdit(
      { uid: reviewer.uid, fullName: reviewer.fullName, role: reviewer.role },
      reportId,
      { reason, instructions }
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Edit request successfully submitted. The report has been reopened for employee revision.',
    });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
