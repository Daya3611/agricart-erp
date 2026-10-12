import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, hasRolePermission } from '@/lib/auth/permissions';
import { fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { generateMonthlyReport } from '@/lib/services/monthly-report-service';
import { UserProfile } from '@/types';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    let staffUidParam = searchParams.get('staffUid');

    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid year or month parameters (month must be between 1 and 12).' },
        { status: 400 }
      );
    }

    // Role-based security checks
    let targetStaffUid = staffUidParam;

    if (sessionUser.role === 'staff') {
      // Staff CANNOT view another employee's monthly report
      targetStaffUid = sessionUser.uid;
    } else if (!targetStaffUid) {
      // Default to session user if not provided
      targetStaffUid = sessionUser.uid;
    }

    // Manager scope check
    if (sessionUser.role === 'manager' && targetStaffUid !== sessionUser.uid) {
      const targetEmp = (await fetchDocument(ERP_COLLECTIONS.employees, targetStaffUid)) as UserProfile | null;
      if (!targetEmp) {
        return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
      }

      const isDeptMatch = sessionUser.departmentId && targetEmp.departmentId === sessionUser.departmentId;
      const isCenterMatch = targetEmp.assignedCenterIds?.some((c) => sessionUser.assignedCenterIds?.includes(c));

      if (!isDeptMatch && !isCenterMatch) {
        return NextResponse.json(
          { success: false, error: 'FORBIDDEN: You can only view monthly reports for staff in your assigned department.' },
          { status: 403 }
        );
      }
    }

    const report = await generateMonthlyReport(targetStaffUid, year, month);

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
