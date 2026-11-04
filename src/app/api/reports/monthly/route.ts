import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { generateMonthlyReport } from '@/lib/services/monthly-report-service';
import { buildMonthlyReportsDataset } from '@/lib/services/monthly-reports-aggregator';
import { UserProfile } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    let staffUidParam = searchParams.get('staffUid') || undefined;
    let departmentId = searchParams.get('departmentId') || undefined;
    let centerId = searchParams.get('centerId') || undefined;
    const reportStatus = searchParams.get('status') || undefined;
    const attendanceStatus = searchParams.get('attendanceStatus') || undefined;

    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid year or month parameters (month must be between 1 and 12).' },
        { status: 400 }
      );
    }

    // Role-based restrictions
    if (sessionUser.role === 'staff') {
      staffUidParam = sessionUser.uid;
    } else if (sessionUser.role === 'manager') {
      if (sessionUser.departmentId) {
        departmentId = sessionUser.departmentId;
      }
    }

    // Build complete monthly dataset across all matching employees
    const dataset = await buildMonthlyReportsDataset({
      year,
      month,
      departmentId: departmentId && departmentId !== 'all' ? departmentId : undefined,
      centerId: centerId && centerId !== 'all' ? centerId : undefined,
      employeeUid: staffUidParam && staffUidParam !== 'all' ? staffUidParam : undefined,
      reportStatus: reportStatus && reportStatus !== 'all' ? reportStatus : undefined,
      attendanceStatus: attendanceStatus && attendanceStatus !== 'all' ? attendanceStatus : undefined,
    });

    // Also include legacy single report if single staffUid requested for backward compatibility
    let singleReport = null;
    if (staffUidParam && staffUidParam !== 'all') {
      singleReport = await generateMonthlyReport(staffUidParam, year, month);
    }

    return NextResponse.json({
      success: true,
      report: singleReport,
      dataset,
      employeeSummaries: dataset.employeeSummaries,
      dailyRecords: dataset.dailyRecords,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
