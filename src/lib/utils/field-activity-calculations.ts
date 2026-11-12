import {
  ACTIVITY_CHOICES,
  ActivityChoiceKey,
  CanonicalActivityStatus,
  EvidenceMetadataItem,
  FieldActivityRecord,
  FieldActivitySlot,
  FieldReportDailySummary,
  SUPPORT_PROVIDED_OPTIONS,
} from '@/types/field-activity';

const STATUS_PRECEDENCE: Record<CanonicalActivityStatus, number> = {
  COMPLETED: 4,
  CANCELLED: 3,
  IN_PROGRESS: 2,
  NOT_STARTED: 1,
};

function resolveActivityStartIso(obj?: Record<string, any> | null): string {
  if (!obj) return '';
  const val =
    obj.activityStartAt ||
    obj.activityStart ||
    obj.activityStartGps?.capturedAt ||
    obj.activityStartLocation?.capturedAt ||
    obj.startGps?.capturedAt ||
    obj.startTime ||
    '';
  return typeof val === 'string' ? val.trim() : '';
}

function resolveActivityEndIso(obj?: Record<string, any> | null): string {
  if (!obj) return '';
  const val =
    obj.activityEndAt ||
    obj.activityEnd ||
    obj.completedAt ||
    obj.activityEndGps?.capturedAt ||
    obj.activityEndLocation?.capturedAt ||
    obj.endGps?.capturedAt ||
    obj.endTime ||
    '';
  return typeof val === 'string' ? val.trim() : '';
}

/**
 * Normalize any activity status or record/slot into a canonical uppercase enum:
 * NOT_STARTED | IN_PROGRESS | COMPLETED | CANCELLED.
 * Never treats COMPLETED, CANCELLED, or NOT_STARTED activities as active.
 */
export function normalizeActivityStatus(
  slotOrStatus?:
    | string
    | null
    | Partial<FieldActivitySlot>
    | Partial<FieldActivityRecord>
    | Record<string, any>
): CanonicalActivityStatus {
  if (!slotOrStatus) return 'NOT_STARTED';

  if (typeof slotOrStatus === 'string') {
    const upper = slotOrStatus.trim().toUpperCase().replace(/\s+/g, '_');
    if (upper === 'COMPLETED') return 'COMPLETED';
    if (upper === 'CANCELLED' || upper === 'CANCELED') return 'CANCELLED';
    if (upper === 'IN_PROGRESS') return 'IN_PROGRESS';
    return 'NOT_STARTED';
  }

  const obj = slotOrStatus as Record<string, any>;
  const rawUpper = String(obj.activityStatus || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  const endIso = resolveActivityEndIso(obj);
  const startIso = resolveActivityStartIso(obj);

  // Explicit terminal or non-started markers take strict precedence over timestamp heuristics
  if (rawUpper === 'CANCELLED' || rawUpper === 'CANCELED') {
    return 'CANCELLED';
  }
  if (rawUpper === 'COMPLETED') {
    return 'COMPLETED';
  }
  if (rawUpper === 'NOT_STARTED') {
    return 'NOT_STARTED';
  }

  // Even if rawStatus stayed IN_PROGRESS/empty, non-empty completion/end timestamps mean completed
  if (endIso) {
    return 'COMPLETED';
  }

  if (rawUpper === 'IN_PROGRESS') {
    return 'IN_PROGRESS';
  }

  // Fallback for legacy objects missing activityStatus
  if (startIso && !endIso) {
    return 'IN_PROGRESS';
  }

  return 'NOT_STARTED';
}

export function isActivityInProgress(input?: Parameters<typeof normalizeActivityStatus>[0]): boolean {
  return normalizeActivityStatus(input) === 'IN_PROGRESS';
}

export function isActivityCompleted(input?: Parameters<typeof normalizeActivityStatus>[0]): boolean {
  return normalizeActivityStatus(input) === 'COMPLETED';
}

export function isActivityCancelled(input?: Parameters<typeof normalizeActivityStatus>[0]): boolean {
  return normalizeActivityStatus(input) === 'CANCELLED';
}

export function isActivityNotStarted(input?: Parameters<typeof normalizeActivityStatus>[0]): boolean {
  return normalizeActivityStatus(input) === 'NOT_STARTED';
}

function getRecordRecencyMs(rec: Record<string, any>): number {
  const candidates = [rec.completedAt, rec.activityEndAt, rec.updatedAt, rec.createdAt];
  for (const c of candidates) {
    if (c) {
      const t = new Date(c).getTime();
      if (!Number.isNaN(t) && t > 0) return t;
    }
  }
  return 0;
}

/**
 * Deduplicate activity records per key (defaulting to `${reportDate}__${slotNumber}`),
 * preferring terminal statuses (COMPLETED > CANCELLED > IN_PROGRESS > NOT_STARTED)
 * so orphaned stale IN_PROGRESS docs never mask completed activities.
 */
export function deduplicateActivityRecords<T extends Record<string, any>>(
  records: T[],
  keyFn: (rec: T) => string = (r) => `${r.reportDate || ''}__${Number(r.slotNumber) || 1}`
): (T & { activityStatus: CanonicalActivityStatus })[] {
  const byKey = new Map<string, T & { activityStatus: CanonicalActivityStatus }>();

  for (const rec of records) {
    const key = keyFn(rec);
    const normStatus = normalizeActivityStatus(rec);
    const normalizedRec = { ...rec, activityStatus: normStatus } as T & {
      activityStatus: CanonicalActivityStatus;
    };

    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, normalizedRec);
      continue;
    }

    const prevRank = STATUS_PRECEDENCE[normalizeActivityStatus(prev)];
    const curRank = STATUS_PRECEDENCE[normStatus];

    if (curRank > prevRank) {
      byKey.set(key, normalizedRec);
    } else if (curRank === prevRank) {
      if (getRecordRecencyMs(normalizedRec) >= getRecordRecencyMs(prev)) {
        byKey.set(key, normalizedRec);
      }
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => (Number(a.slotNumber) || 0) - (Number(b.slotNumber) || 0)
  );
}

