import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { generateMonthlyReport } from '@/lib/services/monthly-report-service';
import { generateMonthlyReportDOCX } from '@/lib/services/monthly-report-docx-generator';
import { UserProfile } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const staffUidParam = searchParams.get('staffUid');

    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid year or month parameters.' },
        { status: 400 }
      );
    }

    let targetStaffUid = staffUidParam;
    if (sessionUser.role === 'staff') {
      targetStaffUid = sessionUser.uid;
    } else if (!targetStaffUid) {
      targetStaffUid = sessionUser.uid;
    }

    if (sessionUser.role === 'manager' && targetStaffUid !== sessionUser.uid) {
      const targetEmp = (await fetchDocument(ERP_COLLECTIONS.employees, targetStaffUid)) as UserProfile | null;
      if (!targetEmp) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      const isDeptMatch = sessionUser.departmentId && targetEmp.departmentId === sessionUser.departmentId;
      const isCenterMatch = targetEmp.assignedCenterIds?.some((c) => sessionUser.assignedCenterIds?.includes(c));

      if (!isDeptMatch && !isCenterMatch) {
        return NextResponse.json(
          { error: 'FORBIDDEN: You can only export reports for staff in your assigned department.' },
          { status: 403 }
        );
      }
    }

    const report = await generateMonthlyReport(targetStaffUid, year, month);
    const docxBuffer = await generateMonthlyReportDOCX(report);

    const cleanEmpId = report.employee.employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Agricart_Monthly_Report_${cleanEmpId}_${year}-${String(month).padStart(2, '0')}.docx`;

    return new Response(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(docxBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[Monthly DOCX Route Error]:', err);
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
