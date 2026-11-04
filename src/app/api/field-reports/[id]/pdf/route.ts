import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { getFieldReportById } from '@/lib/services/field-report-service';
import { getTodayAttendanceSession } from '@/lib/services/attendance-service';
import { generateDailyFieldReportPDF } from '@/lib/services/daily-report-pdf-generator';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { id } = await params;

    const report = await getFieldReportById(id);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (sessionUser.role === 'staff' && report.staffUid !== sessionUser.uid) {
      return NextResponse.json({ error: 'FORBIDDEN: You can only export your own report.' }, { status: 403 });
    }

    // Try to get attendance session for this report date
    const { fetchDocument } = await import('@/lib/firebase/firestore');
    const { ERP_COLLECTIONS } = await import('@/lib/firebase/collections');
    const attSessionId = `att_${report.staffUid}_${report.reportDate}`;
    const attendanceDoc = (await fetchDocument(ERP_COLLECTIONS.attendanceSessions, attSessionId)) as any;

    const pdfBuffer = await generateDailyFieldReportPDF(report, attendanceDoc);

    const cleanEmpId = (report.employeeId || 'EMP').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Agricart_Daily_Report_${cleanEmpId}_${report.reportDate}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('Daily PDF export error:', err);
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