export interface StaleOrphanResolution {
  activityId: string;
  targetStatus: 'COMPLETED' | 'CANCELLED';
  source?: Partial<FieldActivitySlot | FieldActivityRecord>;
}

export interface ActiveConflictResolution {
  blockingActivity: (FieldActivityRecord & { activityStatus: CanonicalActivityStatus }) | null;
  targetSlotCompleted: boolean;
  existingInProgressForTargetSlot:
    | (FieldActivityRecord & { activityStatus: CanonicalActivityStatus })
    | null;
  staleOrphansToHeal: StaleOrphanResolution[];
}

/**
 * Reconcile actual Firestore activity records + parent FieldReport slots to decide
 * whether starting targetSlotNumber is blocked by another genuinely IN_PROGRESS activity.
 */
export function resolveBlockingActiveActivity(params: {
  docsForDate: FieldActivityRecord[];
  parentReport?: { activities?: FieldActivitySlot[]; finalized?: boolean; status?: string } | null;
  targetSlotNumber: number;
  targetActivityId?: string;
}): ActiveConflictResolution {
  const { docsForDate, parentReport, targetSlotNumber, targetActivityId } = params;

  const parentTerminalBySlot = new Map<
    number,
    { status: 'COMPLETED' | 'CANCELLED'; slot: FieldActivitySlot }
  >();
  for (const s of parentReport?.activities || []) {
    const sNum = Number(s.slotNumber) || 0;
    if (sNum <= 0) continue;
    const norm = normalizeActivityStatus(s);
    if (norm === 'COMPLETED' || norm === 'CANCELLED') {
      parentTerminalBySlot.set(sNum, { status: norm, slot: s });
    }
  }

  const docsBySlot = new Map<number, FieldActivityRecord[]>();
  for (const doc of docsForDate) {
    const sNum = Number(doc.slotNumber) || 1;
    const arr = docsBySlot.get(sNum) || [];
    arr.push(doc);
    docsBySlot.set(sNum, arr);
  }

  const staleOrphansToHeal: StaleOrphanResolution[] = [];
  let blockingActivity: (FieldActivityRecord & { activityStatus: CanonicalActivityStatus }) | null =
    null;
  let existingInProgressForTargetSlot:
    | (FieldActivityRecord & { activityStatus: CanonicalActivityStatus })
    | null = null;
  let targetSlotCompleted =
    parentTerminalBySlot.get(targetSlotNumber)?.status === 'COMPLETED';

  for (const [sNum, group] of docsBySlot.entries()) {
    const [winner] = deduplicateActivityRecords(group, () => String(sNum));
    const winnerStatus = normalizeActivityStatus(winner);
    const parentTerminal = parentTerminalBySlot.get(sNum);

    const terminalStatus: 'COMPLETED' | 'CANCELLED' | null =
      winnerStatus === 'COMPLETED' || winnerStatus === 'CANCELLED'
        ? winnerStatus
        : parentTerminal?.status || null;

    if (terminalStatus) {
      if (sNum === targetSlotNumber && terminalStatus === 'COMPLETED') {
        targetSlotCompleted = true;
      }
      // Heal any doc in this slot still carrying stale IN_PROGRESS in Firestore
      for (const doc of group) {
        const rawUpper = String(doc.activityStatus || '').trim().toUpperCase();
        const docId = doc.activityId || doc.id;
        if (docId && (rawUpper === 'IN_PROGRESS' || rawUpper === 'IN PROGRESS' || doc.activityStatus !== terminalStatus && normalizeActivityStatus(doc) === terminalStatus)) {
          staleOrphansToHeal.push({
            activityId: docId,
            targetStatus: terminalStatus,
            source: winnerStatus === terminalStatus ? winner : parentTerminal?.slot,
          });
        }
      }
      continue;
    }

    if (winnerStatus === 'IN_PROGRESS') {
      const winnerId = winner.activityId || winner.id;
      if (sNum === targetSlotNumber) {
        existingInProgressForTargetSlot = winner;
      } else if (!blockingActivity && winnerId !== targetActivityId) {
        blockingActivity = winner;
      }
    }
  }

  return {
    blockingActivity,
    targetSlotCompleted,
    existingInProgressForTargetSlot,
    staleOrphansToHeal,
  };
}

