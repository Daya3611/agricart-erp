'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  PlusCircle,
  Save,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Download,
  RotateCcw,
  MapPin,
  Calendar,
  Building2,
  Lock,
  Eye,
  Sparkles,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AttendanceWidget } from '@/components/attendance/AttendanceWidget';
import { FieldActivitySlotCard } from '@/components/reports/FieldActivitySlotCard';
import { FieldDailySummaryCard } from '@/components/reports/FieldDailySummaryCard';
import {
  AttendanceSession,
  FieldReport,
  FieldActivitySlot,
  FieldReportDailySummary,
  UserProfile,
  GpsCoordinate,
  LocationCaptureStatus,
} from '@/types';
import { getOperationalDateString, formatReadableDate } from '@/lib/utils/date-utils';
import {
  calculateActivitiesSummary,
  convertRecordToSlot,
  isActivityCompleted,
  isActivityInProgress,
  mergeDayActivities,
  normalizeActivityStatus,
  reconcileRemoteAndLocalSlots,
} from '@/lib/utils/field-activity-calculations';
import { captureCurrentGps } from '@/lib/utils/geolocation';
import {
  saveReportLocally,
  loadLocalReport,
  loadLocalAttendance,
  syncPendingReportsToServer,
  saveActivityLocally,
  loadLocalActivities,
  syncPendingActivitiesToServer,
  reconcileLocalOfflineCache,
} from '@/lib/offline/sync-service';

function defaultSlot(slotNumber: number): FieldActivitySlot {
  return {
    slotNumber,
    activityStatus: 'NOT_STARTED',
    activityStart: '',
    activityStartAt: '',
    activityStartLocation: null,
    activityStartGps: null,
    activityName: 'farmer_visit',
    activityNameLabel: 'Farmer Visit',
    activityOther: '',
    activityType: 'single_farmer',
    participantType: 'single_farmer',
    farmerName: '',
    groupDetails: '',
    village: '',
    wadi: '',
    totalParticipants: 1,
    maleParticipants: 0,
    femaleParticipants: 0,
    observations: '',
    farmerIssues: '',
    supportProvided: [],
    supportOther: '',
    followUpRequired: false,
    followUpDetails: '',
    followUpDate: '',
    photoUrl: '',
    photoEvidence: [],
    videoUrl: '',
    videoEvidence: [],
    activityEnd: '',
    activityEndAt: '',
    activityEndLocation: null,
    activityEndGps: null,
    durationMinutes: 0,
    activityDurationMinutes: 0,
  };
}

function FieldActivityReportingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportIdParam = searchParams.get('id');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [reportDate, setReportDate] = useState<string>(getOperationalDateString());
  const [crpCode, setCrpCode] = useState<string>('');
  const [blockTaluka, setBlockTaluka] = useState<string>('');

  const [activities, setActivitiesState] = useState<FieldActivitySlot[]>([defaultSlot(1)]);
  const activitiesRef = React.useRef<FieldActivitySlot[]>([defaultSlot(1)]);
  const setActivities = React.useCallback(
    (updater: React.SetStateAction<FieldActivitySlot[]>) => {
      if (typeof updater === 'function') {
        setActivitiesState((prev) => {
          const next = updater(prev);
          activitiesRef.current = next;
          return next;
        });
      } else {
        activitiesRef.current = updater;
        setActivitiesState(updater);
      }
    },
    []
  );
  const [continuationAnswers, setContinuationAnswers] = useState<Record<number, boolean>>({});

  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizationGps, setFinalizationGps] = useState<GpsCoordinate | null>(null);
  const [existingReport, setExistingReport] = useState<FieldReport | null>(null);
  const [attendanceSession, setAttendanceSession] = useState<AttendanceSession | null>(null);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);

  const isRevisionMode = Boolean(
    existingReport &&
      (existingReport.status === 'correction_requested' ||
        existingReport.status === 'edit_requested')
  );
  const isDayStarted = Boolean(attendanceSession && attendanceSession.status === 'active');
  const hasRecordedActivity = activities.some(
    (a) => normalizeActivityStatus(a) !== 'NOT_STARTED'
  );

  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending_sync' | 'saved_offline' | 'draft'>('draft');
  const [isOnline, setIsOnline] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [savingSlotDraft, setSavingSlotDraft] = useState<Record<number, boolean>>({});
  const autoSaveTimeoutRef = React.useRef<Record<number, NodeJS.Timeout>>({});
  const autoSaveGenRef = React.useRef<Record<number, number>>({});
  const startingLockRef = React.useRef<Record<number, boolean>>({});
  const endingLockRef = React.useRef<Record<number, boolean>>({});
  const finalizingLockRef = React.useRef(false);
  const userRef = React.useRef<UserProfile | null>(null);
  const reportDateRef = React.useRef<string>(reportDate);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    reportDateRef.current = reportDate;
  }, [reportDate]);

  /**
   * Re-fetch live activities from Firestore and reconcile local React + Dexie state
   * so stale IN_PROGRESS caches never override COMPLETED / CANCELLED / NOT_STARTED records.
   */
  const refreshAuthoritativeActivities = React.useCallback(
    async (
      staffUid: string,
      dateStr: string,
      options?: {
        reportActivities?: FieldActivitySlot[];
        localFallbackSlots?: FieldActivitySlot[];
        preserveSlot?: FieldActivitySlot;
      }
    ): Promise<FieldActivitySlot[] | null> => {
      if (typeof window === 'undefined' || !navigator.onLine) return null;
      try {
        const actRes = await fetch(`/api/field-activities?date=${encodeURIComponent(dateStr)}`, {
          cache: 'no-store',
        });
        const actData = await actRes.json().catch(() => ({}));
        if (!actRes.ok || !actData.success) return null;

        const remoteRecords = Array.isArray(actData.activities) ? actData.activities : [];
        const reportSlots = options?.reportActivities || [];
        const remoteSlots = mergeDayActivities(reportSlots, remoteRecords).map((s) => ({
          ...defaultSlot(s.slotNumber),
          ...s,
          activityStatus: normalizeActivityStatus(s),
          activityStartLocationStatus:
            s.activityStartLocationStatus || (s.activityStartAt ? 'captured' : undefined),
          activityEndLocationStatus:
            s.activityEndLocationStatus || (s.activityEndAt ? 'captured' : undefined),
        }));

        const remoteWithPreserve = options?.preserveSlot
          ? reconcileRemoteAndLocalSlots(remoteSlots, [options.preserveSlot])
          : remoteSlots;

        const localSlots = options?.localFallbackSlots ?? activitiesRef.current;
        const reconciled =
          remoteWithPreserve.length > 0
            ? reconcileRemoteAndLocalSlots(remoteWithPreserve, localSlots)
            : localSlots;

        if (reconciled.length > 0) {
          setActivities(reconciled);
        }
        await reconcileLocalOfflineCache(staffUid, dateStr, remoteWithPreserve);
        return reconciled;
      } catch (err) {
        console.warn('Authoritative activity refresh warning:', err);
        return null;
      }
    },
    [setActivities]
  );

  // Monitor network connectivity & auto-sync pending activities & reports
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      Promise.all([
        syncPendingActivitiesToServer(),
        syncPendingReportsToServer(),
      ]).then(async ([actRes, repRes]) => {
        if (userRef.current) {
          await refreshAuthoritativeActivities(userRef.current.uid, reportDateRef.current);
        }
        const total = (actRes.syncedCount || 0) + (repRes.syncedCount || 0);
        if (total > 0) {
          setStatusMessage({
            type: 'success',
            text: `Reconnected! Successfully synced ${total} offline item(s) to cloud.`,
          });
        }
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshAuthoritativeActivities]);

  // Initial load: restore active & completed activities from Firestore and local Dexie
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        // 1. Session user
        const sessRes = await fetch('/api/auth/session', { cache: 'no-store' });
        const sessData = await sessRes.json();
        if (sessData.authenticated && sessData.user) {
          setUser(sessData.user);
          userRef.current = sessData.user;
          const staffUid = sessData.user.uid;

          let targetDate = reportDate;
          let loadedReport: FieldReport | null = null;

          // When opening by specific report ID (e.g. from Corrections / Report History), resolve its operational date first
          if (reportIdParam && navigator.onLine) {
            try {
              const idRes = await fetch(`/api/field-reports/${reportIdParam}`, { cache: 'no-store' });
              const idData = await idRes.json().catch(() => ({}));
              if (idRes.ok && idData.success && idData.report) {
                loadedReport = idData.report as FieldReport;
                if (loadedReport.reportDate) {
                  targetDate = loadedReport.reportDate;
                  if (targetDate !== reportDate) {
                    setReportDate(targetDate);
                    reportDateRef.current = targetDate;
                  }
                }
              }
            } catch (idErr) {
              console.warn('Report ID lookup warning:', idErr);
            }
          }

          // 2. Check local Dexie offline draft, activities, and attendance for the resolved date
          const [localDraft, localActivities, localAtt] = await Promise.all([
            loadLocalReport(staffUid, targetDate),
            loadLocalActivities(staffUid, targetDate),
            loadLocalAttendance(staffUid, targetDate),
          ]);

          if (localAtt?.sessionData) {
            setAttendanceSession(localAtt.sessionData);
            setAttendanceLoaded(true);
          }

          let initialSlots: FieldActivitySlot[] = [];

          if (localActivities && localActivities.length > 0) {
            initialSlots = localActivities.map((la) => ({
              ...defaultSlot(la.slotNumber),
              ...la.activityData,
              activityId: la.activityId,
              id: la.activityId,
              slotNumber: la.slotNumber,
              activityStatus: normalizeActivityStatus(la.activityData || la),
              syncStatus: la.syncStatus as any,
            }));
          } else if (localDraft && localDraft.activities?.length > 0) {
            initialSlots = localDraft.activities.map((a) => ({
              ...defaultSlot(a.slotNumber),
              ...a,
              activityStatus: normalizeActivityStatus(a),
            }));
          }

          if (localDraft) {
            setIsFinalized(Boolean(localDraft.finalized));
            setFinalizationGps(localDraft.finalizationGps || null);
            setCrpCode(localDraft.crpCode || '');
            setBlockTaluka(localDraft.blockTaluka || '');
            setSyncStatus(localDraft.syncStatus as any);
          }

          // 3. Check remote server activities, report, and attendance (Firestore is authoritative)
          if (navigator.onLine) {
            try {
              const [actRes, repRes, attRes] = await Promise.all([
                fetch(`/api/field-activities?date=${encodeURIComponent(targetDate)}`, {
                  cache: 'no-store',
                }),
                loadedReport
                  ? Promise.resolve(null)
                  : fetch(`/api/field-reports/check?date=${encodeURIComponent(targetDate)}`, {
                      cache: 'no-store',
                    }),
                fetch('/api/attendance/current', { cache: 'no-store' }),
              ]);

              if (attRes.ok) {
                const attData = await attRes.json().catch(() => ({}));
                if (attData.success) {
                  setAttendanceSession(attData.session || null);
                  setAttendanceLoaded(true);
                }
              }

              const actData = await actRes.json().catch(() => ({}));
              if (!loadedReport && repRes) {
                const repData = await repRes.json().catch(() => ({}));
                if (repRes.ok && repData.success && repData.report) {
                  loadedReport = repData.report as FieldReport;
                }
              }

              if (loadedReport) {
                const rep: FieldReport = loadedReport;
                const isReopened = rep.status === 'correction_requested' || rep.status === 'edit_requested';
                setExistingReport(rep);
                setReportDate(rep.reportDate);
                reportDateRef.current = rep.reportDate;
                setCrpCode(rep.crpCode || '');
                setBlockTaluka(rep.blockTaluka || '');
                setIsFinalized(
                  !isReopened &&
                    Boolean(
                      rep.finalized ||
                        rep.status === 'submitted' ||
                        rep.status === 'resubmitted' ||
                        rep.status === 'approved' ||
                        rep.status === 'rejected'
                    )
                );
                setFinalizationGps(rep.finalizationGps || null);
                setSyncStatus('synced');
              }

              const reportSlots =
                loadedReport && Array.isArray(loadedReport.activities)
                  ? loadedReport.activities
                  : [];
              const standaloneRecs =
                actRes.ok && actData.success && Array.isArray(actData.activities)
                  ? actData.activities
                  : [];

              const remoteSlots = mergeDayActivities(reportSlots, standaloneRecs).map((s) => ({
                ...defaultSlot(s.slotNumber),
                ...s,
                activityStatus: normalizeActivityStatus(s),
                activityStartLocationStatus:
                  s.activityStartLocationStatus || (s.activityStartAt ? 'captured' : undefined),
                activityEndLocationStatus:
                  s.activityEndLocationStatus || (s.activityEndAt ? 'captured' : undefined),
              }));

              if (remoteSlots.length > 0) {
                initialSlots = reconcileRemoteAndLocalSlots(remoteSlots, initialSlots);
                await reconcileLocalOfflineCache(staffUid, targetDate, remoteSlots);
              }
            } catch (netErr) {
              console.warn('Remote check error, using local data:', netErr);
            }
          }

          if (initialSlots.length > 0) {
            setActivities(initialSlots);
            // Reconstruct continuation answers
            const contMap: Record<number, boolean> = {};
            for (let i = 1; i < initialSlots.length; i++) {
              contMap[i] = true;
            }
            setContinuationAnswers(contMap);
          } else {
            setActivities([defaultSlot(1)]);
          }
        }
      } catch (err: any) {
        console.warn('Field activity reporting init warning:', err.message);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [reportDate, reportIdParam]);

  // Handle activity update (local state + Dexie + debounced autosave to Firestore if in progress)
  const handleUpdateActivity = (updated: FieldActivitySlot) => {
    const normalizedStatus = normalizeActivityStatus(updated);
    const normalizedUpdated: FieldActivitySlot = {
      ...updated,
      activityStatus: normalizedStatus,
    };

    setActivities((prev) =>
      prev.map((a) => (a.slotNumber === normalizedUpdated.slotNumber ? normalizedUpdated : a))
    );

    const activeUser = userRef.current || user;
    if (!activeUser) return;

    const slotNum = normalizedUpdated.slotNumber;
    const nextGen = (autoSaveGenRef.current[slotNum] || 0) + 1;
    autoSaveGenRef.current[slotNum] = nextGen;

    // 1. Save locally in Dexie immediately (unless End Activity is actively running for this slot)
    if (normalizedUpdated.activityId && !endingLockRef.current[slotNum]) {
      saveActivityLocally({
        activityId: normalizedUpdated.activityId,
        staffUid: activeUser.uid,
        employeeId: activeUser.employeeId || '',
        employeeName: activeUser.fullName || '',
        reportDate,
        slotNumber: slotNum,
        activityStatus: normalizedStatus,
        activityData: normalizedUpdated,
        syncStatus: 'saved_offline',
      }).catch(console.warn);
    }

    // 2. Debounced autosave to Firestore strictly while genuinely IN_PROGRESS
    if (isActivityInProgress(normalizedUpdated) && normalizedUpdated.activityId && navigator.onLine) {
      if (autoSaveTimeoutRef.current[slotNum]) {
        clearTimeout(autoSaveTimeoutRef.current[slotNum]);
      }

      const targetActivityId = normalizedUpdated.activityId;
      autoSaveTimeoutRef.current[slotNum] = setTimeout(async () => {
        if (endingLockRef.current[slotNum] || autoSaveGenRef.current[slotNum] !== nextGen) {
          return;
        }
        const currentLatest = activitiesRef.current.find((a) => a.slotNumber === slotNum);
        if (!currentLatest || !isActivityInProgress(currentLatest)) {
          return;
        }

        try {
          const saveRes = await fetch('/api/field-activities/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              activityId: targetActivityId,
              updates: normalizedUpdated,
            }),
          });
          const saveData = await saveRes.json().catch(() => ({}));

          // Abort local overwrite if End Activity started or completed while request was in flight
          if (endingLockRef.current[slotNum] || autoSaveGenRef.current[slotNum] !== nextGen) {
            return;
          }
          const postFetchSlot = activitiesRef.current.find((a) => a.slotNumber === slotNum);
          if (postFetchSlot && !isActivityInProgress(postFetchSlot)) {
            return;
          }

          const latestUser = userRef.current || activeUser;
          if (latestUser) {
            const resolvedStatus = normalizeActivityStatus(saveData?.activity || postFetchSlot || normalizedUpdated);
            await saveActivityLocally({
              activityId: targetActivityId,
              staffUid: latestUser.uid,
              employeeId: latestUser.employeeId || '',
              employeeName: latestUser.fullName || '',
              reportDate: reportDateRef.current || reportDate,
              slotNumber: slotNum,
              activityStatus: resolvedStatus,
              activityData:
                saveData?.activity && resolvedStatus !== 'IN_PROGRESS'
                  ? { ...normalizedUpdated, ...convertRecordToSlot(saveData.activity), activityStatus: resolvedStatus }
                  : { ...normalizedUpdated, activityStatus: resolvedStatus },
              syncStatus: 'synced',
            });
          }
        } catch (err) {
          console.warn(`Autosave failed for activity #${slotNum}:`, err);
        }
      }, 1500); // 1.5s debounce
    }
  };

  // Explicit Save Draft for a single activity slot
  const handleSaveActivityDraft = async (slotNumber: number) => {
    const slot = activities.find((s) => s.slotNumber === slotNumber);
    if (!slot || !user) return;

    setSavingSlotDraft((prev) => ({ ...prev, [slotNumber]: true }));
    try {
      let savedViaSlotApi = false;
      if (slot.activityId && navigator.onLine) {
        const res = await fetch('/api/field-activities/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: slot.activityId,
            updates: slot,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          savedViaSlotApi = true;
        } else if (data.error && !data.error.includes('not found in database')) {
          throw new Error(data.error || 'Failed to save activity draft.');
        }
      }

      // Fallback or reopened report: persist entire report draft so changes are never lost
      if (!savedViaSlotApi && navigator.onLine) {
        const repRes = await fetch('/api/field-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportDate,
            crpCode,
            blockTaluka,
            activities,
            finalizeNow: false,
          }),
        });
        const repData = await repRes.json();
        if (!repRes.ok || !repData.success) {
          throw new Error(repData.error || 'Failed to save activity draft.');
        }
      }

      await saveActivityLocally({
        activityId: slot.activityId || `draft_act_${user.uid}_${reportDate}_s${slotNumber}`,
        staffUid: user.uid,
        employeeId: user.employeeId || '',
        employeeName: user.fullName || '',
        reportDate,
        slotNumber,
        activityStatus: normalizeActivityStatus(slot),
        activityData: { ...slot, activityStatus: normalizeActivityStatus(slot) },
        syncStatus: navigator.onLine ? 'synced' : 'saved_offline',
      });

      setStatusMessage({
        type: 'success',
        text: `Activity #${slotNumber} changes saved successfully.`,
      });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
      throw err;
    } finally {
      setSavingSlotDraft((prev) => ({ ...prev, [slotNumber]: false }));
    }
  };

  // Start an activity: validates Start Day + live Firestore state first, then creates/updates IN_PROGRESS doc
  const handleStartActivity = async (slotNumber: number) => {
    if (!user) throw new Error('You must be logged in to start an activity.');
    if (!isDayStarted) {
      throw new Error('Please click "Clock In / Start Day" first before creating or starting an activity.');
    }
    if (isFinalized) throw new Error('This report has already been finalized.');
    if (startingLockRef.current[slotNumber]) return;
    startingLockRef.current[slotNumber] = true;

    try {
      // 1. Refresh authoritative Firestore state before validating active conflicts so stale local
      // caches or already-completed slots never falsely block starting a new activity
      let currentActivities = activitiesRef.current;
      if (navigator.onLine) {
        const refreshed = await refreshAuthoritativeActivities(user.uid, reportDate);
        if (refreshed && refreshed.length > 0) {
          currentActivities = refreshed;
        }
      }

      const targetSlot =
        currentActivities.find((s) => s.slotNumber === slotNumber) || defaultSlot(slotNumber);

      if (isActivityCompleted(targetSlot)) {
        throw new Error(
          `Activity #${slotNumber} has already been completed and cannot be restarted.`
        );
      }

      // 2. Only block when another activity genuinely has status IN_PROGRESS
      const activeElsewhere = currentActivities.find(
        (a) => a.slotNumber !== slotNumber && isActivityInProgress(a)
      );
      if (activeElsewhere) {
        const activeLabel = activeElsewhere.activityNameLabel || activeElsewhere.activityName;
        throw new Error(
          `Activity #${activeElsewhere.slotNumber} (${activeLabel}) is already IN PROGRESS. Please complete it by clicking 'End Activity' before starting a new one.`
        );
      }

      // Capture real GPS coordinates with reverse geocoded place name
      const res = await captureCurrentGps();
      const nowIso = new Date().toISOString();

      // Always mint a fresh activityId for NOT_STARTED / CANCELLED slots to prevent stale ID reuse
      let assignedActivityId =
        isActivityInProgress(targetSlot) && targetSlot.activityId
          ? targetSlot.activityId
          : `act_${user.uid}_${reportDate}_s${slotNumber}_${Date.now()}`;
      let isServerSaved = false;
      let serverActivityRecord: any = null;

      if (navigator.onLine) {
        try {
          const startRes = await fetch('/api/field-activities/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              activityId: assignedActivityId,
              slotNumber,
              reportDate,
              activityName: targetSlot.activityName,
              activityNameLabel: targetSlot.activityNameLabel,
              activityOther: targetSlot.activityOther,
              village: targetSlot.village,
              wadi: targetSlot.wadi,
              gps: res.coords,
              locationStatus: res.status,
              initialDetails: targetSlot,
            }),
          });

          const startData = await startRes.json();
          if (!startRes.ok || !startData.success) {
            throw new Error(startData.error || 'Failed to start activity in database.');
          }

          if (startData.activityId) {
            assignedActivityId = startData.activityId;
          }
          if (startData.activity) {
            serverActivityRecord = startData.activity;
          }
          isServerSaved = true;
        } catch (apiErr: any) {
          if (
            apiErr.message.includes('already IN PROGRESS') ||
            apiErr.message.includes('already been completed')
          ) {
            await refreshAuthoritativeActivities(user.uid, reportDate);
            throw apiErr;
          }
          console.warn('Online activity start deferred to offline:', apiErr.message);
        }
      }

      const updatedSlot: FieldActivitySlot = serverActivityRecord
        ? {
            ...targetSlot,
            ...convertRecordToSlot(serverActivityRecord),
            activityId: assignedActivityId,
            id: assignedActivityId,
            activityStatus: normalizeActivityStatus(serverActivityRecord),
            syncStatus: 'synced',
          }
        : {
            ...targetSlot,
            activityId: assignedActivityId,
            id: assignedActivityId,
            activityStatus: 'IN_PROGRESS',
            activityStartAt: nowIso,
            activityStart: nowIso,
            activityStartLocation: res.coords,
            activityStartGps: res.coords,
            activityStartLocationStatus: res.status,
            activityEndAt: '',
            activityEnd: '',
            activityEndLocation: null,
            activityEndGps: null,
            completedAt: null,
            durationMinutes: 0,
            activityDurationMinutes: 0,
            syncStatus: isServerSaved ? 'synced' : 'saved_offline',
          };

      const latestActivities = activitiesRef.current;
      const hasSlot = latestActivities.some((s) => s.slotNumber === slotNumber);
      const updatedActivities = hasSlot
        ? latestActivities.map((s) => (s.slotNumber === slotNumber ? updatedSlot : s))
        : [...latestActivities, updatedSlot].sort((a, b) => a.slotNumber - b.slotNumber);
      setActivities(updatedActivities);

      // Save locally in Dexie immediately
      await saveActivityLocally({
        activityId: assignedActivityId,
        staffUid: user.uid,
        employeeId: user.employeeId || '',
        employeeName: user.fullName || '',
        reportDate,
        slotNumber,
        activityStatus: updatedSlot.activityStatus as any,
        activityData: updatedSlot,
        syncStatus: isServerSaved ? 'synced' : 'pending_sync',
      });

      await saveReportLocally({
        staffUid: user.uid,
        reportDate,
        activities: updatedActivities,
        crpCode,
        blockTaluka,
        finalized: false,
        syncStatus: isServerSaved ? 'synced' : 'saved_offline',
      });

      if (isServerSaved) {
        await refreshAuthoritativeActivities(user.uid, reportDate, { preserveSlot: updatedSlot });
      }

      setStatusMessage({
        type: 'success',
        text: isServerSaved
          ? `Activity #${slotNumber} started and saved in Firestore immediately!`
          : `Activity #${slotNumber} started locally offline. Will sync when online.`,
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      startingLockRef.current[slotNumber] = false;
    }
  };

  // End an activity: confirms Firestore COMPLETED first, then refreshes local state & clears active ref
  const handleEndActivity = async (slotNumber: number) => {
    if (!user) throw new Error('You must be logged in.');
    if (isFinalized) throw new Error('This report has already been finalized.');
    if (endingLockRef.current[slotNumber]) return;
    endingLockRef.current[slotNumber] = true;

    try {
      // Invalidate any pending or in-flight autosave for this slot immediately
      autoSaveGenRef.current[slotNumber] = (autoSaveGenRef.current[slotNumber] || 0) + 1;
      if (autoSaveTimeoutRef.current[slotNumber]) {
        clearTimeout(autoSaveTimeoutRef.current[slotNumber]);
      }

      const currentSlot = activitiesRef.current.find((s) => s.slotNumber === slotNumber);
      if (!currentSlot) throw new Error('Activity slot not found.');

      // Capture fresh GPS coordinates with reverse geocoded place name
      const res = await captureCurrentGps();
      const nowIso = new Date().toISOString();

      const startMs = new Date(currentSlot.activityStartAt || currentSlot.activityStart || nowIso).getTime();
      const endMs = new Date(nowIso).getTime();
      const durMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

      let isServerSaved = false;
      let serverCompletedRecord: any = null;

      if (currentSlot.activityId && navigator.onLine) {
        const endRes = await fetch('/api/field-activities/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: currentSlot.activityId,
            endGps: res.coords,
            locationStatus: res.status,
            finalDetails: {
              ...currentSlot,
              durationMinutes: durMinutes,
              activityDurationMinutes: durMinutes,
              activityEndAt: nowIso,
            },
          }),
        });

        const endData = await endRes.json();
        if (!endRes.ok || !endData.success) {
          throw new Error(endData.error || 'Failed to complete activity in database.');
        }
        serverCompletedRecord = endData.activity || null;
        isServerSaved = true;
      }

      const resolvedActivityId =
        serverCompletedRecord?.activityId || currentSlot.activityId;

      const updatedSlot: FieldActivitySlot = serverCompletedRecord
        ? {
            ...currentSlot,
            ...convertRecordToSlot(serverCompletedRecord),
            activityId: resolvedActivityId,
            id: resolvedActivityId,
            activityStatus: 'COMPLETED',
            syncStatus: 'synced',
          }
        : {
            ...currentSlot,
            activityId: resolvedActivityId,
            id: resolvedActivityId,
            activityStatus: 'COMPLETED',
            activityEndAt: nowIso,
            activityEnd: nowIso,
            activityEndLocation: res.coords,
            activityEndGps: res.coords,
            activityEndLocationStatus: res.status,
            completedAt: nowIso,
            durationMinutes: durMinutes,
            activityDurationMinutes: durMinutes,
            syncStatus: isServerSaved ? 'synced' : 'saved_offline',
          };

      const updatedActivities = activitiesRef.current.map((s) =>
        s.slotNumber === slotNumber ? updatedSlot : s
      );
      setActivities(updatedActivities);

      if (resolvedActivityId) {
        await saveActivityLocally({
          activityId: resolvedActivityId,
          staffUid: user.uid,
          employeeId: user.employeeId || '',
          employeeName: user.fullName || '',
          reportDate,
          slotNumber,
          activityStatus: 'COMPLETED',
          activityData: updatedSlot,
          syncStatus: isServerSaved ? 'synced' : 'pending_sync',
        });
      }

      await saveReportLocally({
        staffUid: user.uid,
        reportDate,
        activities: updatedActivities,
        crpCode,
        blockTaluka,
        finalized: false,
        syncStatus: isServerSaved ? 'synced' : 'saved_offline',
      });

      // Immediately refresh live Firestore state after completion is persisted
      if (isServerSaved) {
        await refreshAuthoritativeActivities(user.uid, reportDate, { preserveSlot: updatedSlot });
      }

      setStatusMessage({
        type: 'success',
        text: `Activity #${slotNumber} completed and saved (${durMinutes} mins duration).`,
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      endingLockRef.current[slotNumber] = false;
    }
  };

  // Continuation handler for slot i (1 to 19)
  const handleContinuation = (slotNum: number, wantAnother: boolean) => {
    if (wantAnother && !isDayStarted) {
      setStatusMessage({
        type: 'error',
        text: 'Please click "Clock In / Start Day" first before creating another activity.',
      });
      return;
    }

    setContinuationAnswers((prev) => ({ ...prev, [slotNum]: wantAnother }));

    if (wantAnother) {
      setActivities((prev) => {
        const nextSlotNum = prev.length + 1;
        if (nextSlotNum > 20) return prev;
        const normalized = prev.map((s, i) => ({ ...s, slotNumber: i + 1 }));
        return [...normalized, defaultSlot(nextSlotNum)];
      });
    } else {
      // User selected 'No': trim subsequent unstarted slots beyond slotNum
      setActivities((prev) => {
        const trimmed = prev.slice(0, slotNum);
        return trimmed.map((s, i) => ({ ...s, slotNumber: i + 1 }));
      });
      // Scroll smoothly down to Daily Summary so user can see their totals and finalize
      setTimeout(() => {
        const summaryEl = document.getElementById('daily-summary-section');
        if (summaryEl) {
          summaryEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }
  };

  // Save Draft locally and remotely
  const handleSaveDraft = async () => {
    if (!user) return;
    if (!isDayStarted && !isRevisionMode && !hasRecordedActivity) {
      setStatusMessage({
        type: 'error',
        text: 'Please click "Clock In / Start Day" before creating any activity or saving a draft.',
      });
      return;
    }
    setSavingDraft(true);
    setStatusMessage(null);

    try {
      // 1. Save locally in Dexie
      await saveReportLocally({
        staffUid: user.uid,
        reportDate,
        activities,
        crpCode,
        blockTaluka,
        finalized: false,
        syncStatus: isOnline ? 'syncing' : 'saved_offline',
      });

      // 2. If online, sync to server
      if (isOnline) {
        const res = await fetch('/api/field-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportDate,
            crpCode,
            blockTaluka,
            activities,
            finalizeNow: false,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to save draft to server.');
        }
        setSyncStatus('synced');
      } else {
        setSyncStatus('saved_offline');
      }

      setStatusMessage({
        type: 'success',
        text: isOnline ? 'Draft saved and synchronized to cloud.' : 'Draft saved locally offline. Will sync when online.',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setSyncStatus('saved_offline');
    } finally {
      setSavingDraft(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Finalize Daily Report
  const handleFinalizeReport = async (gps: GpsCoordinate | null, locationStatus: LocationCaptureStatus) => {
    if (!user || finalizingLockRef.current) return;
    finalizingLockRef.current = true;
    setStatusMessage(null);

    try {
      // Validate calculations (strictly requiring completed activities)
      const { errors, validatedActivities } = calculateActivitiesSummary(activities, true);
      if (errors.length > 0) {
        setStatusMessage({ type: 'error', text: errors[0] });
        throw new Error(errors[0]);
      }

      // Save locally first
      await saveReportLocally({
        staffUid: user.uid,
        reportDate,
        activities: validatedActivities,
        crpCode,
        blockTaluka,
        finalized: true,
        finalizationGps: gps,
        finalizationLocationStatus: locationStatus,
        syncStatus: isOnline ? 'syncing' : 'pending_sync',
      });

      if (isOnline) {
        const res = await fetch('/api/field-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportDate,
            crpCode,
            blockTaluka,
            activities: validatedActivities,
            finalizeNow: true,
            finalizationGps: gps,
            finalizationLocationStatus: locationStatus,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to submit finalized report.');
        }

        const wasRevision =
          existingReport?.status === 'correction_requested' ||
          existingReport?.status === 'edit_requested';

        const nowIso = new Date().toISOString();
        setIsFinalized(true);
        setFinalizationGps(gps);
        setSyncStatus('synced');
        setExistingReport((prev) => {
          const nextStatus = wasRevision ? 'resubmitted' : 'submitted';
          if (prev) {
            return {
              ...prev,
              status: nextStatus,
              finalized: true,
              submittedAt: prev.submittedAt || nowIso,
              resubmittedAt: wasRevision ? nowIso : prev.resubmittedAt,
            };
          }
          if (data.report) {
            return {
              ...data.report,
              status: nextStatus,
              finalized: true,
              submittedAt: data.report.submittedAt || nowIso,
            };
          }
          return prev;
        });
        setStatusMessage({
          type: 'success',
          text: wasRevision
            ? 'Revised Field Activity Report resubmitted and finalized successfully!'
            : 'Field Activity Report finalized and submitted successfully!',
        });
      } else {
        setIsFinalized(true);
        setFinalizationGps(gps);
        setSyncStatus('pending_sync');
        setStatusMessage({
          type: 'success',
          text: 'Report finalized locally! It will automatically sync to the server once connection is restored.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      throw err;
    } finally {
      finalizingLockRef.current = false;
    }
  };

  // Download 1-page PDF
  const handleDownloadPDF = async () => {
    if (!user) return;
    const docId = existingReport?.id || `field_rep_${user.uid}_${reportDate}`;

    // Ensure current activities are saved locally & to server so PDF is up-to-date
    try {
      await saveReportLocally({
        staffUid: user.uid,
        reportDate,
        activities,
        crpCode,
        blockTaluka,
        finalized: isFinalized,
        syncStatus: isOnline ? 'syncing' : 'saved_offline',
      });

      if (isOnline) {
        await fetch('/api/field-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportDate,
            crpCode,
            blockTaluka,
            activities,
            finalizeNow: false,
          }),
        });
      }
    } catch (saveErr) {
      console.warn('Auto-save before PDF download:', saveErr);
    }

    const win = window.open(`/api/field-reports/${docId}/pdf`, '_blank');
    if (!win) {
      window.location.href = `/api/field-reports/${docId}/pdf`;
    }
  };

  // Compute live summary for display
  const { summary } = calculateActivitiesSummary(activities);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Title & Connection Status */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Field Activity Reporting
          </h1>
          <p className="text-xs text-muted-foreground font-medium">
            Sequential daily field and office activity logging with real GPS capture and offline synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isOnline ? (
            <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
              <Wifi className="h-3 w-3 mr-1 text-emerald-600" /> Online
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px]">
              <WifiOff className="h-3 w-3 mr-1" /> Offline Mode
            </Badge>
          )}

          {syncStatus === 'saved_offline' && (
            <Badge variant="warning" className="text-[10px]">
              Saved Locally
            </Badge>
          )}
          {syncStatus === 'pending_sync' && (
            <Badge variant="info" className="text-[10px]">
              Pending Sync
            </Badge>
          )}
          {syncStatus === 'synced' && (
            <Badge variant="default" className="text-[10px] bg-emerald-600 text-white font-bold">
              Synced
            </Badge>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${statusMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {existingReport && (existingReport.status === 'correction_requested' || existingReport.status === 'edit_requested') && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/90 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-sm flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              Supervisor Action Required: {existingReport.status === 'edit_requested' ? 'Edit Requested' : 'Correction Requested'}
            </span>
            {existingReport.reviewerName && (
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                By {existingReport.reviewerName}
              </span>
            )}
          </div>
          {(existingReport.editRequest?.reason || existingReport.reviewComments) && (
            <p className="font-medium leading-relaxed">
              &quot;{existingReport.editRequest?.reason || existingReport.reviewComments}&quot;
            </p>
          )}
          {existingReport.editRequest?.instructions && (
            <p className="p-2 rounded-lg bg-white/70 dark:bg-black/20 border border-amber-200 text-[11px]">
              <strong>Instructions:</strong> {existingReport.editRequest.instructions}
            </p>
          )}
          <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
            You can edit the activity details below, click &quot;Save Revision&quot; (or press Enter), and re-finalize your Daily Report when ready.
          </p>
        </div>
      )}

      {/* Attendance Clock-In Widget */}
      {user && (
        <AttendanceWidget
          user={user}
          onStatusChange={(sess) => {
            setAttendanceSession(sess);
            setAttendanceLoaded(true);
          }}
        />
      )}

      {/* Daily Header Information Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Daily Report Header
          </CardTitle>
          <CardDescription className="text-xs">
            Assigned employee and calendar reporting date details (Asia/Kolkata timezone)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-muted/30 rounded-xl border border-border">
              <span className="text-[11px] text-muted-foreground block">Employee Name</span>
              <span className="font-bold text-foreground text-xs block truncate">{user?.fullName || 'Loading...'}</span>
              <span className="text-[10px] text-muted-foreground block font-mono">{user?.employeeId}</span>
            </div>

            <div className="p-3 bg-muted/30 rounded-xl border border-border">
              <span className="text-[11px] text-muted-foreground block">Department</span>
              <span className="font-bold text-foreground text-xs block truncate">{user?.departmentName || 'Field Operations'}</span>
            </div>

            <div className="p-3 bg-muted/30 rounded-xl border border-border">
              <span className="text-[11px] text-muted-foreground block">Assigned Center</span>
              <span className="font-bold text-foreground text-xs block truncate">{user?.assignedCenterNames?.[0] || 'Nashik Center'}</span>
            </div>

            <div className="p-3 bg-muted/30 rounded-xl border border-border">
              <span className="text-[11px] text-muted-foreground block">Report Date (Fixed)</span>
              <span className="font-bold text-primary text-xs block">{formatReadableDate(reportDate)}</span>
              <span className="text-[10px] text-muted-foreground block">Finalized Calendar Date</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="font-bold text-xs text-foreground">CRP Code (Optional)</label>
              <Input
                value={crpCode}
                onChange={(e) => setCrpCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isFinalized) {
                    e.preventDefault();
                    void handleSaveDraft();
                  }
                }}
                placeholder="e.g. CRP-042"
                disabled={isFinalized}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-xs text-foreground">Block / Taluka (Optional)</label>
              <Input
                value={blockTaluka}
                onChange={(e) => setBlockTaluka(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isFinalized) {
                    e.preventDefault();
                    void handleSaveDraft();
                  }
                }}
                placeholder="e.g. Dindori / Niphad"
                disabled={isFinalized}
                className="text-xs h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sequential Activity Slots (Up to 20 Slots) */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-foreground">
            Activity Slots ({hasRecordedActivity ? activities.length : isDayStarted || isRevisionMode ? activities.length : 0} / 20 Recorded)
          </h2>
          <span className="text-xs text-muted-foreground font-medium">
            Sequential bounded slots
          </span>
        </div>

        {attendanceLoaded && !isDayStarted && !isFinalized && !isRevisionMode && !hasRecordedActivity ? (
          <div className="p-6 rounded-2xl border border-amber-300/80 bg-amber-50/70 dark:bg-amber-950/25 dark:border-amber-900/50 text-center space-y-2.5">
            <div className="mx-auto h-11 w-11 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-extrabold text-foreground">
              Start Day Required Before Creating Activities
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Your workday has not started yet. Please click{' '}
              <strong className="text-foreground">Clock In / Start Day</strong> in the Attendance &amp; Time Tracker above before creating or starting any field activity.
            </p>
          </div>
        ) : (
          activities.map((slot, idx) => {
          const slotNum = idx + 1;
          const isLastRecorded = idx === activities.length - 1;
          const continuationAnswer = continuationAnswers[slotNum];

          return (
            <div key={slotNum} className="space-y-3">
              <FieldActivitySlotCard
                slot={slot}
                index={idx}
                totalSlots={activities.length}
                onChange={handleUpdateActivity}
                onStartActivity={handleStartActivity}
                onEndActivity={handleEndActivity}
                onSaveDraft={handleSaveActivityDraft}
                isSavingDraft={savingSlotDraft[slot.slotNumber] || false}
                allowEditCompleted={isRevisionMode}
                hasActiveActivityElsewhere={activities.some(
                  (a) => a.slotNumber !== slot.slotNumber && isActivityInProgress(a)
                )}
                dayStarted={isDayStarted}
                onRemove={
                  idx > 0 && !isFinalized && normalizeActivityStatus(slot) === 'NOT_STARTED'
                    ? () => {
                      setActivities((prev) => prev.filter((_, i) => i !== idx));
                    }
                    : undefined
                }
                isReadOnly={isFinalized}
              />

              {/* Continuation Prompt after slots 1..19 (only when current slot is completed) */}
              {!isFinalized &&
                slotNum < 20 &&
                isLastRecorded &&
                isActivityCompleted(slot) && (
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50/70 via-card to-card dark:from-emerald-950/20 dark:via-card dark:to-card rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          Do you want to record another activity?
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          You finished Activity #{slotNum}. Select <strong className="text-foreground">Yes</strong> to start Activity #{slotNum + 1}, or <strong className="text-foreground">No</strong> to proceed to Daily Summary.
                        </p>
                        {!isDayStarted && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold mt-1.5">
                            Day session is closed. Clock In / Start Day must be active to add another activity.
                          </p>
                        )}
                        {continuationAnswer === false && (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5 mt-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            All activities recorded! Scroll down to review your Daily Summary and finalize your report.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                      <Button
                        type="button"
                        variant={continuationAnswer === false ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleContinuation(slotNum, false)}
                        className={`text-xs font-bold px-4 h-9 rounded-xl transition-all shadow-xs ${
                          continuationAnswer === false
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                            : 'bg-card border-border hover:bg-muted text-foreground'
                        }`}
                      >
                        <ArrowDown className="h-3.5 w-3.5 mr-1" />
                        No, Proceed to Finalize
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!isDayStarted}
                        onClick={() => handleContinuation(slotNum, true)}
                        className="text-xs font-bold px-4 h-9 rounded-xl bg-[#228B4E] hover:bg-[#1a703e] text-white shadow-xs transition-all active:scale-[0.98]"
                      >
                        <PlusCircle className="h-3.5 w-3.5 mr-1" />
                        Yes, Add Slot {slotNum + 1}
                      </Button>
                    </div>
                  </div>
                )}

              {/* Notice when slot 20 is reached */}
              {slotNum === 20 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Maximum limit of 20 daily activities reached. Proceeding to Daily Summary.</span>
                </div>
              )}
            </div>
          );
        })
        )}
      </div>

      {/* Save Draft Action Bar */}
      {!isFinalized && (isDayStarted || isRevisionMode || hasRecordedActivity) && (
        <div className="flex items-center justify-between gap-3 p-3 bg-card rounded-xl border border-border">
          <p className="text-xs text-muted-foreground">
            Save draft regularly to prevent losing unsynced work.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="text-xs font-bold h-9 rounded-xl"
          >
            <Save className="h-4 w-4 mr-1.5" />
            {savingDraft ? 'Saving Draft...' : 'Save Draft Locally & Cloud'}
          </Button>
        </div>
      )}

      {/* Daily Summary & Finalization Card */}
      <FieldDailySummaryCard
        summary={summary}
        isFinalized={isFinalized}
        finalizationGps={finalizationGps}
        onFinalize={handleFinalizeReport}
        onDownloadPDF={handleDownloadPDF}
        isReadOnly={isFinalized}
        reportStatus={existingReport?.status}
        submittedAt={existingReport?.resubmittedAt || existingReport?.submittedAt || null}
        syncStatus={syncStatus}
      />
    </div>
  );
}

export default function StaffFieldActivityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">Loading Field Activity Form...</div>}>
      <FieldActivityReportingContent />
    </Suspense>
  );
}
