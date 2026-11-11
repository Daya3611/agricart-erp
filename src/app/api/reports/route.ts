import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { createOrUpdateReport } from '@/lib/services/report-service';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { sendEmail } from '@/lib/email/resend';
import { DailyReport } from '@/types';

export async function GET(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);

    const departmentId = searchParams.get('departmentId');
    const centerId = searchParams.get('centerId');
    const status = searchParams.get('status');
    const staffUid = searchParams.get('staffUid');
    const reportDate = searchParams.get('reportDate');

    const filters: { field: string; op: '==' | '>=' | '<=' | 'array-contains'; value: any }[] = [];

    if (sessionUser.role === 'staff') {
      filters.push({ field: 'staffUid', op: '==', value: sessionUser.uid });
    } else if (sessionUser.role === 'manager' && sessionUser.departmentId) {
      filters.push({ field: 'departmentId', op: '==', value: sessionUser.departmentId });
    }

    if (staffUid && sessionUser.role !== 'staff') {
      filters.push({ field: 'staffUid', op: '==', value: staffUid });
    }
    if (departmentId) {
      filters.push({ field: 'departmentId', op: '==', value: departmentId });
    }
    if (centerId) {
      filters.push({ field: 'centerId', op: '==', value: centerId });
    }
    if (status && status !== 'all') {
      filters.push({ field: 'status', op: '==', value: status });
    }
    if (reportDate) {
      filters.push({ field: 'reportDate', op: '==', value: reportDate });
    }

    const fieldReportsRaw = (await fetchCollection(ERP_COLLECTIONS.fieldReports, filters)) as any[];
    const legacyReports = (await fetchCollection(ERP_COLLECTIONS.dailyReports, filters)) as DailyReport[];

    // Also fetch standalone field activities to ensure activities completed on mobile are never omitted
    const actFilters = filters.filter((f) => f.field === 'staffUid' || f.field === 'reportDate');
    const fieldActivitiesRaw = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, actFilters)) as any[];

    // Map Field Reports to DailyReport shape
    const fieldReportsMapped: DailyReport[] = fieldReportsRaw.map((f: any) => {
      const acts: any[] = f.activities || [];
      const actNames = acts.map((a) => a.activityNameLabel || a.activityName?.replace(/_/g, ' ') || 'Activity').slice(0, 3).join(', ');
      const loc = acts[0]?.village || acts[0]?.wadi || 'Field Operations';
      const isCompleted = acts.some((a) => a.activityStatus === 'COMPLETED' || a.activityStatus === 'completed');
      const resolvedStatus = f.status && f.status !== 'draft' ? f.status : isCompleted ? 'submitted' : f.status || 'draft';

      return {
        id: f.id,
        staffUid: f.staffUid,
        employeeId: f.employeeId || 'EMP',
        staffName: f.staffName || 'Staff',
        staffEmail: f.staffEmail || '',
        departmentId: f.departmentId || '',
        departmentName: f.departmentName || 'Field Operations',
        centerId: f.centerId || '',
        centerName: f.centerName || 'Nashik Center',
        reportDate: f.reportDate,
        workLocation: loc,
        workStartTime: f.summary?.firstActivityStart ? f.summary.firstActivityStart.split('T')[1]?.slice(0, 5) : '09:00',
        workEndTime: f.summary?.lastActivityEnd ? f.summary.lastActivityEnd.split('T')[1]?.slice(0, 5) : '18:00',
        activities: `${f.summary?.totalActivities || acts.length} activities: ${actNames}${acts.length > 3 ? '...' : ''}`,
        completedTasks: acts.map((a) => a.observations).filter(Boolean).slice(0, 3).join('; '),
        farmersVisited: f.summary?.totalParticipantContacts || 0,
        meetingsConducted: acts.filter((a) => a.activityType === 'group' || a.participantType === 'group').length,
        attachments: [],
        status: resolvedStatus,
        isLate: Boolean(f.isLate),
        hasLeaveConflict: Boolean(f.hasLeaveConflict),
        conflictDetails: f.conflictDetails,
        submittedAt: f.submittedAt || (isCompleted ? f.updatedAt || f.createdAt : undefined),
        resubmittedAt: f.resubmittedAt,
        reviewerUid: f.reviewerUid,
        reviewerName: f.reviewerName,
        reviewedAt: f.reviewedAt,
        reviewComments: f.reviewComments,
        revisionNumber: f.revisionNumber || 1,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        // Additional field activity metadata
        isFieldActivity: true,
        fieldActivitiesCount: f.summary?.totalActivities || acts.length,
        finalizationGps: f.finalizationGps,
      } as any;
    });

    // Merge: prioritize field report if both exist for same staffUid and reportDate
    const seenMap = new Map<string, DailyReport>();
    for (const fr of fieldReportsMapped) {
      seenMap.set(`${fr.staffUid}_${fr.reportDate}`, fr);
    }
    for (const lr of legacyReports) {
      const key = `${lr.staffUid}_${lr.reportDate}`;
      if (!seenMap.has(key)) {
        seenMap.set(key, lr);
      }
    }

    // Group standalone field activities by staffUid and reportDate
    const actsByStaffDate = new Map<string, any[]>();
    for (const act of fieldActivitiesRaw) {
      const staffKey = act.staffUid || act.employeeUid;
      if (!staffKey || !act.reportDate) continue;
      const key = `${staffKey}_${act.reportDate}`;
      if (!actsByStaffDate.has(key)) {
        actsByStaffDate.set(key, []);
      }
      actsByStaffDate.get(key)!.push(act);
    }

    // Synthesize missing reports from fieldActivities
    for (const [key, acts] of actsByStaffDate.entries()) {
      const existing = seenMap.get(key);
      if (existing) {
        // If existing has 0 activities or is draft, update it
        const hasCompleted = acts.some((a) => a.activityStatus === 'COMPLETED' || a.activityStatus === 'completed');
        if (hasCompleted && existing.status === 'draft') {
          existing.status = 'submitted';
        }
        if (!existing.activities || existing.activities.startsWith('0 activities')) {
          const actNames = acts.map((a) => a.activityNameLabel || a.activityName?.replace(/_/g, ' ') || 'Activity').slice(0, 3).join(', ');
          existing.activities = `${acts.length} activities: ${actNames}${acts.length > 3 ? '...' : ''}`;
        }
      } else {
        const firstAct = acts[0];
        const actNames = acts.map((a) => a.activityNameLabel || a.activityName?.replace(/_/g, ' ') || 'Activity').slice(0, 3).join(', ');
        const loc = acts.find((a) => a.village)?.village || acts.find((a) => a.wadi)?.wadi || 'Field Operations';
        const hasCompleted = acts.some((a) => a.activityStatus === 'COMPLETED' || a.activityStatus === 'completed');
        const totalParticipants = acts.reduce((acc, a) => acc + (Number(a.totalParticipants) || 0), 0);
        const groupMeetings = acts.filter((a) => a.activityType === 'group' || a.participantType === 'group_meeting' || a.participantType === 'group').length;

        const synthesized: DailyReport = {
          id: firstAct.reportId || `field_rep_${firstAct.staffUid || firstAct.employeeUid}_${firstAct.reportDate}`,
          staffUid: firstAct.staffUid || firstAct.employeeUid,
          employeeId: firstAct.employeeId || 'EMP',
          staffName: firstAct.employeeName || 'Staff Member',
          staffEmail: '',
          departmentId: firstAct.departmentId || '',
          departmentName: firstAct.departmentName || 'Field Operations',
          centerId: firstAct.centerId || '',
          centerName: firstAct.centerName || 'Nashik Center',
          reportDate: firstAct.reportDate,
          workLocation: loc,
          workStartTime: firstAct.activityStartAt ? firstAct.activityStartAt.split('T')[1]?.slice(0, 5) : '09:00',
          workEndTime: firstAct.activityEndAt ? firstAct.activityEndAt.split('T')[1]?.slice(0, 5) : '18:00',
          activities: `${acts.length} activities: ${actNames}${acts.length > 3 ? '...' : ''}`,
          completedTasks: acts.map((a) => a.observations).filter(Boolean).slice(0, 3).join('; '),
          farmersVisited: totalParticipants,
          meetingsConducted: groupMeetings,
          attachments: [],
          status: hasCompleted ? 'submitted' : 'draft',
          isLate: false,
          hasLeaveConflict: false,
          submittedAt: acts.find((a) => a.activityEndAt)?.activityEndAt || firstAct.createdAt,
          revisionNumber: 1,
          createdAt: firstAct.createdAt,
          updatedAt: firstAct.updatedAt || firstAct.createdAt,
          isFieldActivity: true,
          fieldActivitiesCount: acts.length,
          finalizationGps: firstAct.activityEndGps || firstAct.activityEndLocation || null,
        } as any;

        // Apply department/center filter if supplied
        if (departmentId && synthesized.departmentId !== departmentId) continue;
        if (centerId && synthesized.centerId !== centerId) continue;
        if (status && status !== 'all' && synthesized.status !== status) continue;

        seenMap.set(key, synthesized);
      }
    }

    const reports = Array.from(seenMap.values());
    reports.sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || '') || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, reports });
  } catch (err: any) {
    if (err.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: err.message, reports: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionUser = await requireAuthenticatedUser();
    const body = await req.json();

    const result = await createOrUpdateReport(sessionUser, body);

    if (!result.success) {
      const isDuplicate = result.error?.includes('already been submitted');
      return NextResponse.json({ success: false, error: result.error }, { status: isDuplicate ? 409 : 400 });
    }

    if (body.submitNow && sessionUser.email) {
      const subject = `Submission Receipt: Daily Activity Report for ${body.reportDate || 'Today'}`;
      const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #16a34a;">Report Submission Confirmed</h2>
          <p>Dear ${sessionUser.fullName},</p>
          <p>Your daily activity report for <strong>${body.reportDate}</strong> has been successfully submitted and forwarded to your department head for review.</p>
          <p><strong>Status:</strong> Submitted</p>
        </div>
      `;
      await sendEmail({
        to: sessionUser.email,
        subject,
        html,
        emailType: 'report_submitted',
        staffUid: sessionUser.uid,
        reportId: result.reportId,
      });
    }

    return NextResponse.json({ success: true, reportId: result.reportId });
  } catch (err: any) {
    const status = err.message.startsWith('UNAUTHORIZED') ? 401 : err.message.startsWith('FORBIDDEN') ? 403 : 500;
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}