/**
 * Reconcile authoritative server slots with local offline/cached slots on reload or sync.
 * Strictly prevents local stale IN_PROGRESS / NOT_STARTED entries from overwriting
 * COMPLETED or CANCELLED activities in Firestore.
 */
export function reconcileRemoteAndLocalSlots(
  remoteSlots: FieldActivitySlot[],
  localSlots: FieldActivitySlot[]
): FieldActivitySlot[] {
  const mergedBySlot = new Map<number, FieldActivitySlot>();

  for (const rs of remoteSlots) {
    const norm = normalizeActivityStatus(rs);
    const cur = mergedBySlot.get(rs.slotNumber);
    if (!cur || STATUS_PRECEDENCE[norm] > STATUS_PRECEDENCE[normalizeActivityStatus(cur)]) {
      mergedBySlot.set(rs.slotNumber, { ...rs, activityStatus: norm });
    }
  }

  for (const ls of localSlots) {
    const localNorm = normalizeActivityStatus(ls);
    const localNormalizedSlot: FieldActivitySlot = { ...ls, activityStatus: localNorm };
    const existingRemote = mergedBySlot.get(ls.slotNumber);

    if (!existingRemote) {
      mergedBySlot.set(ls.slotNumber, localNormalizedSlot);
      continue;
    }

    const remoteNorm = normalizeActivityStatus(existingRemote);
    const hasUnsyncedLocal =
      ls.syncStatus === 'pending_sync' || ls.syncStatus === 'saved_offline';

    // Never downgrade remote COMPLETED or CANCELLED back to IN_PROGRESS / NOT_STARTED
    if (remoteNorm === 'COMPLETED' || remoteNorm === 'CANCELLED') {
      continue;
    }

    // Offline completion always wins over remote IN_PROGRESS / NOT_STARTED
    if (localNorm === 'COMPLETED') {
      mergedBySlot.set(ls.slotNumber, localNormalizedSlot);
      continue;
    }

    // Preserve genuinely newer offline edits only while neither slot has completed
    if (hasUnsyncedLocal && STATUS_PRECEDENCE[localNorm] >= STATUS_PRECEDENCE[remoteNorm]) {
      mergedBySlot.set(ls.slotNumber, localNormalizedSlot);
    }
  }

  return Array.from(mergedBySlot.values()).sort(
    (a, b) => (Number(a.slotNumber) || 0) - (Number(b.slotNumber) || 0)
  );
}

