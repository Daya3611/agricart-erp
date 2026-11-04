import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { getFieldReportById } from '@/lib/services/field-report-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { id } = await params;

    const report = await getFieldReportById(id);

    if (!report) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    // Permission check: Staff can only access their own report
    if (sessionUser.role === 'staff' && report.staffUid !== sessionUser.uid) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN: You can only access your own field report.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
