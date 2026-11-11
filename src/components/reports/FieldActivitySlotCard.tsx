'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Clock,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Video as VideoIcon,
  Trash2,
  ChevronDown,
  ChevronUp,
  Activity,
  Sparkles,
  Lock,
  Cloud,
  Save,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  FieldActivitySlot,
  ACTIVITY_CHOICES,
  SUPPORT_PROVIDED_OPTIONS,
  DESK_JOB_SUGGESTIONS,
} from '@/types/field-activity';
import { LocationDisplayCard } from '@/components/reports/LocationDisplayCard';
import { formatCapturedTime } from '@/lib/utils/geolocation';
import {
  isSingleFarmerActivity,
  mergeEvidenceUrls,
  normalizeActivityStatus,
} from '@/lib/utils/field-activity-calculations';

interface FieldActivitySlotCardProps {
  slot: FieldActivitySlot;
  index: number;
  totalSlots: number;
  onChange: (updated: FieldActivitySlot) => void;
  onStartActivity: (slotNumber: number) => Promise<void>;
  onEndActivity: (slotNumber: number) => Promise<void>;
  onSaveDraft?: (slotNumber: number) => Promise<void>;
  isSavingDraft?: boolean;
  onRemove?: () => void;
  isReadOnly?: boolean;
  allowEditCompleted?: boolean;
  hasActiveActivityElsewhere?: boolean;
}