/**
 * Validate and calculate metrics for an array of activity slots (max 20 slots).
 * Pure calculation logic safe for both client and server components.
 *
 * @param activities List of field activity slots
 * @param isFinalizing True if validating for daily report finalization (strictly requires completed activities)
 */
export function calculateActivitiesSummary(
  activities: FieldActivitySlot[],
  isFinalizing: boolean = false
): {
  summary: FieldReportDailySummary;
  validatedActivities: FieldActivitySlot[];
  errors: string[];
} {
  const errors: string[] = [];

  if (activities.length > 20) {
    errors.push('Maximum 20 activities allowed per daily report.');
  }

  // Filter out any trailing unstarted slots if finalizing
  const boundedActivities = activities.slice(0, 20);
  const validatedActivities: FieldActivitySlot[] = [];

  let inProgressCount = 0;
  let totalActivityMinutes = 0;
  let totalDeskJobMinutes = 0;
  let totalParticipantContacts = 0;
  let totalMaleParticipants = 0;
  let totalFemaleParticipants = 0;
  let firstActivityStart: string | null = null;
  let lastActivityEnd: string | null = null;

  for (let idx = 0; idx < boundedActivities.length; idx++) {
    const slot = boundedActivities[idx];
    const slotNum = idx + 1;

    // Canonical status normalization: COMPLETED | IN_PROGRESS | CANCELLED | NOT_STARTED
    const canonicalStatus = normalizeActivityStatus(slot);
    const status: 'not_started' | 'in_progress' | 'completed' | 'cancelled' =
      canonicalStatus === 'COMPLETED'
        ? 'completed'
        : canonicalStatus === 'IN_PROGRESS'
        ? 'in_progress'
        : canonicalStatus === 'CANCELLED'
        ? 'cancelled'
        : 'not_started';

    const startIso = resolveActivityStartIso(slot);
    const endIso = resolveActivityEndIso(slot);

    if (status === 'in_progress') {
      inProgressCount++;
    }

    // Finalization constraint: cannot finalize if any activity is still in progress
    if (isFinalizing && status === 'in_progress') {
      errors.push(
        `Activity ${slotNum} (${slot.activityNameLabel || slot.activityName}) is still IN PROGRESS. Please click 'Complete & End Activity' before finalizing your daily report.`
      );
    }

    // If finalizing and slot is not started or cancelled, skip continuation slots
    if (isFinalizing && (status === 'not_started' || status === 'cancelled')) {
      if (boundedActivities.length > 1) {
        continue;
      } else if (status === 'not_started') {
        errors.push(`Activity 1 has not been started. Please start and complete your activity.`);
      }
    }

    // Cancelled slots are preserved in drafts without requiring completion fields
    if (status === 'cancelled') {
      validatedActivities.push({
        ...slot,
        slotNumber: slotNum,
        activityStatus: 'CANCELLED',
      });
      continue;
    }

    // Start & End time checks
    if (status === 'completed' || status === 'in_progress') {
      if (!startIso) {
        errors.push(`Activity ${slotNum}: Start time is required.`);
      }
    }

    if (status === 'completed') {
      if (!endIso) {
        errors.push(`Activity ${slotNum}: End time is required for completed activities.`);
      }
    }

    const startDate = startIso ? new Date(startIso) : null;
    const endDate = endIso ? new Date(endIso) : null;

    if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      if (endDate < startDate) {
        errors.push(`Activity ${slotNum}: End time cannot be earlier than start time.`);
      }
    }

    let durationMinutes = Number(slot.activityDurationMinutes ?? slot.durationMinutes ?? 0);
    if (
      durationMinutes <= 0 &&
      startDate &&
      endDate &&
      !isNaN(startDate.getTime()) &&
      !isNaN(endDate.getTime()) &&
      endDate >= startDate
    ) {
      durationMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
    }

    const isDeskJob =
      slot.activityName === 'desk_job' ||
      (typeof slot.activityName === 'string' && slot.activityName.toLowerCase().includes('desk'));

    if (slot.activityName === 'other' && (!slot.activityOther || !slot.activityOther.trim())) {
      errors.push(`Activity ${slotNum}: Please specify other activity description.`);
    }

    let calculatedTotal = 0;
    let calculatedMale = 0;
    let calculatedFemale = 0;

    if (!isDeskJob) {
      // Village required for non-desk job
      if (status !== 'not_started' && (!slot.village || !slot.village.trim())) {
        errors.push(`Activity ${slotNum}: Village / Location is required for field activities.`);
      }

      // Observations required when completed or finalizing
      if ((isFinalizing || status === 'completed') && (!slot.observations || !slot.observations.trim())) {
        errors.push(`Activity ${slotNum}: Key observations/summary is required.`);
      }

      // Participant validation
      const rawType = slot.activityType || slot.participantType || 'group';
      if (isSingleFarmerActivity(rawType)) {
        if ((isFinalizing || status === 'completed') && (!slot.farmerName || !slot.farmerName.trim())) {
          errors.push(`Activity ${slotNum}: Farmer Name is required for single farmer activity.`);
        }
        calculatedTotal = 1;
        calculatedMale = Number(slot.maleParticipants) || 0;
        calculatedFemale = Number(slot.femaleParticipants) || 0;
      } else {
        // Group / community activity
        const tot = Number(slot.totalParticipants) || 0;
        const male = Number(slot.maleParticipants) || 0;
        const female = Number(slot.femaleParticipants) || 0;

        if (isFinalizing || status === 'completed') {
          if (tot < 1) {
            errors.push(`Activity ${slotNum}: Total participants must be 1 or greater for group activities.`);
          }
          if (male < 0) {
            errors.push(`Activity ${slotNum}: Male participants cannot be negative.`);
          }
          if (female < 0) {
            errors.push(`Activity ${slotNum}: Female participants cannot be negative.`);
          }
          if (male + female !== tot && tot > 0) {
            errors.push(
              `Activity ${slotNum}: Male (${male}) and female (${female}) participant counts must add up to total participants (${tot}).`
            );
          }
        }

        calculatedTotal = tot > 0 ? tot : male + female > 0 ? male + female : 1;
        calculatedMale = male;
        calculatedFemale = female;
      }
    }

    // Support Provided "other" check
    if (slot.supportProvided?.includes('other') && (!slot.supportOther || !slot.supportOther.trim())) {
      errors.push(`Activity ${slotNum}: Please specify other support details.`);
    }

    // Follow-up required check
    if (slot.followUpRequired && (!slot.followUpDetails || !slot.followUpDetails.trim())) {
      errors.push(`Activity ${slotNum}: Follow-up details are required when follow-up is marked Yes.`);
    }

    // Only add to daily duration and totals if completed
    if (status === 'completed') {
      totalActivityMinutes += durationMinutes;
      if (isDeskJob) {
        totalDeskJobMinutes += durationMinutes;
      }

      totalParticipantContacts += calculatedTotal;
      totalMaleParticipants += calculatedMale;
      totalFemaleParticipants += calculatedFemale;

      if (startIso) {
        if (!firstActivityStart || new Date(startIso).getTime() < new Date(firstActivityStart).getTime()) {
          firstActivityStart = startIso;
        }
      }
      if (endIso) {
        if (!lastActivityEnd || new Date(endIso).getTime() > new Date(lastActivityEnd).getTime()) {
          lastActivityEnd = endIso;
        }
      }
    } else if (status === 'in_progress') {
      if (startIso && (!firstActivityStart || new Date(startIso).getTime() < new Date(firstActivityStart).getTime())) {
        firstActivityStart = startIso;
      }
    }

    // Normalize start/end location objects with coordinates
    const startLoc = slot.activityStartLocation || slot.activityStartGps || null;
    const endLoc = slot.activityEndLocation || slot.activityEndGps || null;
    const mergedPhotos = mergeEvidenceUrls(slot.photoUrl, slot.photoEvidence);
    const mergedVideos = mergeEvidenceUrls(slot.videoUrl, slot.videoEvidence);
    const effectiveType = slot.activityType || slot.participantType || 'group';

    validatedActivities.push({
      ...slot,
      slotNumber: slotNum,
      activityStatus: canonicalStatus,
      activityType: effectiveType,
      participantType: slot.participantType || effectiveType,
      activityOther: slot.activityOther || '',
      wadi: slot.wadi || '',
      farmerName: slot.farmerName || '',
      groupDetails: slot.groupDetails || '',
      farmerIssues: slot.farmerIssues || '',
      supportProvided: Array.isArray(slot.supportProvided) ? slot.supportProvided : [],
      supportOther: slot.supportOther || '',
      followUpRequired: Boolean(slot.followUpRequired),
      followUpDetails: slot.followUpDetails || '',
      followUpDate: slot.followUpDate || '',
      photoUrl: mergedPhotos[0] || '',
      photoEvidence: mergedPhotos,
      videoUrl: mergedVideos[0] || '',
      videoEvidence: mergedVideos,
      activityStartAt: startIso,
      activityStart: startIso,
      activityStartLocation: startLoc,
      activityStartGps: startLoc,
      activityEndAt: endIso,
      activityEnd: endIso,
      activityEndLocation: endLoc,
      activityEndGps: endLoc,
      activityDurationMinutes: durationMinutes,
      durationMinutes,
      totalParticipants: calculatedTotal,
      maleParticipants: calculatedMale,
      femaleParticipants: calculatedFemale,
    });
  }

  // Prevent multiple simultaneously active activities
  if (inProgressCount > 1) {
    errors.push(
      'Only one activity can be IN PROGRESS at a time. Please complete the current active activity before starting another.'
    );
  }

  const completedActivitiesCount = validatedActivities.filter(
    (a) => (a.activityStatus || '').toLowerCase() === 'completed'
  ).length;
  const totalActivityHours = Math.round((totalActivityMinutes / 60) * 100) / 100;
  const totalFieldActivityMinutes = Math.max(0, totalActivityMinutes - totalDeskJobMinutes);

  let totalWorkingPeriodMinutes = 0;
  if (firstActivityStart && lastActivityEnd) {
    const s = new Date(firstActivityStart);
    const e = new Date(lastActivityEnd);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
      totalWorkingPeriodMinutes = Math.round((e.getTime() - s.getTime()) / 60000);
    }
  }
  const totalWorkingPeriodHours = Math.round((totalWorkingPeriodMinutes / 60) * 100) / 100;

  const summary: FieldReportDailySummary = {
    totalActivities: completedActivitiesCount,
    totalActivityMinutes,
    totalActivityHours,
    firstActivityStart,
    lastActivityEnd,
    totalWorkingPeriodMinutes,
    totalWorkingPeriodHours,
    totalDeskJobMinutes,
    totalFieldActivityMinutes,
    totalParticipantContacts,
    totalMaleParticipants,
    totalFemaleParticipants,
  };

  return { summary, validatedActivities, errors };
}

