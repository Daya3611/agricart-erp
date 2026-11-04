import { FieldActivitySlot, FieldReportDailySummary } from '@/types';

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

    // Normalize status (handles uppercase COMPLETED / IN_PROGRESS and lowercase completed / in_progress)
    const rawStatus = (slot.activityStatus || '').toLowerCase();
    const startIso =
      slot.activityStartAt ||
      slot.activityStart ||
      (slot as any).activityStartGps?.capturedAt ||
      (slot as any).activityStartLocation?.capturedAt ||
      (slot as any).startGps?.capturedAt ||
      (slot as any).startTime ||
      '';
    const endIso =
      slot.activityEndAt ||
      slot.activityEnd ||
      (slot as any).activityEndGps?.capturedAt ||
      (slot as any).activityEndLocation?.capturedAt ||
      (slot as any).endGps?.capturedAt ||
      (slot as any).endTime ||
      '';

    const hasDuration =
      Number(slot.durationMinutes) > 0 || Number(slot.activityDurationMinutes) > 0;

    const isCompleted =
      rawStatus === 'completed' ||
      Boolean(endIso && startIso && hasDuration) ||
      Boolean(rawStatus === 'completed');

    const isInProgress =
      !isCompleted &&
      (rawStatus === 'in_progress' || Boolean(startIso && !endIso));

    const status: 'not_started' | 'in_progress' | 'completed' = isCompleted
      ? 'completed'
      : isInProgress
      ? 'in_progress'
      : 'not_started';

    if (status === 'in_progress') {
      inProgressCount++;
    }

    // Finalization constraint: cannot finalize if any activity is still in progress
    if (isFinalizing && status === 'in_progress') {
      errors.push(
        `Activity ${slotNum} (${slot.activityNameLabel || slot.activityName}) is still IN PROGRESS. Please click 'Complete & End Activity' before finalizing your daily report.`
      );
    }

    // If finalizing and slot is not started, skip if not the only slot
    if (isFinalizing && status === 'not_started') {
      if (boundedActivities.length > 1) {
        continue; // ignore unstarted continuation slot
      } else {
        errors.push(`Activity 1 has not been started. Please start and complete your activity.`);
      }
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
      if (slot.activityType === 'single_farmer') {
        if ((isFinalizing || status === 'completed') && (!slot.farmerName || !slot.farmerName.trim())) {
          errors.push(`Activity ${slotNum}: Farmer Name is required for single farmer activity.`);
        }
        calculatedTotal = 1;
        calculatedMale = 0;
        calculatedFemale = 0;
      } else {
        // Group activity
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

    validatedActivities.push({
      ...slot,
      slotNumber: slotNum,
      activityStatus: isCompleted ? 'COMPLETED' : isInProgress ? 'IN_PROGRESS' : 'not_started',
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