export function FieldActivitySlotCard({
  slot,
  index,
  totalSlots,
  onChange,
  onStartActivity,
  onEndActivity,
  onSaveDraft,
  isSavingDraft = false,
  onRemove,
  isReadOnly = false,
  allowEditCompleted = false,
  hasActiveActivityElsewhere = false,
}: FieldActivitySlotCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const startingRef = useRef(false);
  const endingRef = useRef(false);
  const savingRef = useRef(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const canonicalStatus = normalizeActivityStatus(slot);
  const status: 'not_started' | 'in_progress' | 'completed' | 'cancelled' =
    canonicalStatus === 'COMPLETED'
      ? 'completed'
      : canonicalStatus === 'IN_PROGRESS'
      ? 'in_progress'
      : canonicalStatus === 'CANCELLED'
      ? 'cancelled'
      : 'not_started';

  const isFieldLocked = isReadOnly || status === 'cancelled' || (status === 'completed' && !allowEditCompleted);
  const isDeskJob =
    slot.activityName === 'desk_job' ||
    (typeof slot.activityName === 'string' && slot.activityName.toLowerCase().includes('desk'));
  const isOther = slot.activityName === 'other';
  const isSingleFarmer = isSingleFarmerActivity(slot.activityType || slot.participantType);

  // Live timer for in-progress activities
  useEffect(() => {
    if (status !== 'in_progress') return;

    const calcElapsed = () => {
      const startMs = new Date(slot.activityStartAt || slot.activityStart || 0).getTime();
      if (!isNaN(startMs) && startMs > 0) {
        setElapsedMinutes(Math.max(0, Math.round((Date.now() - startMs) / 60000)));
      }
    };

    calcElapsed();
    const timer = setInterval(calcElapsed, 10000); // update every 10s
    return () => clearInterval(timer);
  }, [status, slot.activityStartAt, slot.activityStart]);

  // Support multiselect toggle
  const toggleSupport = (key: string) => {
    if (isFieldLocked) return;
    const cur = slot.supportProvided || [];
    let updated: string[];
    if (key === 'none') {
      updated = ['none'];
    } else {
      const withoutNone = cur.filter((k) => k !== 'none');
      if (withoutNone.includes(key)) {
        updated = withoutNone.filter((k) => k !== key);
      } else {
        updated = [...withoutNone, key];
      }
    }
    onChange({
      ...slot,
      supportProvided: updated,
      supportOther: updated.includes('other') ? slot.supportOther : '',
    });
  };

  // Participant validation
  const male = Number(slot.maleParticipants) || 0;
  const female = Number(slot.femaleParticipants) || 0;
  const total = Number(slot.totalParticipants) || 0;
  const participantMismatch = !isDeskJob && !isSingleFarmer && total > 0 && male + female !== total;

  const validateSlotRequiredFields = (): string | null => {
    if (isOther && (!slot.activityOther || !slot.activityOther.trim())) {
      return 'Please specify the "Other Activity" description before saving/completing.';
    }
    if (!isDeskJob) {
      if (!slot.village || !slot.village.trim()) {
        return 'Please specify Village / Location before completing this field activity.';
      }
      if (!slot.observations || !slot.observations.trim()) {
        return 'Please enter Key Observations / Summary before completing this activity.';
      }
      if (isSingleFarmer && (!slot.farmerName || !slot.farmerName.trim())) {
        return 'Farmer Name is required for single farmer visits.';
      }
      if (!isSingleFarmer) {
        if (total < 1) {
          return 'Total participants must be 1 or greater for group activities.';
        }
        if (participantMismatch) {
          return `Participant counts must add up: Male (${male}) + Female (${female}) must equal Total (${total}).`;
        }
      }
    }
    if (slot.supportProvided?.includes('other') && (!slot.supportOther || !slot.supportOther.trim())) {
      return 'Please specify Other Support Details when "Other" is selected.';
    }
    if (slot.followUpRequired && (!slot.followUpDetails || !slot.followUpDetails.trim())) {
      return 'Follow-up Action Details are required when Follow-up is marked Yes.';
    }
    return null;
  };

  // Handle Start
  const handleStart = async () => {
    if (startingRef.current || starting || hasActiveActivityElsewhere || isFieldLocked) return;
    setActionError(null);
    setActionSuccess(null);
    if (isOther && (!slot.activityOther || !slot.activityOther.trim())) {
      setActionError('Please specify the "Other Activity" description before starting.');
      return;
    }
    startingRef.current = true;
    setStarting(true);
    try {
      await onStartActivity(slot.slotNumber);
      setActionSuccess(`Activity #${slot.slotNumber} started successfully.`);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: any) {
      setActionError(err.message || 'Failed to start activity.');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  // Handle Manual Save (for In Progress draft or Reopened Completed correction)
  const handleManualSave = async () => {
    if (!onSaveDraft || savingRef.current || manualSaving || ending || isFieldLocked) return;
    setActionError(null);
    setActionSuccess(null);

    if (status === 'completed') {
      const validationErr = validateSlotRequiredFields();
      if (validationErr) {
        setActionError(validationErr);
        return;
      }
    }

    savingRef.current = true;
    setManualSaving(true);
    try {
      await onSaveDraft(slot.slotNumber);
      setActionSuccess(`Activity #${slot.slotNumber} saved successfully.`);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save activity.');
    } finally {
      savingRef.current = false;
      setManualSaving(false);
    }
  };

  // Handle End
  const handleEnd = async () => {
    if (endingRef.current || ending || isFieldLocked) return;
    setActionError(null);
    setActionSuccess(null);

    const validationErr = validateSlotRequiredFields();
    if (validationErr) {
      setActionError(validationErr);
      return;
    }

    endingRef.current = true;
    setEnding(true);
    try {
      await onEndActivity(slot.slotNumber);
      setActionSuccess(`Activity #${slot.slotNumber} completed and saved.`);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: any) {
      setActionError(err.message || 'Failed to end activity.');
    } finally {
      endingRef.current = false;
      setEnding(false);
    }
  };

  // Handle evidence upload to /api/uploads
  const handleEvidenceUpload = async (kind: 'photo' | 'video', file?: File | null) => {
    if (!file || isFieldLocked) return;
    setActionError(null);
    setActionSuccess(null);
    if (kind === 'photo') setUploadingPhoto(true);
    else setUploadingVideo(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('reportId', slot.activityId || `slot_${slot.slotNumber}_${Date.now()}`);
      formData.append('caption', `Activity #${slot.slotNumber} ${kind}`);

      const res = await fetch('/api/uploads', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to upload ${kind}`);
      }
      const url = data.attachment?.downloadUrl || `/api/uploads/view?path=${encodeURIComponent(data.attachment?.storagePath || '')}`;
      if (kind === 'photo') {
        const merged = mergeEvidenceUrls(url, slot.photoEvidence);
        onChange({ ...slot, photoUrl: url, photoEvidence: merged });
      } else {
        const merged = mergeEvidenceUrls(url, slot.videoEvidence);
        onChange({ ...slot, videoUrl: url, videoEvidence: merged });
      }
      setActionSuccess(`${kind === 'photo' ? 'Photo' : 'Video'} uploaded and attached.`);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: any) {
      setActionError(err.message || `Failed to upload ${kind}.`);
    } finally {
      if (kind === 'photo') setUploadingPhoto(false);
      else setUploadingVideo(false);
    }
  };

  // Enter key submission handler:
  // - Regular Enter inside <textarea> keeps normal newline behavior.
  // - Ctrl+Enter / Cmd+Enter inside <textarea>, or Enter inside <input>, triggers the validated save/start/end action.
  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || isFieldLocked) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const tagName = target.tagName.toUpperCase();
    if (tagName === 'TEXTAREA') {
      if (!(e.ctrlKey || e.metaKey)) return;
    } else if (tagName === 'INPUT') {
      const inputType = (target as HTMLInputElement).type;
      if (['file', 'button', 'submit', 'checkbox', 'radio'].includes(inputType)) return;
    } else {
      return;
    }

    e.preventDefault();
    if (status === 'not_started') {
      void handleStart();
    } else if (status === 'in_progress') {
      void handleEnd();
    } else if (status === 'completed' && allowEditCompleted) {
      void handleManualSave();
    }
  };

  const startLoc = slot.activityStartLocation || slot.activityStartGps;
  const endLoc = slot.activityEndLocation || slot.activityEndGps;

  return (
    <div
      onKeyDown={handleCardKeyDown}
      className={`border rounded-2xl bg-card shadow-2xs overflow-hidden transition-all ${
        status === 'in_progress'
          ? 'border-emerald-500 ring-2 ring-emerald-500/20'
          : status === 'completed'
          ? 'border-emerald-900/20 dark:border-emerald-500/20'
          : 'border-border'
      }`}
    >
      {/* Header Bar */}
      <div
        className={`p-4 border-b flex items-center justify-between gap-3 ${
          status === 'in_progress'
            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500/30'
            : status === 'completed'
            ? 'bg-muted/30 border-border'
            : 'bg-muted/40 border-border'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`h-7 w-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
              status === 'in_progress'
                ? 'bg-emerald-600 text-white animate-pulse'
                : status === 'completed'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-700 text-white'
            }`}
          >
            {slot.slotNumber}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-foreground">
                Activity #{slot.slotNumber}: {slot.activityNameLabel || slot.activityName?.replace(/_/g, ' ') || 'Select Activity'}
              </h4>

              {status === 'in_progress' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
                  IN PROGRESS
                </span>
              )}

              {status === 'completed' && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 font-bold">
                  COMPLETED
                </Badge>
              )}

              {status === 'not_started' && (
                <Badge variant="secondary" className="text-[10px]">
                  NOT STARTED
                </Badge>
              )}

              {status === 'cancelled' && (
                <Badge variant="secondary" className="text-[10px]">
                  CANCELLED
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              <span>{isDeskJob ? 'Office / Desk Work' : (slot.village || 'Village not set')}</span>
              {status === 'in_progress' && (
                <>
                  <span>•</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    Active for {elapsedMinutes} mins
                  </span>
                </>
              )}
              {status === 'completed' && (
                <>
                  <span>•</span>
                  <span className="font-bold text-primary">
                    {slot.durationMinutes || slot.activityDurationMinutes || 0} mins duration
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isDeskJob && (
            <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-800">
              Desk Work
            </Badge>
          )}

          {onRemove && !isReadOnly && index > 0 && status === 'not_started' && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRemove}
              className="text-rose-600 hover:bg-rose-50 h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 p-0 text-muted-foreground"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Action Error & Success Banners */}
      {actionError && (
        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActionError(null)}
            className="text-rose-700 text-xs h-6 px-1.5"
          >
            Dismiss
          </Button>
        </div>
      )}
      {actionSuccess && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 text-xs h-6 px-1.5"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Body */}
      {!collapsed && (
        <div className="p-4 space-y-4 text-xs">
          {/* STATE 1: NOT STARTED */}
          {status === 'not_started' && !isReadOnly && (
            <div className="p-4 rounded-xl border border-dashed border-emerald-600/30 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h5 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    Ready to Begin Activity #{slot.slotNumber}
                  </h5>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Configure the activity type below and click <strong>Start Activity</strong> (or press <strong>Enter</strong>). Start time and GPS location will be captured automatically.
                  </p>
                </div>

                <Button
                  type="button"
                  size="default"
                  onClick={handleStart}
                  disabled={starting || hasActiveActivityElsewhere}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-5 rounded-xl shadow-xs shrink-0"
                >
                  <Play className={`h-4 w-4 mr-2 ${starting ? 'animate-spin' : ''}`} />
                  {starting ? 'Capturing Location & Starting...' : 'Start Activity'}
                </Button>
              </div>

              {hasActiveActivityElsewhere && (
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200">
                  Another activity is currently IN PROGRESS. Please complete it by clicking &quot;End Activity&quot; before starting Activity #{slot.slotNumber}.
                </p>
              )}
            </div>
          )}

          {/* STATE 2: IN PROGRESS - Prominent Active Banner & End Activity Action */}
          {status === 'in_progress' && (
            <div className="p-4 rounded-xl border border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
                    </span>
                    <span className="font-black text-sm text-emerald-900 dark:text-emerald-300">
                      Activity #{slot.slotNumber} is currently IN PROGRESS
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Started at <strong>{formatCapturedTime(slot.activityStartAt || slot.activityStart)}</strong> (Elapsed: <strong>{elapsedMinutes} mins</strong>). Press <strong>Enter</strong> in any field (or <strong>Ctrl+Enter</strong> in notes) when all required fields are ready, or click End Activity.
                  </p>
                </div>

                {!isReadOnly && (
                  <div className="flex items-center gap-2 shrink-0">
                    {onSaveDraft && (
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        onClick={handleManualSave}
                        disabled={manualSaving || isSavingDraft || ending}
                        className="border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50 h-10 px-4 rounded-xl text-xs font-bold"
                      >
                        <Save className={`h-4 w-4 mr-1.5 ${manualSaving || isSavingDraft ? 'animate-spin' : ''}`} />
                        {manualSaving || isSavingDraft ? 'Saving...' : 'Save Draft'}
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="default"
                      onClick={handleEnd}
                      disabled={ending}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-black h-10 px-5 rounded-xl shadow-sm shrink-0"
                    >
                      <Square className={`h-4 w-4 mr-2 fill-white ${ending ? 'animate-spin' : ''}`} />
                      {ending ? 'Capturing End GPS & Completing...' : 'End Activity'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Start Location Card */}
              <LocationDisplayCard
                location={startLoc}
                label="Start Location (Captured on Start)"
                status={slot.activityStartLocationStatus}
              />
            </div>
          )}

          {/* STATE 3: COMPLETED - Start / End Timeline & Locations */}
          {status === 'completed' && (
            <div className="space-y-3 p-3.5 bg-muted/20 rounded-xl border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Activity Timeline & Locations
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                    Total Duration: {slot.durationMinutes || slot.activityDurationMinutes || 0} minutes
                  </span>
                  {allowEditCompleted && !isReadOnly && onSaveDraft && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleManualSave}
                      disabled={manualSaving || isSavingDraft}
                      className="h-7 text-[11px] font-bold border-amber-300 text-amber-800 hover:bg-amber-50 rounded-lg"
                    >
                      <Save className={`h-3 w-3 mr-1 ${manualSaving || isSavingDraft ? 'animate-spin' : ''}`} />
                      {manualSaving || isSavingDraft ? 'Saving...' : 'Save Revision'}
                    </Button>
                  )}
                </div>
              </div>

              {allowEditCompleted && !isReadOnly && (
                <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 rounded-lg text-[11px] text-amber-900 dark:text-amber-300 font-medium">
                  Correction / Edit Mode enabled: You can edit activity details below while verified GPS timestamps remain preserved.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <LocationDisplayCard
                    location={startLoc}
                    label={`Start: ${formatCapturedTime(slot.activityStartAt || slot.activityStart)}`}
                    status={slot.activityStartLocationStatus}
                  />
                </div>
                <div>
                  <LocationDisplayCard
                    location={endLoc}
                    label={`End: ${formatCapturedTime(slot.activityEndAt || slot.activityEnd)}`}
                    status={slot.activityEndLocationStatus}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Activity Choice & Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-foreground block mb-1">
                Activity Name / Choice <span className="text-rose-500">*</span>
              </label>
              <Select
                value={slot.activityName}
                onChange={(e) => {
                  const sel = ACTIVITY_CHOICES.find((c) => c.key === e.target.value);
                  onChange({
                    ...slot,
                    activityName: e.target.value as any,
                    activityNameLabel: sel?.label,
                  });
                }}
                disabled={isFieldLocked}
                className="text-xs h-9"
              >
                {ACTIVITY_CHOICES.map((choice) => (
                  <option key={choice.key} value={choice.key}>
                    {choice.label}
                  </option>
                ))}
              </Select>
            </div>

            {isOther && (
              <div>
                <label className="font-bold text-foreground block mb-1">
                  Specify Other Activity <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={slot.activityOther || ''}
                  onChange={(e) => onChange({ ...slot, activityOther: e.target.value })}
                  placeholder="Detail other activity..."
                  disabled={isFieldLocked}
                  className="text-xs h-9"
                />
              </div>
            )}

            {!isDeskJob && (
              <>
                <div>
                  <label className="font-bold text-foreground block mb-1">
                    Village / Location <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={slot.village || ''}
                    onChange={(e) => onChange({ ...slot, village: e.target.value })}
                    placeholder="Enter village name..."
                    disabled={isFieldLocked}
                    className="text-xs h-9"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">
                    Wadi / Hamlet Name <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Input
                    value={slot.wadi || ''}
                    onChange={(e) => onChange({ ...slot, wadi: e.target.value })}
                    placeholder="Specific site or wadi..."
                    disabled={isFieldLocked}
                    className="text-xs h-9"
                  />
                </div>
              </>
            )}
          </div>

          {/* Desk Job Guidance Note */}
          {isDeskJob && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
              <span className="font-bold block mb-1">Desk Job / Office Work Description:</span>
              <p className="mb-1 text-muted-foreground">
                Desk work counts toward total activities, activity minutes, and working period. Village, field photos, and participant counts are not required.
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {DESK_JOB_SUGGESTIONS.map((sug) => (
                  <span
                    key={sug}
                    onClick={() => {
                      if (isFieldLocked) return;
                      const cur = slot.observations || '';
                      onChange({
                        ...slot,
                        observations: cur ? `${cur}, ${sug}` : sug,
                      });
                    }}
                    className="cursor-pointer px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 font-medium text-[10px]"
                  >
                    + {sug}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Participants Section (Excluded for Desk Job) */}
          {!isDeskJob && (
            <div className="p-3 bg-muted/20 rounded-xl border border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Participant Engagement Category</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...slot,
                        activityType: 'single_farmer',
                        participantType: 'single_farmer',
                        totalParticipants: 1,
                        maleParticipants: 0,
                        femaleParticipants: 0,
                      })
                    }
                    disabled={isFieldLocked}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      isSingleFarmer ? 'bg-primary text-white' : 'bg-card border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    Single Farmer Visit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...slot,
                        activityType: 'group',
                        participantType: 'group',
                        farmerName: '',
                        totalParticipants: Math.max(1, slot.totalParticipants),
                      })
                    }
                    disabled={isFieldLocked}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      !isSingleFarmer ? 'bg-primary text-white' : 'bg-card border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    Group Activity / Meeting
                  </button>
                </div>
              </div>

              {isSingleFarmer ? (
                <div>
                  <label className="font-bold text-foreground block mb-1">
                    Farmer Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={slot.farmerName || ''}
                    onChange={(e) => onChange({ ...slot, farmerName: e.target.value })}
                    placeholder="Full name of farmer visited..."
                    disabled={isFieldLocked}
                    className="text-xs h-9"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="font-bold text-foreground block mb-1">
                      Group Activity / Meeting Details <span className="text-muted-foreground font-normal">(FPO group name, agenda, topic)</span>
                    </label>
                    <Input
                      value={slot.groupDetails || ''}
                      onChange={(e) => onChange({ ...slot, groupDetails: e.target.value })}
                      placeholder="e.g. Krishi Sangh SHG meeting on Kharif sowing & input planning..."
                      disabled={isFieldLocked}
                      className="text-xs h-9"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-foreground block mb-1">
                        Total Participants <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={slot.totalParticipants || ''}
                        onChange={(e) => onChange({ ...slot, totalParticipants: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        disabled={isFieldLocked}
                        className="text-xs h-9 font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">
                        Male Participants <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={slot.maleParticipants || ''}
                        onChange={(e) => onChange({ ...slot, maleParticipants: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        disabled={isFieldLocked}
                        className="text-xs h-9 font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">
                        Female Participants <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={slot.femaleParticipants || ''}
                        onChange={(e) => onChange({ ...slot, femaleParticipants: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        disabled={isFieldLocked}
                        className="text-xs h-9 font-bold"
                      />
                    </div>
                  </div>

                  {participantMismatch && (
                    <div className="mt-2 text-rose-700 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border border-rose-200">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Validation mismatch: Male ({male}) + Female ({female}) = {male + female}. Must equal Total ({total}).
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Observations & Issues */}
          <div className="space-y-3">
            <div>
              <label className="font-bold text-foreground block mb-1">
                Key Observations / Summary {isDeskJob ? '(Tasks Done)' : <span className="text-rose-500">*</span>}
              </label>
              <textarea
                value={slot.observations || ''}
                onChange={(e) => onChange({ ...slot, observations: e.target.value })}
                placeholder="Record main activities, observations, discussion, or outcomes... (Press Enter for newline, Ctrl+Enter to submit)"
                rows={2}
                disabled={isFieldLocked}
                className="w-full text-xs p-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-foreground block mb-1">
                Farmer Issues / Challenges Raised <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                value={slot.farmerIssues || ''}
                onChange={(e) => onChange({ ...slot, farmerIssues: e.target.value })}
                placeholder="Any challenges or concerns raised..."
                disabled={isFieldLocked}
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Support Provided Multi-Select */}
          <div>
            <label className="font-bold text-foreground block mb-1">
              Support / Guidance Provided
            </label>
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-muted/20 rounded-xl border border-border/60">
              {SUPPORT_PROVIDED_OPTIONS.map((sup) => {
                const isSelected = slot.supportProvided?.includes(sup.key);
                return (
                  <button
                    key={sup.key}
                    type="button"
                    onClick={() => toggleSupport(sup.key)}
                    disabled={isFieldLocked}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      isSelected
                        ? 'bg-primary text-white shadow-2xs'
                        : 'bg-card border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    {sup.label}
                  </button>
                );
              })}
            </div>

            {slot.supportProvided?.includes('other') && (
              <div className="mt-2">
                <Input
                  value={slot.supportOther || ''}
                  onChange={(e) => onChange({ ...slot, supportOther: e.target.value })}
                  placeholder="Detail other support provided..."
                  disabled={isFieldLocked}
                  className="text-xs h-9"
                />
              </div>
            )}
          </div>

          {/* Follow-up Required */}
          <div className="p-3 bg-muted/20 rounded-xl border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Is Follow-up Required?</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...slot, followUpRequired: false, followUpDetails: '', followUpDate: '' })}
                  disabled={isFieldLocked}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    !slot.followUpRequired ? 'bg-slate-700 text-white' : 'bg-card border border-border text-foreground'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...slot, followUpRequired: true })}
                  disabled={isFieldLocked}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    slot.followUpRequired ? 'bg-amber-600 text-white' : 'bg-card border border-border text-foreground'
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>

            {slot.followUpRequired && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="font-bold text-foreground block mb-1">
                    Follow-up Action Details <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={slot.followUpDetails || ''}
                    onChange={(e) => onChange({ ...slot, followUpDetails: e.target.value })}
                    placeholder="Specify action to be taken..."
                    disabled={isFieldLocked}
                    className="text-xs h-9"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">
                    Target Follow-up Date <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Input
                    type="date"
                    value={slot.followUpDate || ''}
                    onChange={(e) => onChange({ ...slot, followUpDate: e.target.value })}
                    disabled={isFieldLocked}
                    className="text-xs h-9"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Evidence Attachments (Photo/Video) */}
          {!isDeskJob && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-primary" /> Photo Evidence URL
                  </label>
                  {!isFieldLocked && (
                    <>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          void handleEvidenceUpload('photo', e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                      >
                        <Upload className="h-3 w-3" />
                        {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                      </button>
                    </>
                  )}
                </div>
                <Input
                  value={slot.photoUrl || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChange({
                      ...slot,
                      photoUrl: val,
                      photoEvidence: mergeEvidenceUrls(val, slot.photoEvidence?.filter((u) => u !== slot.photoUrl)),
                    });
                  }}
                  placeholder="https://... (or upload photo)"
                  disabled={isFieldLocked}
                  className="text-xs h-9"
                />
                {slot.photoUrl && (
                  <div className="rounded-lg border border-border overflow-hidden bg-muted/20 p-1">
                    <img
                      src={slot.photoUrl}
                      alt={`Activity #${slot.slotNumber} evidence`}
                      className="h-24 w-full object-cover rounded"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <VideoIcon className="h-3.5 w-3.5 text-primary" /> Video Evidence URL <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  {!isFieldLocked && (
                    <>
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          void handleEvidenceUpload('video', e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        disabled={uploadingVideo}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                      >
                        <Upload className="h-3 w-3" />
                        {uploadingVideo ? 'Uploading...' : 'Upload Video'}
                      </button>
                    </>
                  )}
                </div>
                <Input
                  value={slot.videoUrl || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChange({
                      ...slot,
                      videoUrl: val,
                      videoEvidence: mergeEvidenceUrls(val, slot.videoEvidence?.filter((u) => u !== slot.videoUrl)),
                    });
                  }}
                  placeholder="https://... (or upload video)"
                  disabled={isFieldLocked}
                  className="text-xs h-9"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
