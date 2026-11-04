import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { checkExistingFieldReport } from '@/lib/services/field-report-service';
import { getOperationalDateString } from '@/lib/utils/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date') || getOperationalDateString();

    const result = await checkExistingFieldReport(sessionUser.uid, dateParam);

    return NextResponse.json({
      success: true,
      exists: result.exists,
      isSubmitted: result.isSubmitted,
      isRevisionRequired: result.isRevisionRequired,
      isDraft: result.isDraft,
      report: result.report,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
