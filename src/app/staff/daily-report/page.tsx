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
  FieldReport,
  FieldActivitySlot,
  FieldReportDailySummary,
  UserProfile,
  GpsCoordinate,
  LocationCaptureStatus,
} from '@/types';
import { getOperationalDateString, formatReadableDate } from '@/lib/utils/date-utils';
import { calculateActivitiesSummary } from '@/lib/utils/field-activity-calculations';
import { captureCurrentGps } from '@/lib/utils/geolocation';
import {
  saveReportLocally,
  loadLocalReport,
  syncPendingReportsToServer,
  saveActivityLocally,
  loadLocalActivities,
  syncPendingActivitiesToServer,
} from '@/lib/offline/sync-service';

function defaultSlot(slotNumber: number): FieldActivitySlot {
  return {
    slotNumber,
    activityStatus: 'not_started',
    activityStart: '',
    activityStartAt: '',
    activityStartLocation: null,
    activityStartGps: null,
    activityName: 'farmer_visit',
    activityNameLabel: 'Farmer Visit',
    activityType: 'single_farmer',
    farmerName: '',
    village: '',
    totalParticipants: 1,
    maleParticipants: 0,
    femaleParticipants: 0,
    observations: '',
    supportProvided: [],
    followUpRequired: false,
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

  const [activities, setActivities] = useState<FieldActivitySlot[]>([defaultSlot(1)]);
  const [continuationAnswers, setContinuationAnswers] = useState<Record<number, boolean>>({});

  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizationGps, setFinalizationGps] = useState<GpsCoordinate | null>(null);
  const [existingReport, setExistingReport] = useState<FieldReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending_sync' | 'saved_offline' | 'draft'>('draft');
  const [isOnline, setIsOnline] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [savingSlotDraft, setSavingSlotDraft] = useState<Record<number, boolean>>({});
  const autoSaveTimeoutRef = React.useRef<Record<number, NodeJS.Timeout>>({});

  // Monitor network connectivity & auto-sync pending activities & reports
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      Promise.all([
        syncPendingActivitiesToServer(),
        syncPendingReportsToServer(),
      ]).then(([actRes, repRes]) => {
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
  }, []);

  // Initial load: restore active & completed activities from Firestore and local Dexie
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        // 1. Session user
        const sessRes = await fetch('/api/auth/session');
        const sessData = await sessRes.json();
        if (sessData.authenticated && sessData.user) {
          setUser(sessData.user);
          const staffUid = sessData.user.uid;

          // 2. Check local Dexie offline draft and local activities first
          const [localDraft, localActivities] = await Promise.all([
            loadLocalReport(staffUid, reportDate),
            loadLocalActivities(staffUid, reportDate),
          ]);

          let initialSlots: FieldActivitySlot[] = [];

          if (localActivities && localActivities.length > 0) {
            initialSlots = localActivities.map((la) => ({
              ...defaultSlot(la.slotNumber),
              ...la.activityData,
              activityId: la.activityId,
              id: la.activityId,
              slotNumber: la.slotNumber,
              activityStatus: la.activityStatus,
              syncStatus: la.syncStatus as any,
            }));
          } else if (localDraft && localDraft.activities?.length > 0) {
            initialSlots = localDraft.activities;
          }

          if (localDraft) {
            setIsFinalized(Boolean(localDraft.finalized));
            setFinalizationGps(localDraft.finalizationGps || null);
            setCrpCode(localDraft.crpCode || '');
            setBlockTaluka(localDraft.blockTaluka || '');
            setSyncStatus(localDraft.syncStatus as any);
          }

          // 3. Check remote server activities and report
          if (navigator.onLine) {
            try {
              const [actRes, repRes] = await Promise.all([
                fetch(`/api/field-activities?date=${reportDate}`),
                fetch(reportIdParam ? `/api/field-reports/${reportIdParam}` : `/api/field-reports/check?date=${reportDate}`),
              ]);

              const actData = await actRes.json().catch(() => ({}));
              const repData = await repRes.json().catch(() => ({}));

              if (repRes.ok && repData.success && repData.report) {
                const rep: FieldReport = repData.report;
                setExistingReport(rep);
                setReportDate(rep.reportDate);
                setCrpCode(rep.crpCode || '');
                setBlockTaluka(rep.blockTaluka || '');
                setIsFinalized(Boolean(rep.finalized || rep.status === 'submitted' || rep.status === 'approved'));
                setFinalizationGps(rep.finalizationGps || null);
                setSyncStatus('synced');
              }

              if (actRes.ok && actData.success && Array.isArray(actData.activities) && actData.activities.length > 0) {
                // Map remote activities to slot list
                const remoteSlots: FieldActivitySlot[] = actData.activities.map((rec: any) => ({
                  ...defaultSlot(rec.slotNumber),
                  activityId: rec.activityId || rec.id,
                  id: rec.activityId || rec.id,
                  slotNumber: rec.slotNumber,
                  activityStatus: rec.activityStatus,
                  activityName: rec.activityName || 'farmer_visit',
                  activityNameLabel: rec.activityNameLabel || '',
                  activityOther: rec.activityOther || '',
                  village: rec.village || '',
                  wadi: rec.wadi || '',
                  activityType: rec.participantType || 'single_farmer',
                  farmerName: rec.farmerName || '',
                  totalParticipants: rec.totalParticipants ?? 0,
                  maleParticipants: rec.maleParticipants ?? 0,
                  femaleParticipants: rec.femaleParticipants ?? 0,
                  observations: rec.observations || '',
                  farmerIssues: rec.farmerIssues || '',
                  supportProvided: rec.supportProvided || [],
                  followUpRequired: Boolean(rec.followUpRequired),
                  followUpDetails: rec.followUpDetails || '',
                  followUpDate: rec.followUpDate || '',
                  photoUrl: rec.photoUrl || (rec.photoEvidence?.[0] || ''),
                  videoUrl: rec.videoUrl || (rec.videoEvidence?.[0] || ''),
                  photoEvidence: rec.photoEvidence || [],
                  videoEvidence: rec.videoEvidence || [],
                  activityStartAt: rec.activityStartAt || '',
                  activityStart: rec.activityStartAt || '',
                  activityStartLocation: rec.activityStartLocation || null,
                  activityStartGps: rec.activityStartLocation || null,
                  activityStartLocationStatus: rec.activityStartLocationStatus || 'captured',
                  activityEndAt: rec.activityEndAt || '',
                  activityEnd: rec.activityEndAt || '',
                  activityEndLocation: rec.activityEndLocation || null,
                  activityEndGps: rec.activityEndLocation || null,
                  activityEndLocationStatus: rec.activityEndLocationStatus || (rec.activityEndAt ? 'captured' : null),
                  durationMinutes: rec.activityDurationMinutes ?? rec.durationMinutes ?? 0,
                  activityDurationMinutes: rec.activityDurationMinutes ?? rec.durationMinutes ?? 0,
                  syncStatus: 'synced',
                }));

                initialSlots = remoteSlots.sort((a, b) => a.slotNumber - b.slotNumber);
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
    setActivities((prev) => prev.map((a) => (a.slotNumber === updated.slotNumber ? updated : a)));

    if (!user) return;

    // 1. Save locally in Dexie immediately
    if (updated.activityId) {
      saveActivityLocally({
        activityId: updated.activityId,
        staffUid: user.uid,
        employeeId: user.employeeId || '',
        employeeName: user.fullName || '',
        reportDate,
        slotNumber: updated.slotNumber,
        activityStatus: updated.activityStatus as any,
        activityData: updated,
        syncStatus: 'saved_offline',
      }).catch(console.warn);
    }

    // 2. Debounced autosave to Firestore if in progress
    const isInProg = updated.activityStatus === 'IN_PROGRESS' || updated.activityStatus === 'in_progress';
    if (isInProg && updated.activityId && navigator.onLine) {
      if (autoSaveTimeoutRef.current[updated.slotNumber]) {
        clearTimeout(autoSaveTimeoutRef.current[updated.slotNumber]);
      }

      autoSaveTimeoutRef.current[updated.slotNumber] = setTimeout(async () => {
        try {
          await fetch('/api/field-activities/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              activityId: updated.activityId,
              updates: updated,
            }),
          });
          if (user) {
            saveActivityLocally({
              activityId: updated.activityId!,
              staffUid: user.uid,
              employeeId: user.employeeId || '',
              employeeName: user.fullName || '',
              reportDate,
              slotNumber: updated.slotNumber,
              activityStatus: 'IN_PROGRESS',
              activityData: updated,
              syncStatus: 'synced',
            }).catch(console.warn);
          }
        } catch (err) {
          console.warn(`Autosave failed for activity #${updated.slotNumber}:`, err);
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
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to save activity draft.');
        }
      }

      await saveActivityLocally({
        activityId: slot.activityId || `draft_act_${user.uid}_${reportDate}_s${slotNumber}`,
        staffUid: user.uid,
        employeeId: user.employeeId || '',
        employeeName: user.fullName || '',
        reportDate,
        slotNumber,
        activityStatus: (slot.activityStatus as any) || 'IN_PROGRESS',
        activityData: slot,
        syncStatus: navigator.onLine && slot.activityId ? 'synced' : 'saved_offline',
      });

      setStatusMessage({
        type: 'success',
        text: `Activity #${slotNumber} draft saved successfully.`,
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setSavingSlotDraft((prev) => ({ ...prev, [slotNumber]: false }));
    }
  };

  // Start an activity: creates a Firestore document immediately in erp_field_activities with IN_PROGRESS
  const handleStartActivity = async (slotNumber: number) => {
    if (!user) throw new Error('You must be logged in to start an activity.');
    if (isFinalized) throw new Error('This report has already been finalized.');

    // Prevent multiple simultaneously active activities
    const activeElsewhere = activities.find(
      (a) =>
        a.slotNumber !== slotNumber &&
        (a.activityStatus === 'IN_PROGRESS' || a.activityStatus === 'in_progress')
    );
    if (activeElsewhere) {
      throw new Error(
        `Activity #${activeElsewhere.slotNumber} (${activeElsewhere.activityNameLabel || activeElsewhere.activityName}) is already IN PROGRESS. Please complete it before starting Activity #${slotNumber}.`
      );
    }

    // Capture real GPS coordinates with reverse geocoded place name
    const res = await captureCurrentGps();
    const nowIso = new Date().toISOString();

    const targetSlot = activities.find((s) => s.slotNumber === slotNumber) || defaultSlot(slotNumber);
    let assignedActivityId = targetSlot.activityId || `act_${user.uid}_${reportDate}_s${slotNumber}_${Date.now()}`;
    let isServerSaved = false;

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
        isServerSaved = true;
      } catch (apiErr: any) {
        if (
          apiErr.message.includes('already IN PROGRESS') ||
          apiErr.message.includes('already been completed')
        ) {
          throw apiErr;
        }
        console.warn('Online activity start deferred to offline:', apiErr.message);
      }
    }

    const updatedSlot: FieldActivitySlot = {
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
      durationMinutes: 0,
      activityDurationMinutes: 0,
      syncStatus: isServerSaved ? 'synced' : 'saved_offline',
    };

    const updatedActivities = activities.map((s) => (s.slotNumber === slotNumber ? updatedSlot : s));
    setActivities(updatedActivities);

    // Save locally in Dexie immediately
    await saveActivityLocally({
      activityId: assignedActivityId,
      staffUid: user.uid,
      employeeId: user.employeeId || '',
      employeeName: user.fullName || '',
      reportDate,
      slotNumber,
      activityStatus: 'IN_PROGRESS',
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

    setStatusMessage({
      type: 'success',
      text: isServerSaved
        ? `Activity #${slotNumber} started and saved in Firestore immediately!`
        : `Activity #${slotNumber} started locally offline. Will sync when online.`,
    });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // End an activity: validates details, captures fresh GPS, updates the SAME document to COMPLETED
  const handleEndActivity = async (slotNumber: number) => {
    if (!user) throw new Error('You must be logged in.');
    if (isFinalized) throw new Error('This report has already been finalized.');

    const currentSlot = activities.find((s) => s.slotNumber === slotNumber);
    if (!currentSlot) throw new Error('Activity slot not found.');

    // Clear any pending autosave timer for this slot
    if (autoSaveTimeoutRef.current[slotNumber]) {
      clearTimeout(autoSaveTimeoutRef.current[slotNumber]);
    }

    // Capture fresh GPS coordinates with reverse geocoded place name
    const res = await captureCurrentGps();
    const nowIso = new Date().toISOString();

    const startMs = new Date(currentSlot.activityStartAt || currentSlot.activityStart || nowIso).getTime();
    const endMs = new Date(nowIso).getTime();
    const durMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

    let isServerSaved = false;

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
          },
        }),
      });

      const endData = await endRes.json();
      if (!endRes.ok || !endData.success) {
        throw new Error(endData.error || 'Failed to complete activity in database.');
      }
      isServerSaved = true;
    }

    const updatedSlot: FieldActivitySlot = {
      ...currentSlot,
      activityStatus: 'COMPLETED',
      activityEndAt: nowIso,
      activityEnd: nowIso,
      activityEndLocation: res.coords,
      activityEndGps: res.coords,
      activityEndLocationStatus: res.status,
      durationMinutes: durMinutes,
      activityDurationMinutes: durMinutes,
      syncStatus: isServerSaved ? 'synced' : 'saved_offline',
    };

    const updatedActivities = activities.map((s) => (s.slotNumber === slotNumber ? updatedSlot : s));
    setActivities(updatedActivities);

    if (currentSlot.activityId) {
      await saveActivityLocally({
        activityId: currentSlot.activityId,
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

    setStatusMessage({
      type: 'success',
      text: `Activity #${slotNumber} completed and saved (${durMinutes} mins duration).`,
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Continuation handler for slot i (1 to 19)
  const handleContinuation = (slotNum: number, wantAnother: boolean) => {
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
    if (!user) return;
    setStatusMessage(null);

    // Validate calculations (strictly requiring completed activities)
    const { errors, validatedActivities } = calculateActivitiesSummary(activities, true);
    if (errors.length > 0) {
      setStatusMessage({ type: 'error', text: errors[0] });
      throw new Error(errors[0]);
    }

    try {
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

        setIsFinalized(true);
        setFinalizationGps(gps);
        setSyncStatus('synced');
        setStatusMessage({
          type: 'success',
          text: 'Field Activity Report finalized and submitted successfully!',
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

      {/* Attendance Clock-In Widget */}
      {user && <AttendanceWidget user={user} />}

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
            Activity Slots ({activities.length} / 20 Recorded)
          </h2>
          <span className="text-xs text-muted-foreground font-medium">
            Sequential bounded slots
          </span>
        </div>

        {activities.map((slot, idx) => {
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
                hasActiveActivityElsewhere={activities.some(
                  (a) =>
                    a.slotNumber !== slot.slotNumber &&
                    (a.activityStatus === 'IN_PROGRESS' || a.activityStatus === 'in_progress')
                )}
                onRemove={
                  idx > 0 && !isFinalized && slot.activityStatus === 'not_started'
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
                (slot.activityStatus === 'completed' || slot.activityStatus === 'COMPLETED') && (
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
        })}
      </div>

      {/* Save Draft Action Bar */}
      {!isFinalized && (
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
