import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { checkExistingDailyReport } from '@/lib/services/report-service';
import { normalizeReportDate } from '@/lib/utils/date-utils';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const dateParam = searchParams.get('reportDate') || searchParams.get('date');
    const reportDate = normalizeReportDate(dateParam);

    // Verified ownership: query is strictly scoped to sessionUser.uid
    const result = await checkExistingDailyReport(sessionUser.uid, reportDate);

    return NextResponse.json({
      success: true,
      reportDate,
      exists: result.exists,
      isSubmitted: result.isSubmitted,
      isRevisionRequired: result.isRevisionRequired,
      isDraft: result.isDraft,
      report: result.report,
    });
  } catch (err: any) {
    if (err.message && err.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in GET /api/reports/check:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to check report status' },
      { status: 500 }
    );
  }
}

