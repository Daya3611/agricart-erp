import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { generateMonthlyReport } from '@/lib/services/monthly-report-service';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);
    const { searchParams } = new URL(req.url);

    const targetUid = searchParams.get('employeeUid') || user.uid;

    if (user.role === 'staff' && targetUid !== user.uid) {
      return apiError('FORBIDDEN: You can only access your own monthly reports.', 403);
    }

    const now = new Date();
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    const month = monthParam ? parseInt(monthParam.includes('-') ? monthParam.split('-')[1] : monthParam, 10) : now.getMonth() + 1;
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    if (isNaN(month) || month < 1 || month > 12) {
      return apiError('Invalid month parameter (must be 1 - 12).', 400);
    }
    if (isNaN(year) || year < 2020 || year > 2050) {
      return apiError('Invalid year parameter.', 400);
    }

    const report = await generateMonthlyReport(targetUid, month, year);

    return apiSuccess(report, undefined, {
      month,
      year,
      employeeUid: targetUid,
      calendarDaysCount: report.days.length,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

