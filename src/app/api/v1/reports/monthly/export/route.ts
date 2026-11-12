import { NextResponse } from 'next/server';
import { requireMobileAuth, apiError } from '@/lib/api/v1-helper';
import { generateMonthlyReport } from '@/lib/services/monthly-report-service';
import { generateMonthlyReportPDF } from '@/lib/services/monthly-report-pdf-generator';
import { buildMonthlyReportsDataset } from '@/lib/services/monthly-reports-aggregator';
import { generateMonthlyReportsWorkbook } from '@/lib/services/monthly-excel-generator';
import { getOperationalYearMonth } from '@/lib/utils/date-utils';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(req: Request) {
  try {
    const { user } = await requireMobileAuth(req);
    const { searchParams } = new URL(req.url);

    const format = (searchParams.get('format') || 'excel').toLowerCase();
    const targetUid = searchParams.get('employeeUid') || user.uid;

    if (user.role === 'staff' && targetUid !== user.uid) {
      return apiError('FORBIDDEN: You can only export your own reports.', 403);
    }

    const { year: defaultYear, month: defaultMonth } = getOperationalYearMonth();
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    const month = monthParam ? parseInt(monthParam.includes('-') ? monthParam.split('-')[1] : monthParam, 10) : defaultMonth;
    const year = yearParam ? parseInt(yearParam, 10) : defaultYear;

    if (format === 'pdf') {
      const report = await generateMonthlyReport(targetUid, year, month);
      const pdfBuffer = await generateMonthlyReportPDF(report);

      const filename = `Agricart_Monthly_Report_${report.employee.employeeId}_${year}_${String(month).padStart(2, '0')}.pdf`;

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    }

    // Default: Excel .xlsx export
    const dataset = await buildMonthlyReportsDataset({
      month,
      year,
      employeeUid: targetUid,
    });

    const excelBuffer = await generateMonthlyReportsWorkbook(dataset);
    const filename = `Agricart_Monthly_Report_${year}_${String(month).padStart(2, '0')}.xlsx`;

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(excelBuffer.length),
      },
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}
