import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/permissions';
import { createOrUpdateReport } from '@/lib/services/report-service';
import { fetchCollection } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { sendEmail } from '@/lib/email/resend';
import { formatTime24IST, formatTimeIST } from '@/lib/utils/date-utils';
import { mergeEvidenceUrls } from '@/lib/utils/field-activity-calculations';
import { ACTIVITY_CHOICES, DailyReport, ReportAttachment, SUPPORT_PROVIDED_OPTIONS } from '@/types';

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

    const resolveActivityTitle = (a: any): string => {
      if (a.activityNameLabel) {
        return a.activityName === 'other' && a.activityOther
          ? `${a.activityNameLabel} (${a.activityOther})`
          : a.activityNameLabel;
      }
      const found = ACTIVITY_CHOICES.find((c) => c.key === a.activityName);
      const base = found ? found.label : String(a.activityName || 'Activity').replace(/_/g, ' ');
      return a.activityName === 'other' && a.activityOther ? `${base} (${a.activityOther})` : base;
    };

    const mergeActivities = (reportActs: any[], standaloneActs: any[]): any[] => {
      const byKey = new Map<string, any>();
      for (const a of reportActs || []) {
        const k = String(a.slotNumber || a.activityId || byKey.size + 1);
        byKey.set(k, a);
      }
      for (const sa of standaloneActs || []) {
        const k = String(sa.slotNumber || sa.activityId || byKey.size + 1);
        const cur = byKey.get(k);
        if (!cur) {
          byKey.set(k, sa);
        } else {
          const curTime = new Date(cur.updatedAt || cur.createdAt || 0).getTime();
          const saTime = new Date(sa.updatedAt || sa.createdAt || 0).getTime();
          const curCompleted = (cur.activityStatus || '').toLowerCase() === 'completed';
          const saCompleted = (sa.activityStatus || '').toLowerCase() === 'completed';
          if ((saCompleted && !curCompleted) || saTime > curTime) {
            byKey.set(k, { ...cur, ...sa });
          } else {
            byKey.set(k, {
              ...sa,
              ...cur,
              supportOther: cur.supportOther || sa.supportOther || '',
              groupDetails: cur.groupDetails || sa.groupDetails || '',
              activityOther: cur.activityOther || sa.activityOther || '',
              photoEvidence: mergeEvidenceUrls(cur.photoUrl || sa.photoUrl, [...(cur.photoEvidence || []), ...(sa.photoEvidence || [])]),
              videoEvidence: mergeEvidenceUrls(cur.videoUrl || sa.videoUrl, [...(cur.videoEvidence || []), ...(sa.videoEvidence || [])]),
            });
          }
        }
      }
      return Array.from(byKey.values()).sort((a, b) => (Number(a.slotNumber) || 0) - (Number(b.slotNumber) || 0));
    };

    const extractAttachments = (acts: any[], reportId: string, ownerUid: string, fallbackAt: string): ReportAttachment[] => {
      const result: ReportAttachment[] = [];
      const seen = new Set<string>();
      for (const a of acts) {
        const title = resolveActivityTitle(a);
        const photos = mergeEvidenceUrls(a.photoUrl, [...(a.photoEvidence || []), ...(a.photoUrls || [])]);
        for (let i = 0; i < photos.length; i++) {
          const url = photos[i];
          if (seen.has(url)) continue;
          seen.add(url);
          result.push({
            id: `${reportId}_s${a.slotNumber || 1}_p${i + 1}`,
            reportId,
            staffUid: ownerUid,
            storagePath: url,
            downloadUrl: url,
            originalFilename: `Activity ${a.slotNumber || 1} Photo ${i + 1} (${title})`,
            mimeType: 'image/jpeg',
            fileSize: 0,
            caption: `Slot #${a.slotNumber || 1}: ${title}${a.village ? ` - ${a.village}` : ''}`,
            uploadedByUid: ownerUid,
            uploadedAt: a.completedAt || a.activityEndAt || fallbackAt,
          });
        }
        const videos = mergeEvidenceUrls(a.videoUrl, [...(a.videoEvidence || []), ...(a.videoUrls || [])]);
        for (let i = 0; i < videos.length; i++) {
          const url = videos[i];
          if (seen.has(url)) continue;
          seen.add(url);
          result.push({
            id: `${reportId}_s${a.slotNumber || 1}_v${i + 1}`,
            reportId,
            staffUid: ownerUid,
            storagePath: url,
            downloadUrl: url,
            originalFilename: `Activity ${a.slotNumber || 1} Video ${i + 1} (${title})`,
            mimeType: 'video/mp4',
            fileSize: 0,
            caption: `Slot #${a.slotNumber || 1} Video: ${title}${a.village ? ` - ${a.village}` : ''}`,
            uploadedByUid: ownerUid,
            uploadedAt: a.completedAt || a.activityEndAt || fallbackAt,
          });
        }
      }
      return result;
    };

    const buildCompleteDailySummaryFields = (acts: any[]) => {
      const fullNamesList = acts.map((a) => `#${a.slotNumber || '?'}: ${resolveActivityTitle(a)}${a.village ? ` (${a.village})` : ''}`);
      const fullObservations = acts.map((a) => a.observations ? `#${a.slotNumber || '?'}: ${a.observations}` : '').filter(Boolean);
      const fullIssues = acts.map((a) => a.farmerIssues ? `#${a.slotNumber || '?'}: ${a.farmerIssues}` : '').filter(Boolean);
      const fullSupport = acts.map((a) => {
        const labels = (a.supportProvided || []).map((k: string) =>
          k === 'other' && a.supportOther ? `Other: ${a.supportOther}` : (SUPPORT_PROVIDED_OPTIONS.find((o) => o.key === k)?.label || k)
        );
        return labels.length > 0 ? `#${a.slotNumber || '?'}: ${labels.join(', ')}` : '';
      }).filter(Boolean);
      const fullFollowUp = acts.map((a) =>
        a.followUpRequired
          ? `#${a.slotNumber || '?'}: ${a.followUpDetails || 'Follow-up required'}${a.followUpDate ? ` (Due: ${a.followUpDate})` : ''}`
          : ''
      ).filter(Boolean);
      const meetings = acts.filter((a) => {
        const t = a.activityType || a.participantType || '';
        const isDesk = a.activityName === 'desk_job' || String(a.activityName || '').toLowerCase().includes('desk');
        return !isDesk && t !== 'single_farmer' && t !== '';
      }).length;
      const totalParticipants = acts.reduce((acc, a) => acc + (Number(a.totalParticipants) || 0), 0);

      return {
        activities: `${acts.length} ${acts.length === 1 ? 'activity' : 'activities'}: ${fullNamesList.join(' | ')}`,
        completedTasks: fullObservations.join(' | '),
        challenges: fullIssues.join(' | '),
        supportRequired: fullSupport.join(' | '),
        nextDayPlan: fullFollowUp.join(' | '),
        meetingsConducted: meetings,
        farmersVisited: totalParticipants,
      };
    };

    // Map Field Reports to DailyReport shape without truncation
    const fieldReportsMapped: DailyReport[] = fieldReportsRaw.map((f: any) => {
      const standalone = actsByStaffDate.get(`${f.staffUid}_${f.reportDate}`) || [];
      const acts = mergeActivities(f.activities || [], standalone);
      const firstStartIso = f.summary?.firstActivityStart || acts[0]?.activityStartAt || acts[0]?.activityStart;
      const lastEndIso = f.summary?.lastActivityEnd || acts[acts.length - 1]?.activityEndAt || acts[acts.length - 1]?.activityEnd;
      const loc = Array.from(new Set(acts.map((a) => [a.village, a.wadi].filter(Boolean).join(', ')).filter(Boolean))).join(' | ') || 'Field Operations';
      const summaryFields = buildCompleteDailySummaryFields(acts);
      const attachments = extractAttachments(acts, f.id, f.staffUid, f.updatedAt || f.createdAt || new Date().toISOString());

      return {
        id: f.id,
        staffUid: f.staffUid,
        employeeId: f.employeeId || 'EMP',
        staffName: f.staffName || 'Staff',
        staffEmail: f.staffEmail || '',
        departmentId: f.departmentId || '',
        departmentName: f.departmentName || 'Field Operations',
        centerId: f.centerId || '',
        centerName: f.centerName || 'Primary Center',
        reportDate: f.reportDate,
        workLocation: loc,
        workStartTime: firstStartIso ? formatTime24IST(firstStartIso) : '—',
        workEndTime: lastEndIso ? formatTime24IST(lastEndIso) : '—',
        activities: summaryFields.activities,
        completedTasks: summaryFields.completedTasks,
        farmersVisited: f.summary?.totalParticipantContacts ?? summaryFields.farmersVisited,
        meetingsConducted: summaryFields.meetingsConducted,
        challenges: summaryFields.challenges,
        supportRequired: summaryFields.supportRequired,
        nextDayPlan: summaryFields.nextDayPlan,
        attachments,
        status: f.status || 'draft',
        isLate: Boolean(f.isLate),
        hasLeaveConflict: Boolean(f.hasLeaveConflict),
        conflictDetails: f.conflictDetails,
        submittedAt: f.submittedAt || f.finalizationTimestamp,
        resubmittedAt: f.resubmittedAt,
        reviewerUid: f.reviewerUid,
        reviewerName: f.reviewerName,
        reviewedAt: f.reviewedAt,
        reviewComments: f.reviewComments,
        lastApproval: f.lastApproval,
        approvalHistory: f.approvalHistory || [],
        editRequest: f.editRequest,
        editRequestHistory: f.editRequestHistory || [],
        revisionNumber: f.revisionNumber || 1,
        crpCode: f.crpCode || '',
        blockTaluka: f.blockTaluka || '',
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        // Complete structured Field Activity details (no truncation)
        isFieldActivity: true,
        fieldActivitiesCount: f.summary?.totalActivities ?? acts.length,
        finalizationGps: f.finalizationGps || null,
        finalizationTimestamp: f.finalizationTimestamp,
        activitiesList: acts,
        fieldReport: { ...f, activities: acts },
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

    // Synthesize reports ONLY for standalone fieldActivities lacking a parent report document
    for (const [key, rawActs] of actsByStaffDate.entries()) {
      const existing = seenMap.get(key);
      if (existing) continue;

      const acts = mergeActivities([], rawActs);
      const firstAct = acts[0];
      const staffKey = firstAct.staffUid || firstAct.employeeUid;
      const reportId = firstAct.reportId || `field_rep_${staffKey}_${firstAct.reportDate}`;
      const loc = Array.from(new Set(acts.map((a) => [a.village, a.wadi].filter(Boolean).join(', ')).filter(Boolean))).join(' | ') || 'Field Operations';
      const hasCompleted = acts.some((a) => (a.activityStatus || '').toLowerCase() === 'completed');
      const firstStartIso = acts.find((a) => a.activityStartAt)?.activityStartAt;
      const lastEndIso = [...acts].reverse().find((a) => a.activityEndAt)?.activityEndAt;
      const summaryFields = buildCompleteDailySummaryFields(acts);
      const attachments = extractAttachments(acts, reportId, staffKey, firstAct.updatedAt || firstAct.createdAt);

      const synthesized: DailyReport = {
        id: reportId,
        staffUid: staffKey,
        employeeId: firstAct.employeeId || 'EMP',
        staffName: firstAct.employeeName || firstAct.staffName || 'Staff Member',
        staffEmail: '',
        departmentId: firstAct.departmentId || '',
        departmentName: firstAct.departmentName || 'Field Operations',
        centerId: firstAct.centerId || '',
        centerName: firstAct.centerName || 'Primary Center',
        reportDate: firstAct.reportDate,
        workLocation: loc,
        workStartTime: firstStartIso ? formatTime24IST(firstStartIso) : '—',
        workEndTime: lastEndIso ? formatTime24IST(lastEndIso) : '—',
        activities: summaryFields.activities,
        completedTasks: summaryFields.completedTasks,
        farmersVisited: summaryFields.farmersVisited,
        meetingsConducted: summaryFields.meetingsConducted,
        challenges: summaryFields.challenges,
        supportRequired: summaryFields.supportRequired,
        nextDayPlan: summaryFields.nextDayPlan,
        attachments,
        status: hasCompleted ? 'submitted' : 'draft',
        isLate: false,
        hasLeaveConflict: false,
        submittedAt: lastEndIso || firstAct.createdAt,
        revisionNumber: 1,
        crpCode: firstAct.crpCode || '',
        blockTaluka: firstAct.blockTaluka || '',
        createdAt: firstAct.createdAt,
        updatedAt: firstAct.updatedAt || firstAct.createdAt,
        isFieldActivity: true,
        fieldActivitiesCount: acts.length,
        finalizationGps: firstAct.activityEndGps || firstAct.activityEndLocation || null,
        activitiesList: acts,
        fieldReport: {
          id: reportId,
          staffUid: staffKey,
          employeeId: firstAct.employeeId || 'EMP',
          staffName: firstAct.employeeName || firstAct.staffName || 'Staff Member',
          staffEmail: '',
          departmentId: firstAct.departmentId || '',
          departmentName: firstAct.departmentName || 'Field Operations',
          centerId: firstAct.centerId || '',
          centerName: firstAct.centerName || 'Primary Center',
          reportDate: firstAct.reportDate,
          crpCode: firstAct.crpCode || '',
          blockTaluka: firstAct.blockTaluka || '',
          activities: acts,
          status: hasCompleted ? 'submitted' : 'draft',
          finalized: false,
          revisionNumber: 1,
        },
      } as any;

      if (departmentId && synthesized.departmentId !== departmentId) continue;
      if (centerId && synthesized.centerId !== centerId) continue;
      if (status && status !== 'all' && synthesized.status !== status) continue;

      seenMap.set(key, synthesized);
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