export function isSingleFarmerActivity(
  val?: string | Pick<FieldActivitySlot, 'participantType' | 'activityType'> | null
): boolean {
  if (val && typeof val === 'object') {
    const resolved = val.participantType || val.activityType;
    return String(resolved || '').trim() === 'single_farmer';
  }
  return String(val || '').trim() === 'single_farmer';
}

export function mergeEvidenceUrls(singleUrl?: string | null, list?: unknown): string[] {
  const result: string[] = [];
  const add = (val: unknown) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed && !result.includes(trimmed)) {
        result.push(trimmed);
      }
    }
  };
  if (Array.isArray(list)) {
    for (const item of list) add(item);
  }
  add(singleUrl);
  return result;
}

export function mergeStringList(...sources: Array<string | string[] | null | undefined>): string[] {
  const result: string[] = [];
  const add = (val: string | undefined | null) => {
    const trimmed = typeof val === 'string' ? val.trim() : '';
    if (trimmed && !result.includes(trimmed)) {
      result.push(trimmed);
    }
  };
  for (const src of sources) {
    if (Array.isArray(src)) {
      for (const item of src) add(item);
    } else if (typeof src === 'string') {
      add(src);
    }
  }
  return result;
}

export function mergeEvidenceMetadata(
  existing?: EvidenceMetadataItem[] | null,
  incoming?: EvidenceMetadataItem[] | null
): EvidenceMetadataItem[] {
  const byIdentity = new Map<string, EvidenceMetadataItem>();
  const add = (item?: EvidenceMetadataItem | null) => {
    if (!item || typeof item !== 'object') return;
    const identity =
      item.objectKey?.trim() || item.mediaId?.trim() || item.url?.trim() || item.fileName?.trim();
    if (!identity) return;
    const prev = byIdentity.get(identity);
    byIdentity.set(identity, {
      objectKey: item.objectKey?.trim() || prev?.objectKey,
      mediaId: item.mediaId?.trim() || prev?.mediaId,
      mimeType: item.mimeType || prev?.mimeType || 'application/octet-stream',
      fileName: item.fileName || prev?.fileName || 'evidence',
      uploadedAt: item.uploadedAt || prev?.uploadedAt || new Date().toISOString(),
      uploadedBy: item.uploadedBy || prev?.uploadedBy,
      url: item.url || prev?.url,
    });
  };
  if (Array.isArray(existing)) existing.forEach(add);
  if (Array.isArray(incoming)) incoming.forEach(add);
  return Array.from(byIdentity.values());
}

