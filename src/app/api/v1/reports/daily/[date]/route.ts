import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { normalizeReportDate } from '@/lib/utils/date-utils';
import { getStaffActivitiesForDate } from '@/lib/services/field-activity-service';
import { calculateActivitiesSummary } from '@/lib/utils/field-activity-calculations';
import { fetchCollection, fetchDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { AttendanceSession, FieldReport, UserProfile } from '@/types';
import { generateDailyFieldReportPDF } from '@/lib/services/daily-report-pdf-generator';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { user } = await requireMobileAuth(req);
    const { date: rawDate } = await params;
    const { searchParams } = new URL(req.url);

    const reportDate = normalizeReportDate(rawDate);
    const targetUid = searchParams.get('employeeUid') || user.uid;
    const format = (searchParams.get('format') || 'json').toLowerCase();

    if (user.role === 'staff' && targetUid !== user.uid) {
      return apiError('FORBIDDEN: You can only view your own daily report.', 403);
    }

    // 1. Fetch activities for this date
    const activities = await getStaffActivitiesForDate(targetUid, reportDate);

    // 2. Fetch attendance for this date
    const attendanceSession = (await fetchDocument(
      ERP_COLLECTIONS.attendanceSessions,
      `att_${targetUid}_${reportDate}`
    )) as AttendanceSession | null;

    // 3. Fetch employee profile
    const empProfile = ((await fetchDocument(ERP_COLLECTIONS.employees, targetUid)) as unknown as UserProfile) || user;

    // 4. Calculate summary
    const { summary, errors } = calculateActivitiesSummary(activities as any);

    // 5. Look for existing field report document
    const reportDocId = `field_rep_${targetUid}_${reportDate}`;
    let fieldReport = (await fetchDocument(ERP_COLLECTIONS.fieldReports, reportDocId)) as FieldReport | null;

    if (!fieldReport) {
      // Synthesize field report structure
      fieldReport = {
        id: reportDocId,
        staffUid: targetUid,
        employeeId: empProfile.employeeId || '',
        staffName: empProfile.fullName || 'Staff Member',
        staffEmail: empProfile.email || '',
        departmentId: empProfile.departmentId || '',
        departmentName: empProfile.departmentName || '',
        centerId: empProfile.assignedCenterIds?.[0] || '',
        centerName: empProfile.assignedCenterNames?.[0] || '',
        reportDate,
        activities: activities as any,
        summary,
        status: activities.some((a) => a.activityStatus === 'COMPLETED') ? 'submitted' : 'draft',
        finalized: activities.length > 0 && activities.every((a) => a.activityStatus === 'COMPLETED'),
        revisionNumber: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    if (format === 'pdf') {
      const pdfBuffer = await generateDailyFieldReportPDF(fieldReport, attendanceSession);
      const filename = `Daily_Report_${empProfile.employeeId}_${reportDate}.pdf`;

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    }

    return apiSuccess({
      date: reportDate,
      employee: {
        uid: empProfile.uid,
        employeeId: empProfile.employeeId,
        fullName: empProfile.fullName,
        departmentName: empProfile.departmentName,
        centerName: empProfile.assignedCenterNames?.[0] || '',
      },
      report: fieldReport,
      activities,
      summary,
      attendance: attendanceSession,
      validationErrors: errors,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}
