'use client';

import React, { useState, useEffect } from 'react';
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
  hasActiveActivityElsewhere = false,
}: FieldActivitySlotCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const rawStatus = slot.activityStatus || '';
  const isCompleted =
    rawStatus === 'COMPLETED' ||
    rawStatus === 'completed' ||
    Boolean(slot.activityEnd && slot.activityStart && (slot.durationMinutes || slot.activityDurationMinutes));
  const isInProgress =
    rawStatus === 'IN_PROGRESS' ||
    rawStatus === 'in_progress' ||
    Boolean(!isCompleted && (slot.activityStart || slot.activityStartAt));
  const status: 'not_started' | 'in_progress' | 'completed' = isCompleted
    ? 'completed'
    : isInProgress
    ? 'in_progress'
    : 'not_started';

  const isDeskJob = slot.activityName === 'desk_job';
  const isOther = slot.activityName === 'other';
  const isSingleFarmer = slot.activityType === 'single_farmer';

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
    if (status === 'completed' || isReadOnly) return;
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
    onChange({ ...slot, supportProvided: updated });
  };

  // Participant validation
  const male = Number(slot.maleParticipants) || 0;
  const female = Number(slot.femaleParticipants) || 0;
  const total = Number(slot.totalParticipants) || 0;
  const participantMismatch = !isDeskJob && !isSingleFarmer && total > 0 && male + female !== total;

  // Handle Start
  const handleStart = async () => {
    setActionError(null);
    setStarting(true);
    try {
      await onStartActivity(slot.slotNumber);
    } catch (err: any) {
      setActionError(err.message || 'Failed to start activity.');
    } finally {
      setStarting(false);
    }
  };

  // Handle End
  const handleEnd = async () => {
    setActionError(null);

    // Validation checks before ending
    if (!isDeskJob) {
      if (!slot.village || !slot.village.trim()) {
        setActionError('Please specify Village / Location before completing this field activity.');
        return;
      }
      if (!slot.observations || !slot.observations.trim()) {
        setActionError('Please enter observations/work summary before ending this activity.');
        return;
      }
      if (isSingleFarmer && (!slot.farmerName || !slot.farmerName.trim())) {
        setActionError('Farmer Name is required for single farmer visits.');
        return;
      }
      if (!isSingleFarmer && participantMismatch) {
        setActionError(`Participant counts must add up: Male (${male}) + Female (${female}) must equal Total (${total}).`);
        return;
      }
    }

    setEnding(true);
    try {
      await onEndActivity(slot.slotNumber);
    } catch (err: any) {
      setActionError(err.message || 'Failed to end activity.');
    } finally {
      setEnding(false);
    }
  };

  const startLoc = slot.activityStartLocation || slot.activityStartGps;
  const endLoc = slot.activityEndLocation || slot.activityEndGps;

  return (
    <div
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

      {/* Action Error Banner */}
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
                    Configure the activity type below and click <strong>Start Activity</strong>. Start time and GPS location will be captured automatically.
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
                  Another activity is currently IN PROGRESS. Please complete it by clicking "End Activity" before starting Activity #{slot.slotNumber}.
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
                    Started at <strong>{formatCapturedTime(slot.activityStartAt || slot.activityStart)}</strong> (Elapsed: <strong>{elapsedMinutes} mins</strong>). Complete documentation and click End Activity when finished.
                  </p>
                </div>

                {!isReadOnly && (
                  <div className="flex items-center gap-2 shrink-0">
                    {onSaveDraft && (
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        onClick={async () => {
                          setManualSaving(true);
                          try {
                            await onSaveDraft(slot.slotNumber);
                          } catch (err: any) {
                            setActionError(err.message || 'Failed to save draft.');
                          } finally {
                            setManualSaving(false);
                          }
                        }}
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
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Activity Timeline & Locations
                </span>
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                  Total Duration: {slot.durationMinutes || slot.activityDurationMinutes || 0} minutes
                </span>
              </div>

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
                disabled={isReadOnly || status === 'completed'}
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
                  disabled={isReadOnly || status === 'completed'}
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
                    disabled={isReadOnly || status === 'completed'}
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
                    disabled={isReadOnly || status === 'completed'}
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
                      if (status === 'completed' || isReadOnly) return;
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
                    onClick={() => onChange({ ...slot, activityType: 'single_farmer', totalParticipants: 1, maleParticipants: 0, femaleParticipants: 0 })}
                    disabled={isReadOnly || status === 'completed'}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      isSingleFarmer ? 'bg-primary text-white' : 'bg-card border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    Single Farmer Visit
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...slot, activityType: 'group', farmerName: '', totalParticipants: Math.max(1, slot.totalParticipants) })}
                    disabled={isReadOnly || status === 'completed'}
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
                    disabled={isReadOnly || status === 'completed'}
                    className="text-xs h-9"
                  />
                </div>
              ) : (
                <div>
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
                        disabled={isReadOnly || status === 'completed'}
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
                        disabled={isReadOnly || status === 'completed'}
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
                        disabled={isReadOnly || status === 'completed'}
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
                placeholder="Record main activities, observations, discussion, or outcomes..."
                rows={2}
                disabled={isReadOnly || status === 'completed'}
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
                disabled={isReadOnly || status === 'completed'}
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
                    disabled={isReadOnly || status === 'completed'}
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
                  disabled={isReadOnly || status === 'completed'}
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
                  onClick={() => onChange({ ...slot, followUpRequired: false, followUpDetails: '' })}
                  disabled={isReadOnly || status === 'completed'}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    !slot.followUpRequired ? 'bg-slate-700 text-white' : 'bg-card border border-border text-foreground'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...slot, followUpRequired: true })}
                  disabled={isReadOnly || status === 'completed'}
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
                    disabled={isReadOnly || status === 'completed'}
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
                    disabled={isReadOnly || status === 'completed'}
                    className="text-xs h-9"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Evidence Attachments (Photo/Video) */}
          {!isDeskJob && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="font-bold text-foreground flex items-center gap-1.5 mb-1">
                  <ImageIcon className="h-3.5 w-3.5 text-primary" /> Photo Evidence URL
                </label>
                <Input
                  value={slot.photoUrl || ''}
                  onChange={(e) => onChange({ ...slot, photoUrl: e.target.value })}
                  placeholder="https://... (or capture in field)"
                  disabled={isReadOnly || status === 'completed'}
                  className="text-xs h-9"
                />
              </div>

              <div>
                <label className="font-bold text-foreground flex items-center gap-1.5 mb-1">
                  <VideoIcon className="h-3.5 w-3.5 text-primary" /> Video Evidence URL <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  value={slot.videoUrl || ''}
                  onChange={(e) => onChange({ ...slot, videoUrl: e.target.value })}
                  placeholder="https://..."
                  disabled={isReadOnly || status === 'completed'}
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