export function resolveActivityNameLabel(
  act: Pick<FieldActivitySlot, 'activityName' | 'activityNameLabel'>
): string {
  const mapped = ACTIVITY_CHOICES.find((c) => c.key === act.activityName)?.label;
  return (
    act.activityNameLabel ||
    mapped ||
    (act.activityName ? act.activityName.replace(/_/g, ' ') : 'Activity')
  );
}

export function resolveSupportLabels(
  act: Pick<FieldActivitySlot, 'supportProvided' | 'supportOther'>
): string[] {
  const keys = Array.isArray(act.supportProvided) ? act.supportProvided : [];
  const labels = keys.map(
    (k) => SUPPORT_PROVIDED_OPTIONS.find((opt) => opt.key === k)?.label || k.replace(/_/g, ' ')
  );
  if (act.supportOther?.trim()) {
    labels.push(`Other: ${act.supportOther.trim()}`);
  }
  return labels;
}

export function resolveSupportText(
  act: Pick<FieldActivitySlot, 'supportProvided' | 'supportOther'>
): string {
  const labels = resolveSupportLabels(act);
  return labels.length > 0 ? labels.join(', ') : 'None selected';
}

export function getHumanPlaceName(loc?: { placeName?: string } | null): string {
  if (!loc || !loc.placeName || loc.placeName.trim() === '' || loc.placeName === 'Location name unavailable') {
    return 'Location unavailable';
  }
  return loc.placeName.trim();
}

