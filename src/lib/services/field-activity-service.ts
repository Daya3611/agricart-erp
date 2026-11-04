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
import { calculateActivitiesSummary } from '@/lib/utils/field-activity-calculations';

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
    gps?: GpsCoordinate | null;
    locationStatus?: LocationCaptureStatus;
    initialDetails?: Partial<FieldActivitySlot>;
  }
): Promise<{ success: boolean; activity?: FieldActivityRecord; activityId?: string; error?: string }> {
  try {
    const reportDate = normalizeReportDate(data.reportDate || getOperationalDateString());
    const slotNumber = data.slotNumber || 1;
    const nowIso = new Date().toISOString();

    // Deterministic or provided activity ID
    const activityId = data.activityId || `act_${staffUser.uid}_${reportDate}_s${slotNumber}_${Date.now()}`;
    const reportDocId = `field_rep_${staffUser.uid}_${reportDate}`;

    // Check if employee already has an active IN_PROGRESS activity
    const existingActive = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, [
      { field: 'staffUid', op: '==', value: staffUser.uid },
      { field: 'activityStatus', op: '==', value: 'IN_PROGRESS' },
    ])) as FieldActivityRecord[];

    const conflict = existingActive.find((a) => a.activityId !== activityId && a.id !== activityId);
    if (conflict) {
      return {
        success: false,
        error: `Activity #${conflict.slotNumber} (${conflict.activityNameLabel || conflict.activityName || 'In Progress'}) is already IN PROGRESS. Please complete it by clicking 'End Activity' before starting a new one.`,
      };
    }

    // Check if this specific activity document already exists
    const existingDoc = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, activityId)) as FieldActivityRecord | null;
    if (existingDoc && (existingDoc.activityStatus === 'COMPLETED' || existingDoc.activityStatus === 'completed')) {
      return {
        success: false,
        error: 'This activity has already been completed and cannot be restarted.',
      };
    }

    const hasGps = Boolean(data.gps && typeof data.gps.latitude === 'number' && typeof data.gps.longitude === 'number');

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

      activityName: data.activityName || 'farmer_visit',
      activityNameLabel: data.activityNameLabel || data.initialDetails?.activityNameLabel || 'Farmer Visit',
      activityOther: data.activityOther || data.initialDetails?.activityOther || '',
      village: data.village || data.initialDetails?.village || '',
      wadi: data.wadi || data.initialDetails?.wadi || '',

      activityStartAt: nowIso,
      activityStartLocation: hasGps ? data.gps! : null,
      activityStartGps: hasGps ? data.gps! : null,
      activityStartLocationStatus: hasGps ? 'captured' : (data.locationStatus || 'unavailable'),

      activityEndAt: null,
      activityEndLocation: null,
      activityEndGps: null,
      activityEndLocationStatus: null,

      activityDurationMinutes: 0,
      durationMinutes: 0,

      participantType: data.initialDetails?.activityType || 'single_farmer',
      farmerName: data.initialDetails?.farmerName || '',
      totalParticipants: Number(data.initialDetails?.totalParticipants) || 0,
      maleParticipants: Number(data.initialDetails?.maleParticipants) || 0,
      femaleParticipants: Number(data.initialDetails?.femaleParticipants) || 0,

      observations: data.initialDetails?.observations || '',
      farmerIssues: data.initialDetails?.farmerIssues || '',
      supportProvided: data.initialDetails?.supportProvided || [],
      followUpRequired: Boolean(data.initialDetails?.followUpRequired),
      followUpDetails: data.initialDetails?.followUpDetails || '',
      followUpDate: data.initialDetails?.followUpDate || '',

      photoEvidence: data.initialDetails?.photoUrl ? [data.initialDetails.photoUrl] : [],
      photoUrl: data.initialDetails?.photoUrl || '',
      videoEvidence: data.initialDetails?.videoUrl ? [data.initialDetails.videoUrl] : [],
      videoUrl: data.initialDetails?.videoUrl || '',

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
 * Incrementally save / autosave an in-progress activity.
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

    // Disallow overwriting already completed activities
    if (existing.activityStatus === 'COMPLETED' || existing.activityStatus === 'completed') {
      return { success: false, error: 'Activity has already been completed and cannot be modified.' };
    }

    const nowIso = new Date().toISOString();

    const patch: Partial<FieldActivityRecord> = {
      updatedAt: nowIso,
    };

    if (updates.activityName !== undefined) patch.activityName = updates.activityName;
    if (updates.activityNameLabel !== undefined) patch.activityNameLabel = updates.activityNameLabel;
    if (updates.activityOther !== undefined) patch.activityOther = updates.activityOther;
    if (updates.village !== undefined) patch.village = updates.village;
    if (updates.wadi !== undefined) patch.wadi = updates.wadi;
    if (updates.activityType !== undefined) patch.participantType = updates.activityType;
    if (updates.farmerName !== undefined) patch.farmerName = updates.farmerName;
    if (updates.totalParticipants !== undefined) patch.totalParticipants = Number(updates.totalParticipants);
    if (updates.maleParticipants !== undefined) patch.maleParticipants = Number(updates.maleParticipants);
    if (updates.femaleParticipants !== undefined) patch.femaleParticipants = Number(updates.femaleParticipants);
    if (updates.observations !== undefined) patch.observations = updates.observations;
    if (updates.farmerIssues !== undefined) patch.farmerIssues = updates.farmerIssues;
    if (updates.supportProvided !== undefined) patch.supportProvided = updates.supportProvided;
    if (updates.followUpRequired !== undefined) patch.followUpRequired = Boolean(updates.followUpRequired);
    if (updates.followUpDetails !== undefined) patch.followUpDetails = updates.followUpDetails;
    if (updates.followUpDate !== undefined) patch.followUpDate = updates.followUpDate;
    if (updates.photoUrl !== undefined) {
      patch.photoUrl = updates.photoUrl;
      patch.photoEvidence = updates.photoUrl ? [updates.photoUrl] : [];
    }
    if (updates.videoUrl !== undefined) {
      patch.videoUrl = updates.videoUrl;
      patch.videoEvidence = updates.videoUrl ? [updates.videoUrl] : [];
    }

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
    const existing = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, activityId)) as FieldActivityRecord | null;
    if (!existing) {
      return { success: false, error: 'Activity not found in database to end.' };
    }

    // Ownership check
    if (existing.staffUid !== staffUser.uid && staffUser.role !== 'admin' && staffUser.role !== 'super_admin') {
      return { success: false, error: 'FORBIDDEN: You cannot modify another employee\'s activity.' };
    }

    if (existing.activityStatus === 'COMPLETED' || existing.activityStatus === 'completed') {
      return { success: true, activity: existing };
    }

    const isDeskJob = existing.activityName === 'desk_job';
    const isSingleFarmer = existing.participantType === 'single_farmer';
    const village = data.finalDetails?.village ?? existing.village;
    const observations = data.finalDetails?.observations ?? existing.observations;
    const farmerName = data.finalDetails?.farmerName ?? existing.farmerName;
    const male = Number(data.finalDetails?.maleParticipants ?? existing.maleParticipants ?? 0);
    const female = Number(data.finalDetails?.femaleParticipants ?? existing.femaleParticipants ?? 0);
    const total = Number(data.finalDetails?.totalParticipants ?? existing.totalParticipants ?? 0);

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
        return { success: false, error: `Participant counts mismatch: Male (${male}) + Female (${female}) must equal Total (${total}).` };
      }
    }

    const nowIso = new Date().toISOString();
    const hasGps = Boolean(data.endGps && typeof data.endGps.latitude === 'number' && typeof data.endGps.longitude === 'number');

    // Calculate duration from actual start
    const startMs = new Date(existing.activityStartAt || existing.createdAt || nowIso).getTime();
    const endMs = new Date(nowIso).getTime();
    const durMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

    const finalPatch: Partial<FieldActivityRecord> = {
      activityStatus: 'COMPLETED',
      activityEndAt: nowIso,
      activityEndLocation: hasGps ? data.endGps! : null,
      activityEndGps: hasGps ? data.endGps! : null,
      activityEndLocationStatus: hasGps ? 'captured' : (data.locationStatus || 'unavailable'),
      activityDurationMinutes: durMinutes,
      durationMinutes: durMinutes,
      completedAt: nowIso,
      updatedAt: nowIso,
    };

    // Apply any final details if supplied
    if (data.finalDetails) {
      if (data.finalDetails.village !== undefined) finalPatch.village = data.finalDetails.village;
      if (data.finalDetails.wadi !== undefined) finalPatch.wadi = data.finalDetails.wadi;
      if (data.finalDetails.farmerName !== undefined) finalPatch.farmerName = data.finalDetails.farmerName;
      if (data.finalDetails.observations !== undefined) finalPatch.observations = data.finalDetails.observations;
      if (data.finalDetails.farmerIssues !== undefined) finalPatch.farmerIssues = data.finalDetails.farmerIssues;
      if (data.finalDetails.supportProvided !== undefined) finalPatch.supportProvided = data.finalDetails.supportProvided;
      if (data.finalDetails.photoUrl !== undefined) {
        finalPatch.photoUrl = data.finalDetails.photoUrl;
        finalPatch.photoEvidence = data.finalDetails.photoUrl ? [data.finalDetails.photoUrl] : [];
      }
      if (data.finalDetails.videoUrl !== undefined) {
        finalPatch.videoUrl = data.finalDetails.videoUrl;
        finalPatch.videoEvidence = data.finalDetails.videoUrl ? [data.finalDetails.videoUrl] : [];
      }
    }

    // Update the EXACT SAME document in Firestore
    await updateDocument(ERP_COLLECTIONS.fieldActivities, activityId, finalPatch);

    const merged = { ...existing, ...finalPatch } as FieldActivityRecord;

    // Sync completed activity to parent report
    await syncActivityToParentReport(staffUser, merged);

    await logAuditAction({
      actorUid: staffUser.uid,
      actorName: staffUser.fullName,
      actorRole: staffUser.role,
      action: 'end_field_activity',
      resourceType: 'report',
      resourceId: activityId,
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
 * Fetch all activities for a staff member on a specific date.
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

  return activities.sort((a, b) => a.slotNumber - b.slotNumber);
}

/**
 * Fetch active activities across all employees for the Admin Live Monitor.
 */
export async function getLiveActivitiesForAdmin(dateInput?: string): Promise<{
  activeActivities: FieldActivityRecord[];
  recentCompleted: FieldActivityRecord[];
}> {
  const targetDate = normalizeReportDate(dateInput || getOperationalDateString());

  // Fetch all activities in progress
  const allInProgress = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, [
    { field: 'activityStatus', op: '==', value: 'IN_PROGRESS' },
  ])) as FieldActivityRecord[];

  // Fetch completed activities for this date
  const completedToday = (await fetchCollection(ERP_COLLECTIONS.fieldActivities, [
    { field: 'reportDate', op: '==', value: targetDate },
    { field: 'activityStatus', op: '==', value: 'COMPLETED' },
  ])) as FieldActivityRecord[];

  completedToday.sort((a, b) => {
    const timeA = new Date(a.activityEndAt || a.completedAt || 0).getTime();
    const timeB = new Date(b.activityEndAt || b.completedAt || 0).getTime();
    return timeB - timeA;
  });

  return {
    activeActivities: allInProgress,
    recentCompleted: completedToday.slice(0, 20),
  };
}

