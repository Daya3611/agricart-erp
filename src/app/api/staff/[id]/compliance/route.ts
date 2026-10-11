import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { fetchCollection, fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { DailyReport, UserProfile } from '@/types';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { id } = await params;

    // Staff can only view their own compliance unless admin/manager
    if (sessionUser.role === 'staff' && sessionUser.uid !== id) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN: Staff cannot view other compliance records.' }, { status: 403 });
    }

    const employee = (await fetchDocument(ERP_COLLECTIONS.employees, id)) as UserProfile | null;
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found.' }, { status: 404 });
    }

    // Manager scope check
    if (sessionUser.role === 'manager' && sessionUser.uid !== id) {
      const isDeptMatch = sessionUser.departmentId && employee.departmentId === sessionUser.departmentId;
      const isCenterMatch = employee.assignedCenterIds?.some((c) => sessionUser.assignedCenterIds?.includes(c));
      if (!isDeptMatch && !isCenterMatch) {
        return NextResponse.json({ success: false, error: 'FORBIDDEN: Restricted to assigned department or center.' }, { status: 403 });
      }
    }

    const reports = (await fetchCollection(ERP_COLLECTIONS.dailyReports, [
      { field: 'staffUid', op: '==', value: id },
    ])) as DailyReport[];

    // Sort newest first
    reports.sort((a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());

    const totalReports = reports.length;
    const submittedReports = reports.filter((r) => r.status !== 'draft');
    const onTimeReports = submittedReports.filter((r) => !r.isLate);
    const lateReports = submittedReports.filter((r) => r.isLate);
    const approvedReports = submittedReports.filter((r) => r.status === 'approved');
    const correctionRequestedReports = submittedReports.filter((r) => r.status === 'correction_requested');

    const complianceRate = submittedReports.length > 0
      ? Math.round((onTimeReports.length / submittedReports.length) * 100)
      : 100;

    return NextResponse.json({
      success: true,
      employee: {
        uid: employee.uid,
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        email: employee.email,
        designation: employee.designation,
        role: employee.role,
        joiningDate: (employee as any).joiningDate || null,
        accountStatus: employee.accountStatus,
      },
      compliance: {
        totalReports,
        submittedCount: submittedReports.length,
        onTimeCount: onTimeReports.length,
        lateCount: lateReports.length,
        approvedCount: approvedReports.length,
        correctionRequestedCount: correctionRequestedReports.length,
        complianceRate,
      },
      reports: reports.slice(0, 30), // Recent 30 reports
    });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
