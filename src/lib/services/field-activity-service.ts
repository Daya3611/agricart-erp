import { fetchCollection, fetchDocument, saveDocument, updateDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import {
  FieldActivityRecord,
  FieldActivitySlot,
  GpsCoordinate,
  LocationCaptureStatus,
  UserProfile,
} from '@/types';
import { normalizeReportDate, getOperationalDateString } from '@/lib/utils/date-utils';
import { logAuditAction } from '@/lib/services/audit-service';
import {
  calculateActivitiesSummary,
  deduplicateActivityRecords,
  isActivityCompleted,
  isActivityInProgress,
  isSingleFarmerActivity,
  mergeEvidenceUrls,
  normalizeActivityStatus,
  resolveBlockingActiveActivity,
  StaleOrphanResolution,
} from '@/lib/utils/field-activity-calculations';

async function reconcileStaleOrphansInFirestore(
  staleOrphans: StaleOrphanResolution[],
  nowIso: string
) {
  for (const orphan of staleOrphans) {
    try {
      const endAt =
        orphan.source?.activityEndAt ||
        (orphan.source as any)?.activityEnd ||
        (orphan.source as any)?.completedAt ||
        nowIso;
      const dur =
        orphan.source?.activityDurationMinutes ??
        orphan.source?.durationMinutes ??
        1;
      await updateDocument(ERP_COLLECTIONS.fieldActivities, orphan.activityId, {
        activityStatus: orphan.targetStatus,
        ...(orphan.targetStatus === 'COMPLETED'
          ? {
              activityEndAt: endAt,
              completedAt: (orphan.source as any)?.completedAt || endAt,
              activityDurationMinutes: dur,
              durationMinutes: dur,
            }
          : {}),
        updatedAt: nowIso,
      });
    } catch (healErr) {
      console.warn(`Stale orphan reconciliation warning (${orphan.activityId}):`, healErr);
    }
  }
}

/**
 * Start a field activity immediately in Firestore.
 * Creates a persistent document in erp_field_activities with status IN_PROGRESS.
 */
export async function startFieldActivity(
  staffUser: UserProfile,
  data: {
    activityId?: string;
    slotNumber: number;
    reportDate?: string;
    activityName?: string;
    activityNameLabel?: string;
    activityOther?: string;
    village?: string;
    wadi?: string;
    activityType?: string;
    participantType?: string;
    farmerName?: string;
    groupDetails?: string;
    totalParticipants?: number;
    maleParticipants?: number;
    femaleParticipants?: number;
    observations?: string;
    farmerIssues?: string;
    supportProvided?: string[];
    supportOther?: string;
    followUpRequired?: boolean;
    followUpDetails?: string;
    followUpDate?: string;
    photoUrl?: string;
    photoEvidence?: string[];
    videoUrl?: string;
    videoEvidence?: string[];
    activityStartAt?: string;
    gps?: GpsCoordinate | null;
    locationStatus?: LocationCaptureStatus;
    initialDetails?: Partial<FieldActivitySlot>;
  }
): Promise<{ success: boolean; activity?: FieldActivityRecord; activityId?: string; error?: string }> {
  try {
    const reportDate = normalizeReportDate(data.reportDate || getOperationalDateString());
    const slotNumber = data.slotNumber || 1;
    const nowIso = new Date().toISOString();
    const startAtIso = data.activityStartAt || data.initialDetails?.activityStartAt || nowIso;

    // Deterministic or provided activity ID
    let activityId = data.activityId || `act_${staffUser.uid}_${reportDate}_s${slotNumber}_${Date.now()}`;
    const reportDocId = `field_rep_${staffUser.uid}_${reportDate}`;

    // 1. Fetch actual Firestore state for this operational date + parent report
    const [docsForDate, parentReport, directExisting] = await Promise.all([
      fetchCollection(ERP_COLLECTIONS.fieldActivities, [
        { field: 'staffUid', op: '==', value: staffUser.uid },
        { field: 'reportDate', op: '==', value: reportDate },
      ]) as Promise<FieldActivityRecord[]>,
      fetchDocument(ERP_COLLECTIONS.fieldReports, reportDocId) as Promise<any>,
      data.activityId
        ? (fetchDocument(ERP_COLLECTIONS.fieldActivities, data.activityId) as Promise<FieldActivityRecord | null>)
        : Promise.resolve(null),
    ]);

    if (directExisting) {
      const directStatus = normalizeActivityStatus(directExisting);
      if (directStatus === 'COMPLETED') {
        return {
          success: false,
          error: 'This activity has already been completed and cannot be restarted.',
        };
      }
      if (directStatus === 'CANCELLED') {
        return {
          success: false,
          error: 'This activity was cancelled and cannot be started.',
        };
      }
    }

    // 2. Reconcile actual statuses (only genuinely IN_PROGRESS activities on this date block)
    const resolution = resolveBlockingActiveActivity({
      docsForDate,
      parentReport,
      targetSlotNumber: slotNumber,
      targetActivityId: activityId,
    });

    // Self-heal any stale IN_PROGRESS orphan docs whose slot is already COMPLETED/CANCELLED
    if (resolution.staleOrphansToHeal.length > 0) {
      await reconcileStaleOrphansInFirestore(resolution.staleOrphansToHeal, nowIso);
    }

    if (resolution.blockingActivity) {
      const conflict = resolution.blockingActivity;
      return {
        success: false,
        error: `Activity #${conflict.slotNumber} (${conflict.activityNameLabel || conflict.activityName || 'In Progress'}) is already IN PROGRESS. Please complete it by clicking 'End Activity' before starting a new one.`,
      };
    }

    if (resolution.targetSlotCompleted) {
      return {
        success: false,
        error: 'This activity has already been completed and cannot be restarted.',
      };
    }

    // Reuse canonical doc ID if this exact slot is already IN_PROGRESS (prevents duplicates)
    let existingDoc = directExisting;
    if (!existingDoc && resolution.existingInProgressForTargetSlot) {
      existingDoc = resolution.existingInProgressForTargetSlot;
      activityId = existingDoc.activityId || existingDoc.id || activityId;
    }

    const startGps = data.gps || data.initialDetails?.activityStartLocation || data.initialDetails?.activityStartGps || null;
    const hasGps = Boolean(startGps && typeof startGps.latitude === 'number' && typeof startGps.longitude === 'number');
    const effectiveType =
      data.initialDetails?.activityType ||
      data.initialDetails?.participantType ||
      data.activityType ||
      data.participantType ||
      'single_farmer';
    const mergedPhotos = mergeEvidenceUrls(
      data.initialDetails?.photoUrl ?? data.photoUrl,
      data.initialDetails?.photoEvidence ?? data.photoEvidence
    );
    const mergedVideos = mergeEvidenceUrls(
      data.initialDetails?.videoUrl ?? data.videoUrl,
      data.initialDetails?.videoEvidence ?? data.videoEvidence
    );

    const activityRecord: FieldActivityRecord = {
      activityId,
      id: activityId,
      reportId: reportDocId,
      staffUid: staffUser.uid,
      employeeUid: staffUser.uid,
      employeeId: staffUser.employeeId || '',
      employeeName: staffUser.fullName || 'Staff Member',
      departmentId: staffUser.departmentId || '',
      departmentName: staffUser.departmentName || '',
      centerId: staffUser.assignedCenterIds?.[0] || '',
      centerName: staffUser.assignedCenterNames?.[0] || '',
      reportDate,
      slotNumber,

      activityStatus: 'IN_PROGRESS',

      activityName: data.activityName || data.initialDetails?.activityName || 'farmer_visit',
      activityNameLabel: data.activityNameLabel || data.initialDetails?.activityNameLabel || 'Farmer Visit',
      activityOther: data.activityOther ?? data.initialDetails?.activityOther ?? '',
      village: data.village ?? data.initialDetails?.village ?? '',
      wadi: data.wadi ?? data.initialDetails?.wadi ?? '',

      activityStartAt: startAtIso,
      activityStartLocation: hasGps ? startGps : null,
      activityStartGps: hasGps ? startGps : null,
      activityStartLocationStatus: hasGps ? 'captured' : (data.locationStatus || 'unavailable'),

      activityEndAt: null,
      activityEndLocation: null,
      activityEndGps: null,
      activityEndLocationStatus: null,

      activityDurationMinutes: 0,
      durationMinutes: 0,

      participantType: effectiveType,
      activityType: effectiveType,
      farmerName: data.initialDetails?.farmerName ?? data.farmerName ?? '',
      groupDetails: data.initialDetails?.groupDetails ?? data.groupDetails ?? '',
      totalParticipants: Number(data.initialDetails?.totalParticipants ?? data.totalParticipants) || 0,
      maleParticipants: Number(data.initialDetails?.maleParticipants ?? data.maleParticipants) || 0,
      femaleParticipants: Number(data.initialDetails?.femaleParticipants ?? data.femaleParticipants) || 0,

      observations: data.initialDetails?.observations ?? data.observations ?? '',
      farmerIssues: data.initialDetails?.farmerIssues ?? data.farmerIssues ?? '',
      supportProvided: data.initialDetails?.supportProvided ?? data.supportProvided ?? [],
      supportOther: data.initialDetails?.supportOther ?? data.supportOther ?? '',
      followUpRequired: Boolean(data.initialDetails?.followUpRequired ?? data.followUpRequired),
      followUpDetails: data.initialDetails?.followUpDetails ?? data.followUpDetails ?? '',
      followUpDate: data.initialDetails?.followUpDate ?? data.followUpDate ?? '',

      photoEvidence: mergedPhotos,
      photoUrl: mergedPhotos[0] || '',
      videoEvidence: mergedVideos,
      videoUrl: mergedVideos[0] || '',

      syncStatus: 'synced',
      createdAt: existingDoc?.createdAt || nowIso,
      updatedAt: nowIso,
      completedAt: null,
    };

    // Save immediately in Firestore
    await saveDocument(ERP_COLLECTIONS.fieldActivities, activityId, activityRecord);

    // Sync activity slot to parent field report draft
    await syncActivityToParentReport(staffUser, activityRecord);

    await logAuditAction({
      actorUid: staffUser.uid,
      actorName: staffUser.fullName,
      actorRole: staffUser.role,
      action: 'start_field_activity',
      resourceType: 'report',
      resourceId: activityId,
      details: `Employee ${staffUser.fullName} started Activity #${slotNumber} (${activityRecord.activityNameLabel}) at ${nowIso}. Location: ${activityRecord.activityStartLocation?.placeName || 'unavailable'}`,
    });

    return {
      success: true,
      activity: activityRecord,
      activityId,
    };
  } catch (err: any) {
    console.error('startFieldActivity error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Build a normalized Firestore patch for all editable activity detail fields
 * so start, incremental save, and end/completion persist identical schemas.
 */
function buildActivityDetailPatch(details: Partial<FieldActivitySlot>): Partial<FieldActivityRecord> {
  const patch: Partial<FieldActivityRecord> = {};
  if (details.activityName !== undefined) patch.activityName = details.activityName;
  if (details.activityNameLabel !== undefined) patch.activityNameLabel = details.activityNameLabel;
  if (details.activityOther !== undefined) patch.activityOther = details.activityOther;
  if (details.village !== undefined) patch.village = details.village;
  if (details.wadi !== undefined) patch.wadi = details.wadi;

  const resolvedType = details.activityType ?? details.participantType;
  if (resolvedType !== undefined) {
    patch.participantType = resolvedType;
    patch.activityType = resolvedType;
  }

  if (details.farmerName !== undefined) patch.farmerName = details.farmerName;
  if (details.groupDetails !== undefined) patch.groupDetails = details.groupDetails;
  if (details.totalParticipants !== undefined) patch.totalParticipants = Number(details.totalParticipants) || 0;
  if (details.maleParticipants !== undefined) patch.maleParticipants = Number(details.maleParticipants) || 0;
  if (details.femaleParticipants !== undefined) patch.femaleParticipants = Number(details.femaleParticipants) || 0;
  if (details.observations !== undefined) patch.observations = details.observations;
  if (details.farmerIssues !== undefined) patch.farmerIssues = details.farmerIssues;
  if (details.supportProvided !== undefined) patch.supportProvided = Array.isArray(details.supportProvided) ? details.supportProvided : [];
  if (details.supportOther !== undefined) patch.supportOther = details.supportOther;
  if (details.followUpRequired !== undefined) patch.followUpRequired = Boolean(details.followUpRequired);
  if (details.followUpDetails !== undefined) patch.followUpDetails = details.followUpDetails;
  if (details.followUpDate !== undefined) patch.followUpDate = details.followUpDate;

  if (details.photoUrl !== undefined || details.photoEvidence !== undefined) {
    const mergedPhotos = mergeEvidenceUrls(details.photoUrl, details.photoEvidence);
    patch.photoEvidence = mergedPhotos;
    patch.photoUrl = mergedPhotos[0] || '';
  }

  if (details.videoUrl !== undefined || details.videoEvidence !== undefined) {
    const mergedVideos = mergeEvidenceUrls(details.videoUrl, details.videoEvidence);
    patch.videoEvidence = mergedVideos;
    patch.videoUrl = mergedVideos[0] || '';
  }

  return patch;
}

/**
 * Incrementally save / autosave an in-progress activity (or edit details during reopened correction/edit).
 */
export async function updateFieldActivityProgress(
  staffUser: UserProfile,
  activityId: string,
  updates: Partial<FieldActivitySlot>
): Promise<{ success: boolean; activity?: FieldActivityRecord; error?: string }> {
  try {
    const existing = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, activityId)) as FieldActivityRecord | null;
    if (!existing) {
      return { success: false, error: 'Activity not found in database.' };
    }

    // Ownership check
    if (existing.staffUid !== staffUser.uid && staffUser.role !== 'admin' && staffUser.role !== 'super_admin') {
      return { success: false, error: 'FORBIDDEN: You cannot modify another employee\'s activity.' };
    }

    // Disallow overwriting completed/cancelled activities unless admin OR parent report is reopened for correction/edit
    const existingNormStatus = normalizeActivityStatus(existing);
    if (existingNormStatus === 'CANCELLED' && staffUser.role !== 'admin' && staffUser.role !== 'super_admin') {
      return { success: false, error: 'Activity has been cancelled and cannot be modified.' };
    }
    if (existingNormStatus === 'COMPLETED' && staffUser.role !== 'admin' && staffUser.role !== 'super_admin') {
      const parentReportId = existing.reportId || `field_rep_${existing.staffUid}_${existing.reportDate}`;
      const parentReport = (await fetchDocument(ERP_COLLECTIONS.fieldReports, parentReportId)) as any;
      const isReopened =
        parentReport?.status === 'correction_requested' || parentReport?.status === 'edit_requested';
      if (!isReopened) {
        return { success: false, error: 'Activity has already been completed and cannot be modified.' };
      }
    }

    const nowIso = new Date().toISOString();
    const patch: Partial<FieldActivityRecord> = {
      ...buildActivityDetailPatch(updates),
      updatedAt: nowIso,
    };

    await updateDocument(ERP_COLLECTIONS.fieldActivities, activityId, patch);

    const merged = { ...existing, ...patch } as FieldActivityRecord;

    // Sync to parent field report draft
    await syncActivityToParentReport(staffUser, merged);

    return {
      success: true,
      activity: merged,
    };
  } catch (err: any) {
    console.error('updateFieldActivityProgress error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * End a field activity and mark it COMPLETED in the SAME document.
 */
export async function endFieldActivity(
  staffUser: UserProfile,
  activityId: string,
  data: {
    endGps?: GpsCoordinate | null;
    locationStatus?: LocationCaptureStatus;
    finalDetails?: Partial<FieldActivitySlot>;
  }
): Promise<{ success: boolean; activity?: FieldActivityRecord; error?: string }> {
  try {
    let effectiveActivityId = activityId;
    let existing = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, effectiveActivityId)) as FieldActivityRecord | null;

    const resolvedDate = normalizeReportDate(
      existing?.reportDate || (data.finalDetails as any)?.reportDate || getOperationalDateString()
    );
    const slotFromId = Number(effectiveActivityId.match(/_s(\d+)(?:_|$)/)?.[1] || 0);
    const resolvedSlot = Number(existing?.slotNumber || data.finalDetails?.slotNumber || slotFromId || 1);

    const docsForDate = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, [
      { field: 'staffUid', op: '==', value: existing?.staffUid || staffUser.uid },
      { field: 'reportDate', op: '==', value: resolvedDate },
    ])) as FieldActivityRecord[];

    // If caller didn't match by docId, reuse existing doc for the same slotNumber before self-healing a new doc
    if (!existing) {
      const sameSlotDocs = docsForDate.filter((d) => (Number(d.slotNumber) || 1) === resolvedSlot);
      if (sameSlotDocs.length > 0) {
        const [canonicalMatch] = deduplicateActivityRecords(sameSlotDocs, (d) => String(d.slotNumber || resolvedSlot));
        existing = canonicalMatch;
        effectiveActivityId = canonicalMatch.activityId || canonicalMatch.id || effectiveActivityId;
      }
    }

    if (!existing) {
      // Graceful offline self-heal: If activity was started offline and arrives directly via end
      const nowIso = new Date().toISOString();
      const reportDate = resolvedDate;
      const slotNumber = resolvedSlot;
      const startLoc =
        data.finalDetails?.activityStartLocation || data.finalDetails?.activityStartGps || null;
      const hasStartGps = Boolean(
        startLoc && typeof startLoc.latitude === 'number' && typeof startLoc.longitude === 'number'
      );
      const effectiveType =
        data.finalDetails?.activityType || data.finalDetails?.participantType || 'group';
      const mergedPhotos = mergeEvidenceUrls(
        data.finalDetails?.photoUrl,
        data.finalDetails?.photoEvidence
      );
      const mergedVideos = mergeEvidenceUrls(
        data.finalDetails?.videoUrl,
        data.finalDetails?.videoEvidence
      );

      existing = {
        activityId: effectiveActivityId,
        id: effectiveActivityId,
        reportId: `field_rep_${staffUser.uid}_${reportDate}`,
        staffUid: staffUser.uid,
        employeeUid: staffUser.uid,
        employeeId: staffUser.employeeId || '',
        employeeName: staffUser.fullName || 'Staff Member',
        departmentId: staffUser.departmentId || '',
        departmentName: staffUser.departmentName || 'Field Operations',
        centerId: staffUser.assignedCenterIds?.[0] || '',
        centerName: staffUser.assignedCenterNames?.[0] || '',
        reportDate,
        slotNumber,
        activityStatus: 'IN_PROGRESS',
        activityName: (data.finalDetails?.activityName as any) || 'farmer_visit',
        activityNameLabel: data.finalDetails?.activityNameLabel || 'Farmer Visit',
        activityOther: data.finalDetails?.activityOther || '',
        village: data.finalDetails?.village || '',
        wadi: data.finalDetails?.wadi || '',
        activityStartAt: data.finalDetails?.activityStartAt || data.finalDetails?.activityStart || nowIso,
        activityStartLocation: hasStartGps ? startLoc : null,
        activityStartGps: hasStartGps ? startLoc : null,
        activityStartLocationStatus: hasStartGps
          ? 'captured'
          : (data.finalDetails?.activityStartLocationStatus || 'unavailable'),
        activityEndAt: null,
        activityEndLocation: null,
        activityEndGps: null,
        activityEndLocationStatus: null,
        activityDurationMinutes: 0,
        durationMinutes: 0,
        participantType: effectiveType,
        activityType: effectiveType,
        farmerName: data.finalDetails?.farmerName || '',
        groupDetails: data.finalDetails?.groupDetails || '',
        totalParticipants: Number(data.finalDetails?.totalParticipants) || 0,
        maleParticipants: Number(data.finalDetails?.maleParticipants) || 0,
        femaleParticipants: Number(data.finalDetails?.femaleParticipants) || 0,
        observations: data.finalDetails?.observations || '',
        farmerIssues: data.finalDetails?.farmerIssues || '',
        supportProvided: data.finalDetails?.supportProvided || [],
        supportOther: data.finalDetails?.supportOther || '',
        followUpRequired: Boolean(data.finalDetails?.followUpRequired),
        followUpDetails: data.finalDetails?.followUpDetails || '',
        followUpDate: data.finalDetails?.followUpDate || '',
        photoEvidence: mergedPhotos,
        photoUrl: mergedPhotos[0] || '',
        videoEvidence: mergedVideos,
        videoUrl: mergedVideos[0] || '',
        syncStatus: 'synced',
        createdAt: data.finalDetails?.createdAt || nowIso,
        updatedAt: nowIso,
        completedAt: null,
      };
      await saveDocument(ERP_COLLECTIONS.fieldActivities, effectiveActivityId, existing);
    }

    // Ownership check
    if (existing.staffUid !== staffUser.uid && staffUser.role !== 'admin' && staffUser.role !== 'super_admin') {
      return { success: false, error: 'FORBIDDEN: You cannot modify another employee\'s activity.' };
    }

    if (normalizeActivityStatus(existing) === 'COMPLETED') {
      const normalizedCompleted: FieldActivityRecord = {
        ...existing,
        activityStatus: 'COMPLETED',
      };
      const sameSlotOrphans: StaleOrphanResolution[] = docsForDate
        .filter((d) => {
          const dId = d.activityId || d.id;
          return (
            dId &&
            dId !== effectiveActivityId &&
            (Number(d.slotNumber) || 1) === (Number(existing!.slotNumber) || 1) &&
            normalizeActivityStatus(d) === 'IN_PROGRESS'
          );
        })
        .map((d) => ({
          activityId: d.activityId || d.id,
          targetStatus: 'COMPLETED',
          source: normalizedCompleted,
        }));
      if (sameSlotOrphans.length > 0) {
        await reconcileStaleOrphansInFirestore(sameSlotOrphans, new Date().toISOString());
      }
      await syncActivityToParentReport(staffUser, normalizedCompleted);
      return { success: true, activity: normalizedCompleted };
    }

    const effectiveActivityName = data.finalDetails?.activityName ?? existing.activityName;
    const isDeskJob =
      effectiveActivityName === 'desk_job' ||
      (typeof effectiveActivityName === 'string' && effectiveActivityName.toLowerCase().includes('desk'));
    const effectiveType =
      data.finalDetails?.activityType ??
      data.finalDetails?.participantType ??
      existing.participantType ??
      existing.activityType ??
      'group';
    const isSingleFarmer = isSingleFarmerActivity(effectiveType);

    const village = data.finalDetails?.village ?? existing.village;
    const observations = data.finalDetails?.observations ?? existing.observations;
    const farmerName = data.finalDetails?.farmerName ?? existing.farmerName;
    const male = Number(data.finalDetails?.maleParticipants ?? existing.maleParticipants ?? 0);
    const female = Number(data.finalDetails?.femaleParticipants ?? existing.femaleParticipants ?? 0);
    const total = Number(data.finalDetails?.totalParticipants ?? existing.totalParticipants ?? 0);
    const supportProvided = data.finalDetails?.supportProvided ?? existing.supportProvided ?? [];
    const supportOther = data.finalDetails?.supportOther ?? existing.supportOther ?? '';
    const followUpRequired =
      data.finalDetails?.followUpRequired !== undefined
        ? Boolean(data.finalDetails.followUpRequired)
        : Boolean(existing.followUpRequired);
    const followUpDetails = data.finalDetails?.followUpDetails ?? existing.followUpDetails ?? '';

    // Business validation checks
    if (!isDeskJob) {
      if (!village || !village.trim()) {
        return { success: false, error: 'Village / Location is required before completing this activity.' };
      }
      if (!observations || !observations.trim()) {
        return { success: false, error: 'Observations / activity summary are required before ending.' };
      }
      if (isSingleFarmer && (!farmerName || !farmerName.trim())) {
        return { success: false, error: 'Farmer Name is required for single farmer visits.' };
      }
      if (!isSingleFarmer && total > 0 && male + female !== total) {
        return {
          success: false,
          error: `Participant counts mismatch: Male (${male}) + Female (${female}) must equal Total (${total}).`,
        };
      }
    }

    if (supportProvided.includes('other') && (!supportOther || !supportOther.trim())) {
      return { success: false, error: 'Please specify other support details.' };
    }
    if (followUpRequired && (!followUpDetails || !followUpDetails.trim())) {
      return { success: false, error: 'Follow-up details are required when follow-up is marked Yes.' };
    }

    const nowIso = new Date().toISOString();
    const startMs = new Date(existing.activityStartAt || existing.createdAt || nowIso).getTime();
    const candidateEndIso = data.finalDetails?.activityEndAt || data.finalDetails?.activityEnd;
    const candidateEndMs = candidateEndIso ? new Date(candidateEndIso).getTime() : NaN;
    const effectiveEndIso =
      !isNaN(candidateEndMs) && candidateEndMs >= startMs && candidateEndMs <= Date.now() + 60000
        ? new Date(candidateEndMs).toISOString()
        : nowIso;
    const endMs = new Date(effectiveEndIso).getTime();
    const durMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

    const hasGps = Boolean(data.endGps && typeof data.endGps.latitude === 'number' && typeof data.endGps.longitude === 'number');

    const finalPatch: Partial<FieldActivityRecord> = {
      activityStatus: 'COMPLETED',
      activityEndAt: effectiveEndIso,
      activityEndLocation: hasGps ? data.endGps! : null,
      activityEndGps: hasGps ? data.endGps! : null,
      activityEndLocationStatus: hasGps ? 'captured' : (data.locationStatus || 'unavailable'),
      activityDurationMinutes: durMinutes,
      durationMinutes: durMinutes,
      completedAt: effectiveEndIso,
      updatedAt: nowIso,
      ...(data.finalDetails ? buildActivityDetailPatch(data.finalDetails) : {}),
    };

    if (isSingleFarmer && !isDeskJob) {
      finalPatch.totalParticipants = 1;
    }

    // Update the EXACT SAME document in Firestore to COMPLETED before syncing/returning
    await updateDocument(ERP_COLLECTIONS.fieldActivities, effectiveActivityId, finalPatch);

    const merged = { ...existing, ...finalPatch } as FieldActivityRecord;

    // Reconcile any stale sibling IN_PROGRESS duplicate docs for this exact date & slotNumber
    const sameSlotOrphans: StaleOrphanResolution[] = docsForDate
      .filter((d) => {
        const dId = d.activityId || d.id;
        return (
          dId &&
          dId !== effectiveActivityId &&
          (Number(d.slotNumber) || 1) === (Number(existing!.slotNumber) || 1) &&
          normalizeActivityStatus(d) === 'IN_PROGRESS'
        );
      })
      .map((d) => ({
        activityId: d.activityId || d.id,
        targetStatus: 'COMPLETED',
        source: merged,
      }));
    if (sameSlotOrphans.length > 0) {
      await reconcileStaleOrphansInFirestore(sameSlotOrphans, nowIso);
    }

    // Sync completed activity to parent report
    await syncActivityToParentReport(staffUser, merged);

    await logAuditAction({
      actorUid: staffUser.uid,
      actorName: staffUser.fullName,
      actorRole: staffUser.role,
      action: 'end_field_activity',
      resourceType: 'report',
      resourceId: effectiveActivityId,
      details: `Employee ${staffUser.fullName} completed Activity #${existing.slotNumber} (${existing.activityNameLabel}). Duration: ${durMinutes} mins. Location: ${finalPatch.activityEndLocation?.placeName || 'unavailable'}`,
    });

    return {
      success: true,
      activity: merged,
    };
  } catch (err: any) {
    console.error('endFieldActivity error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all activities for a staff member on a specific date, deduplicated per slotNumber.
 */
export async function getStaffActivitiesForDate(
  staffUid: string,
  dateInput: string
): Promise<FieldActivityRecord[]> {
  const reportDate = normalizeReportDate(dateInput);
  const activities = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, [
    { field: 'staffUid', op: '==', value: staffUid },
    { field: 'reportDate', op: '==', value: reportDate },
  ])) as FieldActivityRecord[];

  return deduplicateActivityRecords(activities, (act) => String(Number(act.slotNumber) || 1));
}

/**
 * Fetch active activities across all employees for the Admin Live Monitor.
 */
export async function getLiveActivitiesForAdmin(dateInput?: string): Promise<{
  activeActivities: FieldActivityRecord[];
  recentCompleted: FieldActivityRecord[];
}> {
  const targetDate = normalizeReportDate(dateInput || getOperationalDateString());

  // Fetch all activities for the operational date (uses deployed reportDate index & covers any casing)
  const dayActivities = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, [
    { field: 'reportDate', op: '==', value: targetDate },
  ])) as FieldActivityRecord[];

  const deduped = deduplicateActivityRecords(
    dayActivities,
    (act) => `${act.staffUid || act.employeeUid}_${act.reportDate}_${Number(act.slotNumber) || 1}`
  );

  const activeActivities = deduped.filter((a) => isActivityInProgress(a));
  const completedToday = deduped.filter((a) => isActivityCompleted(a));

  completedToday.sort((a, b) => {
    const timeA = new Date(a.activityEndAt || a.completedAt || 0).getTime();
    const timeB = new Date(b.activityEndAt || b.completedAt || 0).getTime();
    return timeB - timeA;
  });

  return {
    activeActivities,
    recentCompleted: completedToday.slice(0, 20),
  };
}

