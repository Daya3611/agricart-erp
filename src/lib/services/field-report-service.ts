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

import {
  calculateActivitiesSummary,
  deduplicateActivityRecords,
  mergeDayActivities,
  mergeEvidenceUrls,
  normalizeActivityStatus,
} from '@/lib/utils/field-activity-calculations';
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

    // Lookup existing individual activities to preserve IDs, prevent duplicates, and guard completed state
    const existingActDocs = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, [
      { field: 'staffUid', op: '==', value: staffUser.uid },
      { field: 'reportDate', op: '==', value: reportDate },
    ])) as any[];
    const existingActById = new Map<string, any>();
    for (const a of existingActDocs) {
      const aid = a.activityId || a.id;
      if (aid) existingActById.set(aid, a);
    }
    const existingActBySlot = new Map<number, any>();
    for (const canonicalDoc of deduplicateActivityRecords(
      existingActDocs,
      (a) => String(Number(a.slotNumber) || 1)
    )) {
      const s = Number(canonicalDoc.slotNumber);
      if (s > 0) existingActBySlot.set(s, canonicalDoc);
    }

    // Build authoritative map of already COMPLETED slots across both erp_field_reports and erp_field_activities
    const existingCompletedMap = new Map<number, any>();
    for (const a of existingDoc?.activities || []) {
      if (normalizeActivityStatus(a) === 'COMPLETED') {
        existingCompletedMap.set(Number(a.slotNumber), a);
      }
    }
    for (const [slotNum, a] of existingActBySlot.entries()) {
      if (normalizeActivityStatus(a) === 'COMPLETED' && !existingCompletedMap.has(slotNum)) {
        existingCompletedMap.set(slotNum, a);
      }
    }

    // Guard against offline sync or stale client drafts attempting to downgrade COMPLETED activities back to IN_PROGRESS
    const sanitizedInputActivities: FieldActivitySlot[] = (data.activities || []).map((incoming) => {
      const slotNum = Number(incoming.slotNumber) || 1;
      const existingCompleted = existingCompletedMap.get(slotNum);
      if (!existingCompleted) {
        return {
          ...incoming,
          activityStatus: normalizeActivityStatus(incoming),
        };
      }

      const incomingStatus = normalizeActivityStatus(incoming);
      const canonicalId =
        existingCompleted.activityId || existingCompleted.id || incoming.activityId || incoming.id;

      // Stale client sent IN_PROGRESS / NOT_STARTED for an activity already COMPLETED in Firestore: keep Firestore's completed record intact
      if (incomingStatus !== 'COMPLETED') {
        return {
          ...incoming,
          ...existingCompleted,
          activityId: canonicalId,
          id: canonicalId,
          slotNumber: slotNum,
          activityStatus: 'COMPLETED',
        };
      }

      // Client also shows COMPLETED (e.g. reopened correction mode): preserve verified start/end timestamps & GPS for staff
      if (staffUser.role === 'staff' && (existingCompleted.activityStartAt || existingCompleted.activityStart)) {
        return {
          ...incoming,
          activityId: canonicalId,
          id: canonicalId,
          slotNumber: slotNum,
          activityStatus: 'COMPLETED',
          activityStart: existingCompleted.activityStart || existingCompleted.activityStartAt || '',
          activityStartAt: existingCompleted.activityStartAt || existingCompleted.activityStart || '',
          activityStartGps: existingCompleted.activityStartGps ?? existingCompleted.activityStartLocation ?? null,
          activityStartLocation: existingCompleted.activityStartLocation ?? existingCompleted.activityStartGps ?? null,
          activityStartLocationStatus: existingCompleted.activityStartLocationStatus || incoming.activityStartLocationStatus,
          activityEnd: existingCompleted.activityEnd || existingCompleted.activityEndAt || '',
          activityEndAt: existingCompleted.activityEndAt || existingCompleted.activityEnd || '',
          activityEndGps: existingCompleted.activityEndGps ?? existingCompleted.activityEndLocation ?? null,
          activityEndLocation: existingCompleted.activityEndLocation ?? existingCompleted.activityEndGps ?? null,
          activityEndLocationStatus: existingCompleted.activityEndLocationStatus || incoming.activityEndLocationStatus,
          durationMinutes: existingCompleted.durationMinutes || existingCompleted.activityDurationMinutes || incoming.durationMinutes,
          activityDurationMinutes: existingCompleted.activityDurationMinutes || existingCompleted.durationMinutes || incoming.activityDurationMinutes,
        };
      }

      return {
        ...incoming,
        activityId: canonicalId,
        id: canonicalId,
        slotNumber: slotNum,
        activityStatus: 'COMPLETED',
      };
    });

    // Validate sanitized activities and compute summary
    const { summary, validatedActivities, errors } = calculateActivitiesSummary(
      sanitizedInputActivities,
      Boolean(data.finalizeNow)
    );

    if (errors.length > 0 && (data.finalizeNow || errors.some(e => e.includes('IN PROGRESS at a time')))) {
      return { success: false, error: errors[0] };
    }

    if (data.finalizeNow && validatedActivities.length === 0) {
      return { success: false, error: 'At least one completed activity slot must be recorded to finalize the daily report.' };
    }

    // Assign canonical activityId on each validated slot before saving parent report
    for (const act of validatedActivities) {
      const matchedDoc = existingActById.get(act.activityId || act.id || '') || existingActBySlot.get(act.slotNumber);
      const canonicalId = act.activityId || act.id || matchedDoc?.activityId || matchedDoc?.id || `act_${docId}_${act.slotNumber}`;
      act.activityId = canonicalId;
      act.id = canonicalId;
      act.activityStatus = normalizeActivityStatus(act);
    }

    const now = new Date().toISOString();
    const isLate = data.finalizeNow ? checkIfLateSubmission(reportDate, now) : false;
    const isEditResubmission = Boolean(existingDoc && (existingDoc.status === 'edit_requested' || existingDoc.status === 'correction_requested'));
    const revisionNumber = (existingDoc?.revisionNumber || 1) + (isEditResubmission && data.finalizeNow ? 1 : 0);

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

    let resolvedEditRequest = existingDoc?.editRequest;
    let resolvedEditHistory = existingDoc?.editRequestHistory ? [...existingDoc.editRequestHistory] : [];
    if (isEditResubmission && data.finalizeNow && resolvedEditRequest) {
      resolvedEditRequest = {
        ...resolvedEditRequest,
        status: 'resolved',
        resolvedAt: now,
      };
      resolvedEditHistory = resolvedEditHistory.map((er) =>
        er.id === resolvedEditRequest!.id ? resolvedEditRequest! : er
      );
    }

    const rawRecord: Record<string, any> = {
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
      crpCode: data.crpCode !== undefined ? data.crpCode : (existingDoc?.crpCode || ''),
      blockTaluka: data.blockTaluka !== undefined ? data.blockTaluka : (existingDoc?.blockTaluka || ''),
      activities: validatedActivities,
      summary,
      status: newStatus,
      finalized: data.finalizeNow ? true : Boolean(existingDoc?.finalized),
      finalizationTimestamp: data.finalizeNow ? (existingDoc?.finalizationTimestamp || now) : existingDoc?.finalizationTimestamp,
      finalizationGps: data.finalizeNow ? (data.finalizationGps ?? null) : (existingDoc?.finalizationGps ?? null),
      finalizationLocationStatus: data.finalizeNow
        ? (data.finalizationLocationStatus || (data.finalizationGps ? 'captured' : 'unavailable'))
        : existingDoc?.finalizationLocationStatus,
      submittedAt: data.finalizeNow ? (existingDoc?.submittedAt || now) : existingDoc?.submittedAt,
      resubmittedAt: isEditResubmission && data.finalizeNow ? now : existingDoc?.resubmittedAt,
      isLate,
      hasLeaveConflict,
      conflictDetails,
      reviewerUid: existingDoc?.reviewerUid,
      reviewerName: existingDoc?.reviewerName,
      reviewerRole: existingDoc?.reviewerRole,
      reviewedAt: existingDoc?.reviewedAt,
      reviewComments: existingDoc?.reviewComments,
      editRequest: resolvedEditRequest,
      editRequestHistory: resolvedEditHistory.length > 0 ? resolvedEditHistory : undefined,
      lastApproval: existingDoc?.lastApproval,
      approvalHistory: existingDoc?.approvalHistory,
      revisionNumber,
      createdAt: existingDoc?.createdAt || now,
      updatedAt: now,
      syncStatus: 'synced',
      idempotencyKey: data.idempotencyKey || `key_${docId}_${Date.now()}`,
    };

    const reportRecord = Object.fromEntries(
      Object.entries(rawRecord).filter(([, v]) => v !== undefined)
    ) as unknown as FieldReport;

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

    // Persist started/completed/cancelled activity slots in erp_field_activities (never write NOT_STARTED placeholders or leave stale IN_PROGRESS duplicates)
    for (const act of validatedActivities) {
      const actStatus = normalizeActivityStatus(act);
      const actId = act.activityId || `act_${docId}_${act.slotNumber}`;
      if (actStatus === 'NOT_STARTED' && !existingActById.has(actId)) {
        continue;
      }
      const mergedPhotos = mergeEvidenceUrls(act.photoUrl, act.photoEvidence);
      const mergedVideos = mergeEvidenceUrls(act.videoUrl, act.videoEvidence);
      await saveDocument(ERP_COLLECTIONS.fieldActivities, actId, {
        ...act,
        activityStatus: actStatus,
        activityId: actId,
        id: actId,
        reportId: docId,
        staffUid: staffUser.uid,
        employeeUid: staffUser.uid,
        employeeId: staffUser.employeeId || '',
        employeeName: staffUser.fullName || 'Staff Member',
        staffName: staffUser.fullName || 'Staff Member',
        departmentId: staffUser.departmentId || '',
        departmentName: staffUser.departmentName || '',
        centerId: staffUser.assignedCenterIds?.[0] || '',
        centerName: staffUser.assignedCenterNames?.[0] || '',
        reportDate,
        crpCode: reportRecord.crpCode || '',
        blockTaluka: reportRecord.blockTaluka || '',
        participantType: act.participantType || act.activityType || 'group',
        activityType: act.activityType || act.participantType || 'group',
        photoUrl: mergedPhotos[0] || '',
        photoEvidence: mergedPhotos,
        videoUrl: mergedVideos[0] || '',
        videoEvidence: mergedVideos,
        syncStatus: 'synced',
        updatedAt: now,
      });

      // Reconcile any duplicate sibling IN_PROGRESS doc for this slot if this slot is COMPLETED or CANCELLED
      if (actStatus === 'COMPLETED' || actStatus === 'CANCELLED') {
        for (const dup of existingActDocs) {
          const dupId = dup.activityId || dup.id;
          if (
            dupId &&
            dupId !== actId &&
            (Number(dup.slotNumber) || 1) === (Number(act.slotNumber) || 1) &&
            normalizeActivityStatus(dup) === 'IN_PROGRESS'
          ) {
            await updateDocument(ERP_COLLECTIONS.fieldActivities, dupId, {
              activityStatus: actStatus,
              ...(actStatus === 'COMPLETED'
                ? {
                    activityEndAt: act.activityEndAt || act.activityEnd || now,
                    completedAt: act.completedAt || act.activityEndAt || act.activityEnd || now,
                    activityDurationMinutes: act.activityDurationMinutes ?? act.durationMinutes ?? 1,
                    durationMinutes: act.durationMinutes ?? act.activityDurationMinutes ?? 1,
                  }
                : {}),
              updatedAt: now,
            });
          }
        }
      }
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
 * Review a Field Report (approve, reject, request correction, or request edit).
 */
export async function reviewFieldReport(
  reviewer: UserProfile,
  reportId: string,
  actionStatus: 'approved' | 'correction_requested' | 'edit_requested' | 'rejected',
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
    const trimmedComment = (comment || '').trim();
    const isReopened = actionStatus === 'correction_requested' || actionStatus === 'edit_requested';

    let lastApproval = report.lastApproval;
    const approvalHistory = [...(report.approvalHistory || [])];
    let editRequest = report.editRequest;
    const editRequestHistory = [...(report.editRequestHistory || [])];

    if (actionStatus === 'approved' || actionStatus === 'rejected') {
      const approvalEntry = {
        reviewerUid: reviewer.uid,
        reviewerName: reviewer.fullName,
        reviewerRole: reviewer.role,
        decision: actionStatus,
        decidedAt: now,
        comments: trimmedComment,
        revisionNumber: report.revisionNumber || 1,
      };
      lastApproval = approvalEntry;
      approvalHistory.push(approvalEntry);
      if (editRequest && editRequest.status === 'pending') {
        editRequest = { ...editRequest, status: 'resolved', resolvedAt: now };
      }
    } else if (isReopened) {
      // Preserve lastApproval if it was previously approved
      if (report.status === 'approved' && !lastApproval && report.reviewerUid) {
        lastApproval = {
          reviewerUid: report.reviewerUid,
          reviewerName: report.reviewerName || 'Reviewer',
          reviewerRole: report.reviewerRole || 'reviewer',
          decision: 'approved',
          decidedAt: report.reviewedAt || report.updatedAt || now,
          comments: report.reviewComments || '',
          revisionNumber: report.revisionNumber || 1,
        };
        if (approvalHistory.length === 0) approvalHistory.push(lastApproval);
      }

      const editRec = {
        id: `edr_${targetDocId}_${Date.now()}`,
        reportId: targetDocId,
        reason: trimmedComment || (actionStatus === 'edit_requested' ? 'Edit requested by supervisor.' : 'Correction requested by supervisor.'),
        instructions: '',
        requesterUid: reviewer.uid,
        requesterName: reviewer.fullName,
        requesterRole: reviewer.role,
        requestedAt: now,
        status: 'pending' as const,
      };
      editRequest = editRec;
      editRequestHistory.push(editRec);
    }

    const updatedFields: Partial<FieldReport> = {
      status: actionStatus as ReportStatus,
      finalized: isReopened ? false : true,
      reviewerUid: reviewer.uid,
      reviewerName: reviewer.fullName,
      reviewerRole: reviewer.role,
      reviewedAt: now,
      reviewComments: trimmedComment,
      lastApproval,
      approvalHistory,
      editRequest,
      editRequestHistory,
      updatedAt: now,
    };

    // Upsert to erp_field_reports
    await saveDocument(ERP_COLLECTIONS.fieldReports, targetDocId, {
      ...report,
      ...updatedFields,
      id: targetDocId,
    });

    // Save comment entry for comment timeline if comment is present
    if (trimmedComment) {
      const commentId = `cmt_${targetDocId}_${Date.now()}`;
      await saveDocument(ERP_COLLECTIONS.reportComments, commentId, {
        id: commentId,
        reportId: targetDocId,
        authorUid: reviewer.uid,
        authorName: reviewer.fullName,
        authorRole: reviewer.role,
        comment: isReopened ? `[${actionStatus.toUpperCase()}] ${trimmedComment}` : trimmedComment,
        createdAt: now,
      });
    }

    // Also update legacy dailyReports if it existed
    try {
      const legacy = await fetchDocument(ERP_COLLECTIONS.dailyReports, targetDocId);
      if (legacy) {
        await updateDocument(ERP_COLLECTIONS.dailyReports, targetDocId, {
          status: actionStatus as any,
          reviewerUid: reviewer.uid,
          reviewerName: reviewer.fullName,
          reviewedAt: now,
          reviewComments: trimmedComment,
          lastApproval,
          approvalHistory,
          editRequest,
          editRequestHistory,
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
      comment: trimmedComment,
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
 * Request an edit on a submitted/approved Field Report with reason & structured instructions.
 */
export async function requestFieldReportEdit(
  reviewer: { uid: string; fullName: string; role: any },
  reportId: string,
  params: { reason: string; instructions?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!['super_admin', 'admin', 'manager'].includes(reviewer.role)) {
      return { success: false, error: 'FORBIDDEN: Only administrators and managers can request report edits.' };
    }

    const report = (await fetchDocument(ERP_COLLECTIONS.fieldReports, reportId)) as FieldReport | null
      || await getFieldReportById(reportId);
    if (!report) {
      return { success: false, error: 'Field Report not found.' };
    }

    if (report.status === 'edit_requested' || (report.editRequest && report.editRequest.status === 'pending')) {
      return { success: false, error: 'An edit request is already pending for this report.' };
    }

    if (!params.reason || !params.reason.trim()) {
      return { success: false, error: 'A valid reason for requesting an edit is required.' };
    }

    const combinedComment = `${params.reason.trim()}${params.instructions?.trim() ? `\nInstructions: ${params.instructions.trim()}` : ''}`;
    const res = await reviewFieldReport(reviewer as UserProfile, report.id || reportId, 'edit_requested', combinedComment);
    if (!res.success) return res;

    // Enrich editRequest instructions on the stored document
    const targetDocId = report.id || reportId;
    const updatedReport = (await fetchDocument(ERP_COLLECTIONS.fieldReports, targetDocId)) as FieldReport | null;
    if (updatedReport?.editRequest) {
      const updatedReq = {
        ...updatedReport.editRequest,
        reason: params.reason.trim(),
        instructions: params.instructions?.trim() || '',
      };
      const updatedHistory = (updatedReport.editRequestHistory || []).map((er) =>
        er.id === updatedReq.id ? updatedReq : er
      );
      await updateDocument(ERP_COLLECTIONS.fieldReports, targetDocId, {
        editRequest: updatedReq,
        editRequestHistory: updatedHistory,
      });
    }

    // Send email notification to employee
    let staffEmail = (report as any).staffEmail;
    if (!staffEmail && report.staffUid) {
      const emp = (await fetchDocument(ERP_COLLECTIONS.employees, report.staffUid)) as UserProfile | null;
      staffEmail = emp?.email || '';
    }
    if (staffEmail) {
      try {
        const { getReportReviewStatusEmail } = await import('@/lib/email/templates');
        const { sendEmail } = await import('@/lib/email/resend');
        const { subject, html } = getReportReviewStatusEmail({
          recipientName: report.staffName,
          reportDate: report.reportDate,
          status: 'correction_requested',
          reviewerName: reviewer.fullName,
          comments: combinedComment,
        });
        await sendEmail({
          to: staffEmail,
          subject: `Action Required: Edit Requested on Daily Field Report (${report.reportDate})`,
          html,
          emailType: 'correction_requested',
          staffUid: report.staffUid,
          reportId: targetDocId,
        });
      } catch (emailErr) {
        console.warn('Failed to send field report edit request email notification:', emailErr);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('requestFieldReportEdit error:', err);
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
  const enrichWithStandaloneActivities = async (rep: FieldReport): Promise<FieldReport> => {
    try {
      const actsQuery = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, [
        { field: 'staffUid', op: '==', value: rep.staffUid },
        { field: 'reportDate', op: '==', value: rep.reportDate },
      ])) as any[];
      const mergedActs = mergeDayActivities(rep.activities || [], actsQuery);
      if (mergedActs.length === 0) return rep;
      const { summary } = calculateActivitiesSummary(mergedActs, false);
      return {
        ...rep,
        activities: mergedActs,
        summary,
      };
    } catch {
      return rep;
    }
  };

  // Tier 1: Direct fetch in erp_field_reports
  const report = (await fetchDocument(ERP_COLLECTIONS.fieldReports, reportId)) as FieldReport | null;
  if (report) return enrichWithStandaloneActivities(report);

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
      return enrichWithStandaloneActivities(fieldQuery[0]);
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
        activityStatus: 'NOT_STARTED',
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

      const finalActivities = actsQuery.length > 0 ? mergeDayActivities([], actsQuery as any) : [defaultSlot];
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
