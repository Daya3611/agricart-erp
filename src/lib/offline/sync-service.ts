import { getOfflineDb, OfflineReportDraft, OfflineMediaItem } from './db';
import { ActivitySlotStatus, FieldActivitySlot, GpsCoordinate, LocationCaptureStatus } from '@/types';
import {
  convertRecordToSlot,
  normalizeActivityStatus,
  reconcileRemoteAndLocalSlots,
} from '@/lib/utils/field-activity-calculations';

/**
 * Save or update a field report draft in IndexedDB.
 */
export async function saveReportLocally(params: {
  staffUid: string;
  reportDate: string;
  activities: FieldActivitySlot[];
  crpCode?: string;
  blockTaluka?: string;
  finalized?: boolean;
  finalizationGps?: GpsCoordinate | null;
  finalizationLocationStatus?: LocationCaptureStatus;
  syncStatus?: OfflineReportDraft['syncStatus'];
}): Promise<OfflineReportDraft> {
  const db = getOfflineDb();
  const id = `field_rep_${params.staffUid}_${params.reportDate}`;
  const now = new Date().toISOString();

  const existing = await db.fieldReportDrafts.get(id);

  const draft: OfflineReportDraft = {
    id,
    staffUid: params.staffUid,
    reportDate: params.reportDate,
    crpCode: params.crpCode || existing?.crpCode || '',
    blockTaluka: params.blockTaluka || existing?.blockTaluka || '',
    activities: params.activities,
    finalized: Boolean(params.finalized),
    finalizationTimestamp: params.finalized ? (existing?.finalizationTimestamp || now) : existing?.finalizationTimestamp,
    finalizationGps: params.finalizationGps !== undefined ? params.finalizationGps : (existing?.finalizationGps || null),
    finalizationLocationStatus: params.finalizationLocationStatus || existing?.finalizationLocationStatus,
    syncStatus: params.syncStatus || (params.finalized ? 'pending_sync' : 'saved_offline'),
    idempotencyKey: existing?.idempotencyKey || `key_${id}_${Date.now()}`,
    updatedAt: now,
  };

  await db.fieldReportDrafts.put(draft);
  return draft;
}

/**
 * Load offline report draft by staffUid and reportDate.
 */
export async function loadLocalReport(staffUid: string, reportDate: string): Promise<OfflineReportDraft | null> {
  const db = getOfflineDb();
  const id = `field_rep_${staffUid}_${reportDate}`;
  const draft = await db.fieldReportDrafts.get(id);
  return draft || null;
}

/**
 * List all unsynced or locally stored drafts for a staff member.
 */