/**
 * Helper to sync an individual activity record into the parent field report document
 * without prematurely finalizing the daily report or overwriting review/report metadata.
 */
async function syncActivityToParentReport(staffUser: UserProfile, activity: FieldActivityRecord) {
  try {
    const reportDocId = activity.reportId || `field_rep_${staffUser.uid}_${activity.reportDate}`;
    const existingRep = (await fetchDocument(ERP_COLLECTIONS.fieldReports, reportDocId)) as any;

    const mergedPhotos = mergeEvidenceUrls(activity.photoUrl, activity.photoEvidence);
    const mergedVideos = mergeEvidenceUrls(activity.videoUrl, activity.videoEvidence);
    const resolvedType = (activity.participantType || activity.activityType || 'single_farmer') as any;

    const slotData: FieldActivitySlot = {
      activityId: activity.activityId,
      id: activity.activityId,
      slotNumber: activity.slotNumber,
      activityStatus: normalizeActivityStatus(activity),
      activityName: activity.activityName as any,
      activityNameLabel: activity.activityNameLabel || '',
      activityOther: activity.activityOther || '',
      village: activity.village || '',
      wadi: activity.wadi || '',
      activityType: resolvedType,
      participantType: resolvedType,
      farmerName: activity.farmerName || '',
      groupDetails: activity.groupDetails || '',
      totalParticipants: activity.totalParticipants || 0,
      maleParticipants: activity.maleParticipants || 0,
      femaleParticipants: activity.femaleParticipants || 0,
      observations: activity.observations || '',
      farmerIssues: activity.farmerIssues || '',
      supportProvided: activity.supportProvided || [],
      supportOther: activity.supportOther || '',
      followUpRequired: Boolean(activity.followUpRequired),
      followUpDetails: activity.followUpDetails || '',
      followUpDate: activity.followUpDate || '',
      photoUrl: mergedPhotos[0] || '',
      photoEvidence: mergedPhotos,
      videoUrl: mergedVideos[0] || '',
      videoEvidence: mergedVideos,
      activityStartAt: activity.activityStartAt,
      activityStart: activity.activityStartAt,
      activityStartLocation: activity.activityStartLocation,
      activityStartGps: activity.activityStartLocation,
      activityStartLocationStatus: activity.activityStartLocationStatus,
      activityEndAt: activity.activityEndAt || '',
      activityEnd: activity.activityEndAt || '',
      activityEndLocation: activity.activityEndLocation,
      activityEndGps: activity.activityEndLocation,
      activityEndLocationStatus: activity.activityEndLocationStatus as any,
      activityDurationMinutes: activity.activityDurationMinutes || 0,
      durationMinutes: activity.activityDurationMinutes || 0,
      syncStatus: 'synced',
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
      completedAt: activity.completedAt,
    };

    let updatedActivities: FieldActivitySlot[] = [];

    if (existingRep && Array.isArray(existingRep.activities)) {
      const idx = existingRep.activities.findIndex(
        (a: any) =>
          (activity.activityId && a.activityId === activity.activityId) ||
          a.slotNumber === activity.slotNumber
      );
      if (idx >= 0) {
        const existingSlotStatus = normalizeActivityStatus(existingRep.activities[idx]);
        const nextSlotStatus = normalizeActivityStatus(slotData);
        if (existingSlotStatus === 'COMPLETED' && nextSlotStatus !== 'COMPLETED') {
          return;
        }
        updatedActivities = [...existingRep.activities];
        updatedActivities[idx] = slotData;
      } else {
        updatedActivities = [...existingRep.activities, slotData].sort(
          (a, b) => a.slotNumber - b.slotNumber
        );
      }
    } else {
      updatedActivities = [slotData];
    }

    const { summary } = calculateActivitiesSummary(updatedActivities, false);

    // Keep existing status ('draft', 'correction_requested', 'edit_requested', etc.) until explicit Finalize Daily Report
    const resolvedStatus = existingRep?.status || 'draft';

    const reportPayload = {
      ...(existingRep || {}),
      id: reportDocId,
      staffUid: staffUser.uid,
      employeeId: staffUser.employeeId || existingRep?.employeeId || '',
      staffName: staffUser.fullName || existingRep?.staffName || '',
      staffEmail: staffUser.email || existingRep?.staffEmail || '',
      departmentId: staffUser.departmentId || existingRep?.departmentId || '',
      departmentName: staffUser.departmentName || existingRep?.departmentName || '',
      centerId: staffUser.assignedCenterIds?.[0] || existingRep?.centerId || '',
      centerName: staffUser.assignedCenterNames?.[0] || existingRep?.centerName || '',
      reportDate: activity.reportDate,
      activities: updatedActivities,
      summary,
      status: resolvedStatus,
      finalized: Boolean(existingRep?.finalized),
      revisionNumber: existingRep?.revisionNumber || 1,
      createdAt: existingRep?.createdAt || activity.createdAt,
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
    };

    await saveDocument(ERP_COLLECTIONS.fieldReports, reportDocId, reportPayload);
  } catch (err) {
    console.error('syncActivityToParentReport error:', err);
  }
}
