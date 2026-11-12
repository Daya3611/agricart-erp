import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { buildMonthlyReportsDataset } from '@/lib/services/monthly-reports-aggregator';
import { generateMonthlyReportsWorkbook } from '@/lib/services/monthly-excel-generator';
import { getOperationalYearMonth } from '@/lib/utils/date-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const { year: defaultYear, month: defaultMonth } = getOperationalYearMonth();
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    let employeeUid = searchParams.get('employeeUid') || undefined;
    let departmentId = searchParams.get('departmentId') || undefined;
    const centerId = searchParams.get('centerId') || undefined;

    const year = yearParam ? parseInt(yearParam, 10) : defaultYear;
    const month = monthParam ? parseInt(monthParam, 10) : defaultMonth;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year or month parameter.' }, { status: 400 });
    }

    // Role-based restrictions
    if (sessionUser.role === 'staff') {
      employeeUid = sessionUser.uid;
    } else if (sessionUser.role === 'manager') {
      if (sessionUser.departmentId) {
        departmentId = sessionUser.departmentId;
      }
    }

    const dataset = await buildMonthlyReportsDataset({
      year,
      month,
      departmentId,
      centerId,
      employeeUid,
    });

    const excelBuffer = await generateMonthlyReportsWorkbook(dataset);

    const monthStr = String(month).padStart(2, '0');
    const filename = `Monthly_Activity_Report_${year}-${monthStr}.xlsx`;

    return new Response(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(excelBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('Monthly Excel export route error:', err);
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