export async function listLocalReports(staffUid: string): Promise<OfflineReportDraft[]> {
  const db = getOfflineDb();
  const drafts = await db.fieldReportDrafts.where('staffUid').equals(staffUid).toArray();
  return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Save an offline media item (photo/video) directly in IndexedDB.
 */
export async function saveOfflineMedia(params: {
  reportId: string;
  slotNumber: number;
  type: 'photo' | 'video';
  file: File | Blob;
  filename: string;
  caption?: string;
}): Promise<OfflineMediaItem> {
  const db = getOfflineDb();
  const id = `media_${params.reportId}_${params.slotNumber}_${Date.now()}`;

  const mediaItem: OfflineMediaItem = {
    id,
    reportId: params.reportId,
    slotNumber: params.slotNumber,
    type: params.type,
    fileBlob: params.file,
    filename: params.filename,
    mimeType: params.file.type,
    caption: params.caption || '',
    uploaded: false,
    createdAt: new Date().toISOString(),
  };

  await db.offlineMedia.put(mediaItem);
  return mediaItem;
}

/**
 * Synchronize all pending offline reports and media items to the server.
 */
export async function syncPendingReportsToServer(): Promise<{
  syncedCount: number;
  failedCount: number;
  errors: string[];
}> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { syncedCount: 0, failedCount: 0, errors: ['Device is offline'] };
  }

  const db = getOfflineDb();
  const pendingReports = await db.fieldReportDrafts
    .where('syncStatus')
    .anyOf(['pending_sync', 'sync_failed'])
    .toArray();

  let syncedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const draft of pendingReports) {
    try {
      // Mark as syncing
      await db.fieldReportDrafts.update(draft.id, { syncStatus: 'syncing' });

      // 1. Upload any pending offline media for this report
      const pendingMedia = await db.offlineMedia
        .where('reportId')
        .equals(draft.id)
        .toArray();

      for (const media of pendingMedia) {
        if (!media.uploaded && !media.uploadedUrl) {
          try {
            const formData = new FormData();
            formData.append('file', media.fileBlob, media.filename);
            formData.append('reportId', draft.id);
            formData.append('caption', media.caption || '');

            const upRes = await fetch('/api/uploads', {
              method: 'POST',
              body: formData,
            });
            const upData = await upRes.json();
            if (upRes.ok && upData.attachment?.downloadUrl) {
              await db.offlineMedia.update(media.id, {
                uploaded: true,
                uploadedUrl: upData.attachment.downloadUrl,
              });

              // Attach url to the corresponding activity slot
              const slotIdx = draft.activities.findIndex((a) => a.slotNumber === media.slotNumber);
              if (slotIdx >= 0) {
                if (media.type === 'photo') {
                  draft.activities[slotIdx].photoUrl = upData.attachment.downloadUrl;
                } else {
                  draft.activities[slotIdx].videoUrl = upData.attachment.downloadUrl;
                }
              }
            }
          } catch (uploadErr: any) {
            console.warn(`Media sync upload warning for report ${draft.id}:`, uploadErr.message);
          }
        }
      }

      // 2. Reconcile against authoritative server activities so stale local IN_PROGRESS never overrides COMPLETED
      let reconciledActivities = draft.activities;
      try {
        const remoteRes = await fetch(`/api/field-activities?date=${draft.reportDate}`);
        const remoteData = await remoteRes.json().catch(() => ({}));
        if (remoteRes.ok && remoteData.success && Array.isArray(remoteData.activities)) {
          const remoteSlots = remoteData.activities.map(convertRecordToSlot);
          reconciledActivities = reconcileRemoteAndLocalSlots(remoteSlots, draft.activities);
          await db.fieldReportDrafts.update(draft.id, { activities: reconciledActivities });
        }
      } catch {
        // Proceed cleanly with local draft activities if check fails; server enforces guard too
      }

      // 3. Submit the report to /api/field-reports
      const payload = {
        reportDate: draft.reportDate,
        crpCode: draft.crpCode,
        blockTaluka: draft.blockTaluka,
        activities: reconciledActivities,
        finalizeNow: draft.finalized,
        finalizationGps: draft.finalizationGps,
        finalizationLocationStatus: draft.finalizationLocationStatus,
        idempotencyKey: draft.idempotencyKey,
      };

      const res = await fetch('/api/field-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // If 409 duplicate, it is already safely in Firebase
        if (res.status === 409) {
          await db.fieldReportDrafts.update(draft.id, {
            syncStatus: 'synced',
            lastSyncAttempt: new Date().toISOString(),
          });
          syncedCount++;
        } else {
          throw new Error(data.error || `Sync failed with status ${res.status}`);
        }
      } else {
        await db.fieldReportDrafts.update(draft.id, {
          syncStatus: 'synced',
          lastSyncAttempt: new Date().toISOString(),
        });
        syncedCount++;
      }
    } catch (syncErr: any) {
      failedCount++;
      errors.push(`${draft.reportDate}: ${syncErr.message}`);
      await db.fieldReportDrafts.update(draft.id, {
        syncStatus: 'sync_failed',
        syncError: syncErr.message,
        lastSyncAttempt: new Date().toISOString(),
      });
    }
  }

  return { syncedCount, failedCount, errors };
}

/**
 * Save attendance record locally in IndexedDB (for offline resilience).
 */
export async function saveAttendanceLocally(params: {
  employeeUid: string;
  employeeId: string;
  attendanceDate: string;
  action: 'login' | 'logout';
  sessionData: any;
  syncStatus?: 'saved_offline' | 'pending_sync' | 'synced';
}) {
  const db = getOfflineDb();
  const id = `att_${params.employeeUid}_${params.attendanceDate}`;
  const now = new Date().toISOString();

  await db.offlineAttendance.put({
    id,
    employeeUid: params.employeeUid,
    employeeId: params.employeeId,
    attendanceDate: params.attendanceDate,
    action: params.action,
    sessionData: params.sessionData,
    syncStatus: params.syncStatus || 'saved_offline',
    updatedAt: now,
  });
}

/**
 * Load offline attendance record for an employee on a given date.
 */
export async function loadLocalAttendance(employeeUid: string, attendanceDate: string) {
  const db = getOfflineDb();
  const id = `att_${employeeUid}_${attendanceDate}`;
  return (await db.offlineAttendance.get(id)) || null;
}

/**
 * Sync pending offline attendance records to the server.
 */