/**
 * Helper to sync an individual activity record into the parent field report document.
 */
async function syncActivityToParentReport(staffUser: UserProfile, activity: FieldActivityRecord) {
  try {
    const reportDocId = activity.reportId || `field_rep_${staffUser.uid}_${activity.reportDate}`;
    const existingRep = (await fetchDocument(ERP_COLLECTIONS.fieldReports, reportDocId)) as any;

    const slotData: FieldActivitySlot = {
      activityId: activity.activityId,
      id: activity.activityId,
      slotNumber: activity.slotNumber,
      activityStatus: activity.activityStatus as any,
      activityName: activity.activityName as any,
      activityNameLabel: activity.activityNameLabel || '',
      activityOther: activity.activityOther || '',
      village: activity.village || '',
      wadi: activity.wadi || '',
      activityType: (activity.participantType as any) || 'single_farmer',
      farmerName: activity.farmerName || '',
      totalParticipants: activity.totalParticipants || 0,
      maleParticipants: activity.maleParticipants || 0,
      femaleParticipants: activity.femaleParticipants || 0,
      observations: activity.observations || '',
      farmerIssues: activity.farmerIssues || '',
      supportProvided: activity.supportProvided || [],
      followUpRequired: Boolean(activity.followUpRequired),
      followUpDetails: activity.followUpDetails || '',
      followUpDate: activity.followUpDate || '',
      photoUrl: activity.photoUrl || '',
      videoUrl: activity.videoUrl || '',
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
      const idx = existingRep.activities.findIndex((a: any) => a.activityId === activity.activityId || a.slotNumber === activity.slotNumber);
      if (idx >= 0) {
        updatedActivities = [...existingRep.activities];
        updatedActivities[idx] = slotData;
      } else {
        updatedActivities = [...existingRep.activities, slotData].sort((a, b) => a.slotNumber - b.slotNumber);
      }
    } else {
      updatedActivities = [slotData];
    }

    const { summary } = calculateActivitiesSummary(updatedActivities, false);

    const reportPayload = {
      id: reportDocId,
      staffUid: staffUser.uid,
      employeeId: staffUser.employeeId || '',
      staffName: staffUser.fullName || '',
      staffEmail: staffUser.email || '',
      departmentId: staffUser.departmentId || '',
      departmentName: staffUser.departmentName || '',
      centerId: staffUser.assignedCenterIds?.[0] || '',
      centerName: staffUser.assignedCenterNames?.[0] || '',
      reportDate: activity.reportDate,
      activities: updatedActivities,
      summary,
      status: existingRep?.status || 'draft',
      finalized: existingRep?.finalized || false,
      revisionNumber: existingRep?.revisionNumber || 1,
      createdAt: existingRep?.createdAt || activity.createdAt,
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
    };

    await saveDocument(ERP_COLLECTIONS.fieldReports, reportDocId, reportPayload);
  } catch (err) {
    console.warn('syncActivityToParentReport deferred:', err);
  }
}