export function formatLocationDisplay(
  loc?: { latitude?: number; longitude?: number; placeName?: string } | null,
  includeCoords = true
): string {
  if (!loc) return 'Location unavailable';
  const place =
    loc.placeName && loc.placeName.trim() !== '' && loc.placeName !== 'Location name unavailable'
      ? loc.placeName.trim()
      : '';
  const hasCoords =
    typeof loc.latitude === 'number' &&
    typeof loc.longitude === 'number' &&
    !Number.isNaN(loc.latitude) &&
    !Number.isNaN(loc.longitude);

  if (includeCoords && hasCoords) {
    const coordStr = `${loc.latitude!.toFixed(5)}, ${loc.longitude!.toFixed(5)}`;
    return place ? `${place} (${coordStr})` : `Coordinates: ${coordStr}`;
  }
  return place || 'Location unavailable';
}

export function convertRecordToSlot(rec: FieldActivityRecord): FieldActivitySlot {
  const photos = mergeEvidenceUrls(rec.photoUrl, rec.photoEvidence);
  const videos = mergeEvidenceUrls(rec.videoUrl, rec.videoEvidence);
  const resolvedType = rec.participantType || rec.activityType || 'single_farmer';
  return {
    activityId: rec.activityId || rec.id,
    id: rec.activityId || rec.id,
    slotNumber: rec.slotNumber,
    activityStatus: normalizeActivityStatus(rec),
    activityName: (rec.activityName || 'farmer_visit') as ActivityChoiceKey,
    activityNameLabel: rec.activityNameLabel || undefined,
    activityOther: rec.activityOther || undefined,
    village: rec.village || '',
    wadi: rec.wadi || '',
    activityType: resolvedType,
    participantType: resolvedType,
    farmerName: rec.farmerName || '',
    groupDetails: rec.groupDetails || '',
    totalParticipants: rec.totalParticipants || 0,
    maleParticipants: rec.maleParticipants || 0,
    femaleParticipants: rec.femaleParticipants || 0,
    observations: rec.observations || '',
    farmerIssues: rec.farmerIssues || '',
    supportProvided: rec.supportProvided || [],
    supportOther: rec.supportOther || '',
    followUpRequired: Boolean(rec.followUpRequired),
    followUpDetails: rec.followUpDetails || '',
    followUpDate: rec.followUpDate || '',
    photoUrl: photos[0] || '',
    videoUrl: videos[0] || '',
    photoEvidence: photos,
    videoEvidence: videos,
    activityStart: rec.activityStartAt || (rec as any).activityStart || '',
    activityStartAt: rec.activityStartAt || (rec as any).activityStart || '',
    activityStartLocation: rec.activityStartLocation || rec.activityStartGps || null,
    activityStartGps: rec.activityStartLocation || rec.activityStartGps || null,
    activityStartLocationStatus: rec.activityStartLocationStatus || undefined,
    activityEnd: rec.activityEndAt || (rec as any).activityEnd || '',
    activityEndAt: rec.activityEndAt || (rec as any).activityEnd || '',
    activityEndLocation: rec.activityEndLocation || rec.activityEndGps || null,
    activityEndGps: rec.activityEndLocation || rec.activityEndGps || null,
    activityEndLocationStatus: rec.activityEndLocationStatus || undefined,
    durationMinutes: rec.activityDurationMinutes ?? rec.durationMinutes ?? 0,
    activityDurationMinutes: rec.activityDurationMinutes ?? rec.durationMinutes ?? 0,
    completedAt: (rec as any).completedAt ?? null,
    updatedAt: rec.updatedAt,
    syncStatus: 'synced',
  };
}

