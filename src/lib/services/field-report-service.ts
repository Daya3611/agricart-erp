import { fetchCollection, fetchDocument, saveDocument, updateDocument } from '@/lib/firebase/firestore';
import { adminDb, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import {
  FieldReport,
  FieldActivitySlot,
  FieldReportDailySummary,
  GpsCoordinate,
  LocationCaptureStatus,
  ReportStatus,
  UserProfile,
} from '@/types';
import { checkIfLateSubmission, normalizeReportDate } from '@/lib/utils/date-utils';
import { logAuditAction } from '@/lib/services/audit-service';

import { calculateActivitiesSummary } from '@/lib/utils/field-activity-calculations';
export { calculateActivitiesSummary };

/**
 * Check if a field report already exists for a staff member and report date.
 */
export async function checkExistingFieldReport(
  staffUid: string,
  reportDateInput: string
): Promise<{
  exists: boolean;
  isSubmitted: boolean;
  isRevisionRequired: boolean;
  isDraft: boolean;
  report: FieldReport | null;
}> {
  const reportDate = normalizeReportDate(reportDateInput);
  const docId = `field_rep_${staffUid}_${reportDate}`;

  let existing = (await fetchDocument(ERP_COLLECTIONS.fieldReports, docId)) as FieldReport | null;

  if (!existing) {
    const reports = (await fetchCollection(ERP_COLLECTIONS.fieldReports, [
      { field: 'staffUid', op: '==', value: staffUid },
      { field: 'reportDate', op: '==', value: reportDate },
    ])) as FieldReport[];
    if (reports.length > 0) {
      existing = reports[0];
    }
  }

  if (!existing) {
    return {
      exists: false,
      isSubmitted: false,
      isRevisionRequired: false,
      isDraft: false,
      report: null,
    };
  }

  const submittedStatuses: ReportStatus[] = ['submitted', 'under_review', 'resubmitted', 'approved', 'rejected'];
  const isSubmitted = submittedStatuses.includes(existing.status);
  const isRevisionRequired = existing.status === 'edit_requested' || existing.status === 'correction_requested';
  const isDraft = existing.status === 'draft';

  return {
    exists: true,
    isSubmitted,
    isRevisionRequired,
    isDraft,
    report: existing,
  };
}

/**
 * Save or submit a Field Activity Report.
 */
export async function createOrUpdateFieldReport(
  staffUser: UserProfile,
  data: {
    reportDate: string;
    crpCode?: string;
    blockTaluka?: string;
    activities: FieldActivitySlot[];
    finalizeNow: boolean;
    finalizationGps?: GpsCoordinate | null;
    finalizationLocationStatus?: LocationCaptureStatus;
    idempotencyKey?: string;
  }
): Promise<{ success: boolean; reportId?: string; error?: string }> {
  try {
    const reportDate = normalizeReportDate(data.reportDate);
    const docId = `field_rep_${staffUser.uid}_${reportDate}`;

    // Validate activities and compute summary
    const { summary, validatedActivities, errors } = calculateActivitiesSummary(
      data.activities || [],
      Boolean(data.finalizeNow)
    );

    if (errors.length > 0 && (data.finalizeNow || errors.some(e => e.includes('IN PROGRESS at a time')))) {
      return { success: false, error: errors[0] };
    }

    if (data.finalizeNow && validatedActivities.length === 0) {
      return { success: false, error: 'At least one completed activity slot must be recorded to finalize the daily report.' };
    }

    const existingCheck = await checkExistingFieldReport(staffUser.uid, reportDate);
    const existingDoc = existingCheck.report;

    if (existingDoc) {
      if (existingDoc.staffUid !== staffUser.uid) {
        return { success: false, error: 'FORBIDDEN: You cannot modify another employee\'s report.' };
      }
      if (existingDoc.status === 'approved') {
        return {
          success: false,
          error: `Report for ${reportDate} has already been approved and finalized. Modifications require authorized supervisor approval.`,
        };
      }
      if (existingCheck.isSubmitted && !existingCheck.isRevisionRequired && data.finalizeNow) {
        return {
          success: false,
          error: `A daily field activity report has already been submitted for ${reportDate}. Duplicate submissions are strictly prevented.`,
        };
      }
    }

    // Prevent non-admin employees from tampering with already completed activity timestamps & locations
    if (existingDoc && staffUser.role === 'staff' && existingDoc.activities) {
      const existingCompletedMap = new Map(
        existingDoc.activities
          .filter((a) => a.activityStatus === 'completed')
          .map((a) => [a.slotNumber, a])
      );

      for (const act of validatedActivities) {
        const old = existingCompletedMap.get(act.slotNumber);
        if (old) {
          act.activityStart = old.activityStart;
          act.activityStartAt = old.activityStartAt || old.activityStart;
          act.activityStartGps = old.activityStartGps;
          act.activityStartLocation = old.activityStartLocation || old.activityStartGps;
          act.activityEnd = old.activityEnd;
          act.activityEndAt = old.activityEndAt || old.activityEnd;
          act.activityEndGps = old.activityEndGps;
          act.activityEndLocation = old.activityEndLocation || old.activityEndGps;
          act.durationMinutes = old.durationMinutes;
          act.activityDurationMinutes = old.activityDurationMinutes || old.durationMinutes;
          act.activityStatus = 'completed';
        }
      }
    }

    const now = new Date().toISOString();
    const isLate = data.finalizeNow ? checkIfLateSubmission(reportDate, now) : false;
    const isEditResubmission = Boolean(existingDoc && (existingDoc.status === 'edit_requested' || existingDoc.status === 'correction_requested'));
    const revisionNumber = (existingDoc?.revisionNumber || 1) + (isEditResubmission ? 1 : 0);

    const newStatus: ReportStatus = data.finalizeNow
      ? (isEditResubmission ? 'resubmitted' : 'submitted')
      : (existingDoc?.status || 'draft');

    // Check for approved leave conflict
    let hasLeaveConflict = false;
    let conflictDetails: string | undefined = undefined;
    try {
      const leaves = (await fetchCollection(ERP_COLLECTIONS.leaveRecords, [
        { field: 'staffUid', op: '==', value: staffUser.uid },
        { field: 'approvalStatus', op: '==', value: 'approved' },
      ])) as any[];
      const conflictingLeave = leaves.find((l) => l.startDate <= reportDate && l.endDate >= reportDate);
      if (conflictingLeave) {
        hasLeaveConflict = true;
        conflictDetails = `Report submitted on approved leave date (${conflictingLeave.leaveType?.toUpperCase() || 'LEAVE'}, ${conflictingLeave.startDate} to ${conflictingLeave.endDate})`;
      }
    } catch { }

    const reportRecord: FieldReport = {
      id: docId,
      staffUid: staffUser.uid,
      employeeId: staffUser.employeeId || '',
      staffName: staffUser.fullName || 'Staff Member',
      staffEmail: staffUser.email || '',
      departmentId: staffUser.departmentId || '',
      departmentName: staffUser.departmentName || 'Field Operations',
      centerId: staffUser.assignedCenterIds?.[0] || 'center_default',
      centerName: staffUser.assignedCenterNames?.[0] || 'Primary Center',
      reportDate,
      crpCode: data.crpCode || '',
      blockTaluka: data.blockTaluka || '',
      activities: validatedActivities,
      summary,
      status: newStatus,
      finalized: data.finalizeNow,
      finalizationTimestamp: data.finalizeNow ? (existingDoc?.finalizationTimestamp || now) : existingDoc?.finalizationTimestamp,
      finalizationGps: data.finalizeNow ? (data.finalizationGps || null) : (existingDoc?.finalizationGps || null),
      finalizationLocationStatus: data.finalizeNow ? (data.finalizationLocationStatus || (data.finalizationGps ? 'captured' : 'unavailable')) : existingDoc?.finalizationLocationStatus,
      submittedAt: data.finalizeNow ? (existingDoc?.submittedAt || now) : existingDoc?.submittedAt,
      resubmittedAt: isEditResubmission && data.finalizeNow ? now : existingDoc?.resubmittedAt,
      isLate,
      hasLeaveConflict,
      conflictDetails,
      reviewerUid: existingDoc?.reviewerUid,
      reviewerName: existingDoc?.reviewerName,
      reviewedAt: existingDoc?.reviewedAt,
      reviewComments: existingDoc?.reviewComments,
      revisionNumber,
      createdAt: existingDoc?.createdAt || now,
      updatedAt: now,
      syncStatus: 'synced',
      idempotencyKey: data.idempotencyKey || `key_${docId}_${Date.now()}`,
    };

    // Concurrency safe transaction
    if (hasValidAdminCredentials) {
      const docRef = adminDb.collection(ERP_COLLECTIONS.fieldReports).doc(docId);
      await adminDb.runTransaction(async (transaction: any) => {
        const snap = await transaction.get(docRef);
        if (snap.exists) {
          const cur = snap.data() as FieldReport;
          const submittedStatuses: ReportStatus[] = ['submitted', 'under_review', 'resubmitted', 'approved', 'rejected'];
          if (
            data.finalizeNow &&
            submittedStatuses.includes(cur.status) &&
            cur.status !== 'edit_requested' &&
            cur.status !== 'correction_requested'
          ) {
            throw new Error(`A field report has already been submitted for ${reportDate}. Duplicate submissions are not allowed.`);
          }
        }
        transaction.set(docRef, reportRecord, { merge: true });
      });
    } else {
      const { runTransaction: clientRunTransaction, doc: clientDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase/client');
      const docRef = clientDoc(db, ERP_COLLECTIONS.fieldReports, docId);
      await clientRunTransaction(db, async (transaction) => {
        const snap = await transaction.get(docRef);
        if (snap.exists()) {
          const cur = snap.data() as FieldReport;
          const submittedStatuses: ReportStatus[] = ['submitted', 'under_review', 'resubmitted', 'approved', 'rejected'];
          if (
            data.finalizeNow &&
            submittedStatuses.includes(cur.status) &&
            cur.status !== 'edit_requested' &&
            cur.status !== 'correction_requested'
          ) {
            throw new Error(`A field report has already been submitted for ${reportDate}. Duplicate submissions are not allowed.`);
          }
        }
        transaction.set(docRef, reportRecord, { merge: true });
      });
    }

    // Also persist each activity slot in erp_field_activities for granular queries
    for (const act of validatedActivities) {
      const actId = `act_${docId}_${act.slotNumber}`;
      await saveDocument(ERP_COLLECTIONS.fieldActivities, actId, {
        id: actId,
        reportId: docId,
        staffUid: staffUser.uid,
        employeeId: staffUser.employeeId || '',
        staffName: staffUser.fullName || '',
        departmentId: staffUser.departmentId || '',
        departmentName: staffUser.departmentName || '',
        centerId: staffUser.assignedCenterIds?.[0] || '',
        centerName: staffUser.assignedCenterNames?.[0] || '',
        reportDate,
        ...act,
        updatedAt: now,
      });
    }

    await logAuditAction({
      actorUid: staffUser.uid,
      actorName: staffUser.fullName,
      actorRole: staffUser.role,
      action: data.finalizeNow ? (isEditResubmission ? 'resubmit_field_report' : 'finalize_field_report') : 'save_field_draft',
      resourceType: 'report',
      resourceId: docId,
      details: `${data.finalizeNow ? 'Finalized field report' : 'Saved draft field report'} for ${reportDate} with ${validatedActivities.length} activities (Revision #${revisionNumber})`,
    });

    return { success: true, reportId: docId };
  } catch (err: any) {
    console.error('createOrUpdateFieldReport error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Review a Field Report (approve, reject, or request correction).
 */
export async function reviewFieldReport(
  reviewer: UserProfile,
  reportId: string,
  actionStatus: 'approved' | 'correction_requested' | 'rejected',
  comment: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!['super_admin', 'admin', 'manager'].includes(reviewer.role)) {
      return { success: false, error: 'FORBIDDEN: Only administrators and managers can review reports.' };
    }

    // Use multi-tier fallback to resolve the report even if docId format differs or report is draft/synthetic
    let report = (await fetchDocument(ERP_COLLECTIONS.fieldReports, reportId)) as FieldReport | null;
    if (!report) {
      report = await getFieldReportById(reportId);
    }
    if (!report) {
      return { success: false, error: 'Field Report not found.' };
    }

    const now = new Date().toISOString();
    const targetDocId = report.id || reportId;

    const updatedFields: Partial<FieldReport> = {
      status: actionStatus as ReportStatus,
      reviewerUid: reviewer.uid,
      reviewerName: reviewer.fullName,
      reviewedAt: now,
      reviewComments: comment || '',
      updatedAt: now,
    };

    // Upsert to erp_field_reports
    await saveDocument(ERP_COLLECTIONS.fieldReports, targetDocId, {
      ...report,
      ...updatedFields,
      id: targetDocId,
    });

    // Also update legacy dailyReports if it existed
    try {
      const legacy = await fetchDocument(ERP_COLLECTIONS.dailyReports, targetDocId);
      if (legacy) {
        await updateDocument(ERP_COLLECTIONS.dailyReports, targetDocId, {
          status: actionStatus as any,
          reviewerUid: reviewer.uid,
          reviewerName: reviewer.fullName,
          reviewedAt: now,
          reviewComments: comment || '',
          updatedAt: now,
        });
      }
    } catch {
      // Ignore legacy sync failures
    }

    // Save review record in erp_field_report_reviews
    const reviewId = `rev_${targetDocId}_${Date.now()}`;
    await saveDocument(ERP_COLLECTIONS.fieldReportReviews, reviewId, {
      id: reviewId,
      reportId: targetDocId,
      reviewerUid: reviewer.uid,
      reviewerName: reviewer.fullName,
      reviewerRole: reviewer.role,
      decision: actionStatus,
      comment: comment || '',
      reviewedAt: now,
    });

    await logAuditAction({
      actorUid: reviewer.uid,
      actorName: reviewer.fullName,
      actorRole: reviewer.role,
      action: `field_report_review_${actionStatus}`,
      resourceType: 'report',
      resourceId: targetDocId,
      details: `Reviewed field report for ${report.staffName} (${report.reportDate}): status changed to ${actionStatus}`,
    });

    return { success: true };
  } catch (err: any) {
    console.error('reviewFieldReport error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Adapt a legacy DailyReport to FieldReport structure for seamless PDF export and inspection.
 */
function adaptLegacyReportToFieldReport(legacy: any): FieldReport {
  const acts: FieldActivitySlot[] = [
    {
      slotNumber: 1,
      activityStatus: 'completed',
      activityStartAt: legacy.workStartTime ? `${legacy.reportDate}T${legacy.workStartTime}:00` : `${legacy.reportDate}T09:00:00`,
      activityStart: legacy.workStartTime ? `${legacy.reportDate}T${legacy.workStartTime}:00` : `${legacy.reportDate}T09:00:00`,
      activityStartLocation: null,
      activityStartGps: null,
      activityStartLocationStatus: 'unavailable',
      activityName: 'field_visit',
      activityNameLabel: 'Field Operations / Daily Visit',
      village: legacy.workLocation || 'Field Operations Area',
      totalParticipants: legacy.farmersVisited || 0,
      maleParticipants: 0,
      femaleParticipants: 0,
      observations: [
        legacy.activities ? `Activities: ${legacy.activities}` : '',
        legacy.completedTasks ? `Tasks Completed: ${legacy.completedTasks}` : '',
        legacy.achievements ? `Achievements: ${legacy.achievements}` : '',
      ].filter(Boolean).join('\n\n') || 'Daily field work documented.',
      farmerIssues: legacy.challenges || '',
      supportProvided: [],
      followUpRequired: Boolean(legacy.nextDayPlan),
      followUpDetails: legacy.nextDayPlan ? `Next Day Plan: ${legacy.nextDayPlan}` : undefined,
      activityEndAt: legacy.workEndTime ? `${legacy.reportDate}T${legacy.workEndTime}:00` : `${legacy.reportDate}T18:00:00`,
      activityEnd: legacy.workEndTime ? `${legacy.reportDate}T${legacy.workEndTime}:00` : `${legacy.reportDate}T18:00:00`,
      activityEndLocation: null,
      activityEndGps: null,
      activityEndLocationStatus: 'unavailable',
      durationMinutes: 480,
      activityDurationMinutes: 480,
    },
  ];

  return {
    id: legacy.id,
    staffUid: legacy.staffUid,
    employeeId: legacy.employeeId || 'EMP',
    staffName: legacy.staffName || 'Staff Member',
    staffEmail: legacy.staffEmail || '',
    departmentId: legacy.departmentId || '',
    departmentName: legacy.departmentName || 'Field Operations',
    centerId: legacy.centerId || '',
    centerName: legacy.centerName || 'Nashik Center',
    reportDate: legacy.reportDate,
    activities: acts,
    summary: {
      totalActivities: 1,
      totalActivityMinutes: 480,
      totalActivityHours: 8,
      firstActivityStart: acts[0].activityStart,
      lastActivityEnd: acts[0].activityEnd,
      totalWorkingPeriodMinutes: 480,
      totalWorkingPeriodHours: 8,
      totalDeskJobMinutes: 0,
      totalFieldActivityMinutes: 480,
      totalParticipantContacts: legacy.farmersVisited || 0,
      totalMaleParticipants: 0,
      totalFemaleParticipants: 0,
    },
    status: legacy.status || 'submitted',
    finalized: legacy.status !== 'draft',
    submittedAt: legacy.submittedAt,
    reviewerUid: legacy.reviewerUid,
    reviewerName: legacy.reviewerName,
    reviewedAt: legacy.reviewedAt,
    reviewComments: legacy.reviewComments,
    revisionNumber: legacy.revisionNumber || 1,
    createdAt: legacy.createdAt || new Date().toISOString(),
    updatedAt: legacy.updatedAt || new Date().toISOString(),
  };
}

/**
 * Fetch a Field Report by ID with multi-tier fallback:
 * 1. Look in erp_field_reports by docId
 * 2. Look in erp_daily_reports by docId (for legacy reports)
 * 3. If ID matches (field_rep|report)_<staffUid>_<reportDate>:
 *    Query erp_field_reports by staffUid & reportDate
 *    Query erp_daily_reports by staffUid & reportDate
 * 4. If still not found, check employee record and synthesize a draft FieldReport
 *    so downloading today's / draft daily report never fails with 404!
 */
export async function getFieldReportById(reportId: string): Promise<FieldReport | null> {
  // Tier 1: Direct fetch in erp_field_reports
  const report = (await fetchDocument(ERP_COLLECTIONS.fieldReports, reportId)) as FieldReport | null;
  if (report) return report;

  // Tier 2: Direct fetch in erp_daily_reports (legacy)
  const legacyDirect = (await fetchDocument(ERP_COLLECTIONS.dailyReports, reportId)) as any;
  if (legacyDirect) {
    return adaptLegacyReportToFieldReport(legacyDirect);
  }

  // Tier 3: Parse pattern (field_rep|report)_<staffUid>_<reportDate>
  const match = reportId.match(/(?:field_rep|report)_([^_]+)_(\d{4}-\d{2}-\d{2})/);
  if (match) {
    const staffUid = match[1];
    const reportDate = match[2];

    // Check erp_field_reports by query
    const fieldQuery = (await fetchCollection(ERP_COLLECTIONS.fieldReports, [
      { field: 'staffUid', op: '==', value: staffUid },
      { field: 'reportDate', op: '==', value: reportDate },
    ])) as FieldReport[];
    if (fieldQuery.length > 0) {
      return fieldQuery[0];
    }

    // Check erp_daily_reports by query
    const dailyQuery = (await fetchCollection(ERP_COLLECTIONS.dailyReports, [
      { field: 'staffUid', op: '==', value: staffUid },
      { field: 'reportDate', op: '==', value: reportDate },
    ])) as any[];
    if (dailyQuery.length > 0) {
      return adaptLegacyReportToFieldReport(dailyQuery[0]);
    }

    // Tier 4: Synthesize draft report for existing employee
    const empDoc = (await fetchDocument(ERP_COLLECTIONS.employees, staffUid)) as any;
    if (empDoc) {
      // Check if any individual activities were saved in erp_field_activities
      const actsQuery = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, [
        { field: 'staffUid', op: '==', value: staffUid },
        { field: 'reportDate', op: '==', value: reportDate },
      ])) as FieldActivitySlot[];

      // Sort by slotNumber
      actsQuery.sort((a, b) => a.slotNumber - b.slotNumber);

      const defaultSlot: FieldActivitySlot = {
        slotNumber: 1,
        activityStatus: 'not_started',
        activityStart: `${reportDate}T09:00:00`,
        activityStartAt: `${reportDate}T09:00:00`,
        activityStartLocation: null,
        activityStartGps: null,
        activityStartLocationStatus: 'unavailable',
        activityName: 'farmer_visit',
        activityNameLabel: 'Field Activity (Draft)',
        village: empDoc.assignedCenterNames?.[0] || 'Assigned Field Area',
        totalParticipants: 0,
        maleParticipants: 0,
        femaleParticipants: 0,
        observations: 'Draft report in progress (Pending final submission)',
        supportProvided: [],
        followUpRequired: false,
        activityEnd: `${reportDate}T18:00:00`,
        activityEndAt: `${reportDate}T18:00:00`,
        activityEndLocation: null,
        activityEndGps: null,
        activityEndLocationStatus: 'unavailable',
        durationMinutes: 0,
        activityDurationMinutes: 0,
      };

      const finalActivities = actsQuery.length > 0 ? actsQuery : [defaultSlot];
      const { summary } = calculateActivitiesSummary(finalActivities, false);

      const syntheticReport: FieldReport = {
        id: reportId,
        staffUid,
        employeeId: empDoc.employeeId || 'EMP',
        staffName: empDoc.fullName || 'Staff Member',
        staffEmail: empDoc.email || '',
        departmentId: empDoc.departmentId || '',
        departmentName: empDoc.departmentName || 'Field Operations',
        centerId: empDoc.assignedCenterIds?.[0] || '',
        centerName: empDoc.assignedCenterNames?.[0] || 'Nashik Center',
        reportDate,
        activities: finalActivities,
        summary,
        status: 'draft',
        finalized: false,
        revisionNumber: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return syntheticReport;
    }
  }

  return null;
}

/**
 * List Field Reports with flexible filtering and authorization.
 */
export async function listFieldReports(
  user: UserProfile,
  filters: {
    startDate?: string;
    endDate?: string;
    reportDate?: string;
    departmentId?: string;
    centerId?: string;
    staffUid?: string;
    status?: string;
  }
): Promise<FieldReport[]> {
  const queryFilters: { field: string; op: any; value: any }[] = [];

  // Staff can only view their own reports
  if (user.role === 'staff') {
    queryFilters.push({ field: 'staffUid', op: '==', value: user.uid });
  } else if (user.role === 'manager' && user.departmentId) {
    queryFilters.push({ field: 'departmentId', op: '==', value: user.departmentId });
  }

  if (filters.staffUid && user.role !== 'staff') {
    queryFilters.push({ field: 'staffUid', op: '==', value: filters.staffUid });
  }
  if (filters.departmentId) {
    queryFilters.push({ field: 'departmentId', op: '==', value: filters.departmentId });
  }
  if (filters.centerId) {
    queryFilters.push({ field: 'centerId', op: '==', value: filters.centerId });
  }
  if (filters.status && filters.status !== 'all') {
    queryFilters.push({ field: 'status', op: '==', value: filters.status });
  }
  if (filters.reportDate) {
    queryFilters.push({ field: 'reportDate', op: '==', value: filters.reportDate });
  }

  let reports = (await fetchCollection(ERP_COLLECTIONS.fieldReports, queryFilters)) as FieldReport[];

  if (filters.startDate || filters.endDate) {
    reports = reports.filter((r) => {
      if (filters.startDate && r.reportDate < filters.startDate) return false;
      if (filters.endDate && r.reportDate > filters.endDate) return false;
      return true;
    });
  }

  reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return reports;
}