export async function syncPendingAttendanceToServer(): Promise<{ syncedCount: number; errors: string[] }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { syncedCount: 0, errors: ['Offline'] };
  }

  const db = getOfflineDb();
  const pending = await db.offlineAttendance
    .where('syncStatus')
    .anyOf(['saved_offline', 'pending_sync', 'sync_failed'])
    .toArray();

  let syncedCount = 0;
  const errors: string[] = [];

  for (const item of pending) {
    try {
      const endpoint = item.action === 'login' ? '/api/attendance/login' : '/api/attendance/logout';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.sessionData),
      });

      if (res.ok || res.status === 409) {
        await db.offlineAttendance.update(item.id, {
          syncStatus: 'synced',
          updatedAt: new Date().toISOString(),
        });
        syncedCount++;
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed with status ${res.status}`);
      }
    } catch (err: any) {
      errors.push(`${item.attendanceDate} (${item.action}): ${err.message}`);
      await db.offlineAttendance.update(item.id, {
        syncStatus: 'sync_failed',
      });
    }
  }

  return { syncedCount, errors };
}

/**
 * Save an activity locally in IndexedDB (for offline resilience and instant recovery).
 */
export async function saveActivityLocally(params: {
  activityId: string;
  reportId?: string;
  staffUid: string;
  employeeId: string;
  employeeName: string;
  reportDate: string;
  slotNumber: number;
  activityStatus: ActivitySlotStatus;
  activityData: any;
  syncStatus?: 'saved_offline' | 'pending_sync' | 'synced';
}) {
  const db = getOfflineDb();
  const now = new Date().toISOString();
  const normalizedStatus = normalizeActivityStatus({
    ...(params.activityData || {}),
    activityStatus: params.activityStatus,
  });

  await db.offlineActivities.put({
    activityId: params.activityId,
    reportId: params.reportId,
    staffUid: params.staffUid,
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    reportDate: params.reportDate,
    slotNumber: params.slotNumber,
    activityStatus: normalizedStatus,
    activityData: {
      ...(params.activityData || {}),
      activityStatus: normalizedStatus,
    },
    syncStatus: params.syncStatus || 'saved_offline',
    updatedAt: now,
  });

  // Also clear stale in-memory status inside cached draft if activity is COMPLETED or CANCELLED
  if (normalizedStatus === 'COMPLETED' || normalizedStatus === 'CANCELLED') {
    const draftId = `field_rep_${params.staffUid}_${params.reportDate}`;
    const existingDraft = await db.fieldReportDrafts.get(draftId);
    if (existingDraft && Array.isArray(existingDraft.activities)) {
      const updatedActs = existingDraft.activities.map((a) =>
        a.slotNumber === params.slotNumber
          ? {
              ...a,
              ...(params.activityData || {}),
              activityId: params.activityId,
              id: params.activityId,
              activityStatus: normalizedStatus,
            }
          : a
      );
      await db.fieldReportDrafts.update(draftId, { activities: updatedActs, updatedAt: now });
    }
  }
}

/**
 * Reconcile local Dexie offlineActivities & fieldReportDrafts against authoritative server slots
 * so COMPLETED or CANCELLED activities are never restored locally as IN_PROGRESS on reload.
 */
export async function reconcileLocalOfflineCache(
  staffUid: string,
  reportDate: string,
  serverSlots: FieldActivitySlot[]
) {
  if (typeof window === 'undefined') return;
  const db = getOfflineDb();
  const now = new Date().toISOString();
  const serverBySlot = new Map<number, FieldActivitySlot>();
  for (const s of serverSlots) {
    serverBySlot.set(Number(s.slotNumber) || 1, {
      ...s,
      activityStatus: normalizeActivityStatus(s),
    });
  }

  const localActs = await db.offlineActivities
    .where('staffUid')
    .equals(staffUid)
    .filter((a) => a.reportDate === reportDate)
    .toArray();

  for (const la of localActs) {
    const remoteSlot = serverBySlot.get(Number(la.slotNumber) || 1);
    if (!remoteSlot) continue;
    const remoteStatus = normalizeActivityStatus(remoteSlot);
    const localStatus = normalizeActivityStatus(la.activityData || la);

    if (
      (remoteStatus === 'COMPLETED' || remoteStatus === 'CANCELLED') &&
      localStatus !== remoteStatus
    ) {
      await db.offlineActivities.update(la.activityId, {
        activityStatus: remoteStatus,
        activityData: remoteSlot,
        syncStatus: 'synced',
        updatedAt: now,
      });
    }
  }
}

/**
 * Load local activities for an employee and date.
 */
export async function loadLocalActivities(staffUid: string, reportDate: string) {
  const db = getOfflineDb();
  const list = await db.offlineActivities
    .where('staffUid')
    .equals(staffUid)
    .filter((a) => a.reportDate === reportDate)
    .toArray();

  return list.sort((a, b) => a.slotNumber - b.slotNumber);
}

/**
 * Synchronize all pending offline activities to Firestore.
 */
export async function syncPendingActivitiesToServer(): Promise<{ syncedCount: number; errors: string[] }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { syncedCount: 0, errors: ['Offline'] };
  }

  const db = getOfflineDb();
  const pending = await db.offlineActivities
    .where('syncStatus')
    .anyOf(['saved_offline', 'pending_sync', 'sync_failed'])
    .toArray();

  let syncedCount = 0;
  const errors: string[] = [];
  const serverCache = new Map<string, FieldActivitySlot[]>();

  const getServerSlotsForDate = async (reportDate: string): Promise<FieldActivitySlot[]> => {
    if (serverCache.has(reportDate)) return serverCache.get(reportDate)!;
    try {
      const r = await fetch(`/api/field-activities?date=${reportDate}`);
      const d = await r.json().catch(() => ({}));
      const slots = r.ok && d.success && Array.isArray(d.activities)
        ? d.activities.map(convertRecordToSlot)
        : [];
      serverCache.set(reportDate, slots);
      return slots;
    } catch {
      return [];
    }
  };

  for (const item of pending) {
    try {
      const localStatus = normalizeActivityStatus(item.activityData || item);

      if (localStatus === 'NOT_STARTED' || localStatus === 'CANCELLED') {
        await db.offlineActivities.update(item.activityId, {
          activityStatus: localStatus,
          syncStatus: 'synced',
          updatedAt: new Date().toISOString(),
        });
        continue;
      }

      const isCompleted = localStatus === 'COMPLETED';
      if (!isCompleted) {
        // Check actual Firestore state before replaying an offline IN_PROGRESS start
        const remoteSlots = await getServerSlotsForDate(item.reportDate);
        const match = remoteSlots.find(
          (s) => s.activityId === item.activityId || s.slotNumber === item.slotNumber
        );
        const remoteStatus = match ? normalizeActivityStatus(match) : 'NOT_STARTED';
        if (remoteStatus === 'COMPLETED' || remoteStatus === 'CANCELLED') {
          await db.offlineActivities.update(item.activityId, {
            activityStatus: remoteStatus,
            activityData: match,
            syncStatus: 'synced',
            updatedAt: new Date().toISOString(),
          });
          syncedCount++;
          continue;
        }
      }

      const endpoint = isCompleted ? '/api/field-activities/end' : '/api/field-activities/start';

      const payload = isCompleted
        ? {
            activityId: item.activityId,
            endGps: item.activityData?.activityEndLocation || item.activityData?.activityEndGps,
            locationStatus: item.activityData?.activityEndLocationStatus,
            finalDetails: {
              ...item.activityData,
              slotNumber: item.slotNumber,
              reportDate: item.reportDate,
            },
          }
        : {
            activityId: item.activityId,
            slotNumber: item.slotNumber,
            reportDate: item.reportDate,
            activityName: item.activityData?.activityName,
            activityNameLabel: item.activityData?.activityNameLabel,
            activityOther: item.activityData?.activityOther,
            village: item.activityData?.village,
            wadi: item.activityData?.wadi,
            activityStartAt: item.activityData?.activityStartAt || item.activityData?.activityStart,
            gps: item.activityData?.activityStartLocation || item.activityData?.activityStartGps,
            locationStatus: item.activityData?.activityStartLocationStatus,
            initialDetails: item.activityData,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok || res.status === 409) {
        const resData = await res.json().catch(() => ({}));
        const nextStatus = resData?.activity
          ? normalizeActivityStatus(resData.activity)
          : localStatus;
        await db.offlineActivities.update(item.activityId, {
          activityStatus: nextStatus,
          ...(resData?.activity ? { activityData: convertRecordToSlot(resData.activity) } : {}),
          syncStatus: 'synced',
          updatedAt: new Date().toISOString(),
        });
        syncedCount++;
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || `Failed with status ${res.status}`;
        if (!isCompleted && msg.includes('already been completed')) {
          serverCache.delete(item.reportDate);
          const refreshed = await getServerSlotsForDate(item.reportDate);
          const match = refreshed.find(
            (s) => s.activityId === item.activityId || s.slotNumber === item.slotNumber
          );
          await db.offlineActivities.update(item.activityId, {
            activityStatus: 'COMPLETED',
            ...(match ? { activityData: match } : {}),
            syncStatus: 'synced',
            updatedAt: new Date().toISOString(),
          });
          syncedCount++;
        } else {
          throw new Error(msg);
        }
      }
    } catch (err: any) {
      errors.push(`${item.activityId}: ${err.message}`);
      await db.offlineActivities.update(item.activityId, {
        syncStatus: 'sync_failed',
      });
    }
  }

  return { syncedCount, errors };
}