export function mergeDayActivities(
  reportActs: FieldActivitySlot[] = [],
  standaloneRecords: FieldActivityRecord[] = []
): FieldActivitySlot[] {
  const bySlot = new Map<number, FieldActivitySlot>();
  for (const act of reportActs) {
    bySlot.set(act.slotNumber, {
      ...act,
      activityStatus: normalizeActivityStatus(act),
    });
  }
  const dedupedStandalone = deduplicateActivityRecords(
    standaloneRecords,
    (r) => String(r.slotNumber || 1)
  );
  for (const rec of dedupedStandalone) {
    const slotFromRec = convertRecordToSlot(rec);
    const existing = bySlot.get(rec.slotNumber);
    if (!existing) {
      bySlot.set(rec.slotNumber, slotFromRec);
      continue;
    }
    const recStatus = normalizeActivityStatus(rec);
    const existingStatus = normalizeActivityStatus(existing);
    const recRank = STATUS_PRECEDENCE[recStatus];
    const existingRank = STATUS_PRECEDENCE[existingStatus];
    const recUpdatedMs = getRecordRecencyMs(rec);
    const existingUpdatedMs = getRecordRecencyMs(existing);

    // Never allow a non-completed / stale standalone doc to downgrade a COMPLETED or CANCELLED slot
    const shouldTakeStandalone =
      recRank > existingRank ||
      (recRank === existingRank && recUpdatedMs >= existingUpdatedMs);

    if (shouldTakeStandalone) {
      bySlot.set(rec.slotNumber, {
        ...existing,
        ...slotFromRec,
        activityStatus: recStatus,
        groupDetails: slotFromRec.groupDetails || existing.groupDetails,
        supportOther: slotFromRec.supportOther || existing.supportOther,
        activityOther: slotFromRec.activityOther || existing.activityOther,
        followUpDate: slotFromRec.followUpDate || existing.followUpDate,
        photoEvidence: mergeEvidenceUrls(existing.photoUrl, [
          ...(existing.photoEvidence || []),
          ...(slotFromRec.photoEvidence || []),
        ]),
        videoEvidence: mergeEvidenceUrls(existing.videoUrl, [
          ...(existing.videoEvidence || []),
          ...(slotFromRec.videoEvidence || []),
        ]),
      });
    }
  }
  return Array.from(bySlot.values()).sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0));
}
