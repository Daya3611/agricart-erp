'use client';

import React from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  MapPin,
  User,
  Users,
  Video,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LocationDisplayCard } from '@/components/reports/LocationDisplayCard';
import { MediaPreview } from '@/components/media/media-preview';
import { FieldReport } from '@/types/field-activity';
import { formatReadableDate, formatTimeIST } from '@/lib/utils/date-utils';
import {
  isSingleFarmerActivity,
  mergeEvidenceUrls,
  normalizeActivityStatus,
  resolveActivityNameLabel,
  resolveSupportLabels,
} from '@/lib/utils/field-activity-calculations';

interface FieldActivityReviewListProps {
  fieldReport: FieldReport;
}

function formatDurationMinutes(totalMins: number): string {
  const safe = Math.max(0, Math.round(totalMins || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function FieldActivityReviewList({ fieldReport }: FieldActivityReviewListProps) {
  const activities = Array.isArray(fieldReport.activities)
    ? [...fieldReport.activities].sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0))
    : [];

  const completedCount = activities.filter(
    (a) =>
      a.activityStatus === 'COMPLETED' ||
      a.activityStatus === 'completed' ||
      Boolean(a.activityEndAt || a.activityEnd)
  ).length;

  const summary = fieldReport.summary || {
    totalActivities: activities.length,
    totalActivityMinutes: activities.reduce((acc, a) => acc + (a.activityDurationMinutes ?? a.durationMinutes ?? 0), 0),
    totalActivityHours: 0,
    totalWorkingPeriodMinutes: 0,
    totalWorkingPeriodHours: 0,
    totalDeskJobMinutes: 0,
    totalFieldActivityMinutes: 0,
    totalParticipantContacts: activities.reduce((acc, a) => acc + (a.totalParticipants || 0), 0),
    totalMaleParticipants: activities.reduce((acc, a) => acc + (a.maleParticipants || 0), 0),
    totalFemaleParticipants: activities.reduce((acc, a) => acc + (a.femaleParticipants || 0), 0),
  };

  return (
    <div className="space-y-4">
      {/* Operational Header & Region Details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Report Date
          </span>
          <span className="font-bold text-foreground block mt-0.5">
            {formatReadableDate(fieldReport.reportDate)}
          </span>
        </div>
        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            CRP Code
          </span>
          <span className="font-bold text-foreground font-mono block mt-0.5">
            {fieldReport.crpCode?.trim() || '—'}
          </span>
        </div>
        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Block / Taluka
          </span>
          <span className="font-bold text-foreground block mt-0.5">
            {fieldReport.blockTaluka?.trim() || '—'}
          </span>
        </div>
        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Submitted / Status
          </span>
          <span className="font-bold text-primary uppercase block mt-0.5">
            {(fieldReport.status || 'draft').replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
        <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
          <span className="text-[10px] font-bold text-muted-foreground uppercase block">Activities</span>
          <span className="text-lg font-black text-primary">
            {completedCount}/{activities.length}
          </span>
          <span className="text-[10px] text-muted-foreground block">Completed</span>
        </div>

        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <span className="text-[10px] font-bold text-muted-foreground uppercase block">Active Time</span>
          <span className="text-base font-black text-foreground">
            {formatDurationMinutes(summary.totalActivityMinutes)}
          </span>
          <span className="text-[10px] text-muted-foreground block">
            Field {formatDurationMinutes(summary.totalFieldActivityMinutes)} • Desk {formatDurationMinutes(summary.totalDeskJobMinutes)}
          </span>
        </div>

        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <span className="text-[10px] font-bold text-muted-foreground uppercase block">Working Period</span>
          <span className="text-base font-black text-foreground">
            {formatDurationMinutes(summary.totalWorkingPeriodMinutes)}
          </span>
          <span className="text-[10px] text-muted-foreground block">
            {summary.totalWorkingPeriodHours} hrs span
          </span>
        </div>

        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <span className="text-[10px] font-bold text-muted-foreground uppercase block">Total Participants</span>
          <span className="text-lg font-black text-primary">{summary.totalParticipantContacts}</span>
          <span className="text-[10px] text-muted-foreground block">All contacts</span>
        </div>

        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <span className="text-[10px] font-bold text-muted-foreground uppercase block">Gender Split</span>
          <span className="text-sm font-black text-foreground block mt-0.5">
            M: {summary.totalMaleParticipants} / F: {summary.totalFemaleParticipants}
          </span>
          <span className="text-[10px] text-muted-foreground block">Male / Female</span>
        </div>
      </div>

      {/* Finalization GPS Location */}
      {fieldReport.finalizationGps && (
        <LocationDisplayCard
          location={fieldReport.finalizationGps}
          label="Daily Report Finalization GPS Location"
          status={fieldReport.finalizationLocationStatus}
        />
      )}

      {/* Full Slot-by-Slot Field Activity Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-1.5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Layers className="h-4 w-4" /> Complete Recorded Field Activities ({activities.length})
          </h3>
        </div>

        {activities.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
            No field activity slots recorded in this report.
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((act) => {
              const title = resolveActivityNameLabel(act);
              const isDesk = act.activityName === 'desk_job';
              const isSingle = isSingleFarmerActivity(act);
              const normStatus = normalizeActivityStatus(act);
              const isCompleted = normStatus === 'COMPLETED';
              const isInProgress = normStatus === 'IN_PROGRESS';

              const startTime = formatTimeIST(act.activityStartAt || act.activityStart);
              const endTime = formatTimeIST(act.activityEndAt || act.activityEnd);
              const durationMins = act.activityDurationMinutes ?? act.durationMinutes ?? 0;
              const photos = mergeEvidenceUrls(act.photoUrl, act.photoEvidence);
              const videos = mergeEvidenceUrls(act.videoUrl, act.videoEvidence);
              const supportLabels = resolveSupportLabels(act);

              return (
                <div
                  key={`${act.activityId || 'slot'}_${act.slotNumber}`}
                  className="p-4 bg-card rounded-2xl border border-border shadow-2xs space-y-3.5 text-xs"
                >
                  {/* Slot Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-border">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="h-6 w-6 rounded-lg bg-[#228B4E] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                          #{act.slotNumber}
                        </span>
                        <span className="font-bold text-sm text-foreground">{title}</span>
                        {act.activityOther?.trim() && (
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            Specified: {act.activityOther}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pl-8">
                        <Badge
                          className={`text-[10px] font-bold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : isInProgress
                              ? 'bg-sky-100 text-sky-800 border-sky-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Not Started'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {isDesk
                            ? 'Office / Desk Work'
                            : isSingle
                            ? 'Single Farmer Visit'
                            : 'Group / Community Engagement'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-xl border border-border">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-semibold text-foreground">
                        {startTime} — {endTime}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-bold text-primary">{formatDurationMinutes(durationMins)}</span>
                    </div>
                  </div>

                  {/* Location & Engagement Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-primary" /> Village / Location
                      </span>
                      <p className="font-semibold text-foreground mt-0.5 break-words">
                        {isDesk ? 'Office / Desk' : act.village?.trim() || '—'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                        Wadi / Hamlet
                      </span>
                      <p className="font-semibold text-foreground mt-0.5 break-words">
                        {act.wadi?.trim() || '—'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3 text-primary" />
                        {isSingle ? 'Farmer Name' : 'Farmer / Lead Name'}
                      </span>
                      <p className="font-semibold text-foreground mt-0.5 break-words">
                        {act.farmerName?.trim() || '—'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3 text-primary" /> Participants
                      </span>
                      <p className="font-bold text-foreground mt-0.5">
                        Total: {act.totalParticipants ?? 0}{' '}
                        <span className="font-normal text-muted-foreground">
                          (M: {act.maleParticipants ?? 0}, F: {act.femaleParticipants ?? 0})
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Group Activity / Meeting Details */}
                  {(!isSingle || act.groupDetails?.trim()) && (
                    <div className="p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 block mb-1">
                        Group Activity / Meeting Details
                      </span>
                      <p className="text-foreground whitespace-pre-wrap break-words leading-relaxed">
                        {act.groupDetails?.trim() || '—'}
                      </p>
                    </div>
                  )}

                  {/* Full Observations & Farmer Issues */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-muted/30 border border-border">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                        <FileText className="h-3 w-3 text-primary" /> Key Observations / Summary
                      </span>
                      <p className="text-foreground whitespace-pre-wrap break-words leading-relaxed">
                        {act.observations?.trim() || 'No observations recorded.'}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3 text-amber-600" /> Farmer Issues / Challenges Raised
                      </span>
                      <p className="text-foreground whitespace-pre-wrap break-words leading-relaxed">
                        {act.farmerIssues?.trim() || 'None reported'}
                      </p>
                    </div>
                  </div>

                  {/* Support / Guidance Provided */}
                  <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Wrench className="h-3 w-3 text-primary" /> Support / Guidance Provided
                    </span>
                    {supportLabels.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {supportLabels.map((label, idx) => (
                          <Badge
                            key={`${label}_${idx}`}
                            variant="outline"
                            className="bg-background text-[11px] font-semibold"
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">None selected</p>
                    )}
                  </div>

                  {/* Follow-up Section */}
                  <div
                    className={`p-3 rounded-xl border ${
                      act.followUpRequired
                        ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                        : 'bg-muted/20 border-border'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1">
                        <Activity className="h-3 w-3 text-primary" /> Follow-up Required:{' '}
                        <span className={act.followUpRequired ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}>
                          {act.followUpRequired ? 'YES' : 'NO'}
                        </span>
                      </span>
                      {act.followUpRequired && act.followUpDate?.trim() && (
                        <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Target Date: {act.followUpDate}
                        </span>
                      )}
                    </div>
                    {act.followUpRequired && (
                      <p className="mt-1.5 text-foreground whitespace-pre-wrap break-words leading-relaxed">
                        {act.followUpDetails?.trim() || 'Follow-up flagged without details.'}
                      </p>
                    )}
                  </div>

                  {/* Start & End GPS Locations */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <LocationDisplayCard
                      location={act.activityStartLocation || act.activityStartGps}
                      label="Start Activity GPS"
                      status={act.activityStartLocationStatus}
                      variant="compact"
                    />
                    <LocationDisplayCard
                      location={act.activityEndLocation || act.activityEndGps}
                      label="End Activity GPS"
                      status={act.activityEndLocationStatus}
                      variant="compact"
                    />
                  </div>

                  {/* Photo & Video Evidence */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Photos */}
                    <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <ImageIcon className="h-3 w-3 text-primary" /> Photo Evidence ({photos.length})
                      </span>
                      {photos.length === 0 ? (
                        <p className="text-muted-foreground italic">No photo evidence attached.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {photos.map((url, idx) => (
                            <div key={`${url}_${idx}`} className="space-y-1.5 bg-background p-2 rounded-lg border border-border">
                              <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                                <MediaPreview
                                  src={url}
                                  alt={`Activity ${act.slotNumber} Photo ${idx + 1}`}
                                  variant="banner"
                                  className="w-full h-32 rounded-md border border-border"
                                />
                              </a>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline break-all"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span>Open Photo #{idx + 1}</span>
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Videos */}
                    <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Video className="h-3 w-3 text-primary" /> Video Evidence ({videos.length})
                      </span>
                      {videos.length === 0 ? (
                        <p className="text-muted-foreground italic">No video evidence attached.</p>
                      ) : (
                        <div className="space-y-2">
                          {videos.map((url, idx) => (
                            <div key={`${url}_${idx}`} className="space-y-1.5 bg-background p-2 rounded-lg border border-border">
                              <video
                                src={url}
                                controls
                                preload="metadata"
                                className="w-full max-h-44 rounded-md border border-border bg-black"
                              />
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline break-all"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="break-all">Open Video #{idx + 1}: {url}</span>
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review & Approval History (when present on FieldReport) */}
      {(fieldReport.reviewerName || (Array.isArray(fieldReport.approvalHistory) && fieldReport.approvalHistory.length > 0)) && (
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verification & Review Record
          </span>
          {fieldReport.reviewerName && (
            <p className="text-foreground">
              <span className="font-semibold">Latest Reviewer:</span> {fieldReport.reviewerName}{' '}
              {fieldReport.reviewerRole ? `(${fieldReport.reviewerRole})` : ''}
              {fieldReport.reviewedAt ? ` • ${formatReadableDate(fieldReport.reviewedAt)}` : ''}
            </p>
          )}
          {fieldReport.reviewComments && (
            <p className="text-muted-foreground italic">"{fieldReport.reviewComments}"</p>
          )}
        </div>
      )}
    </div>
  );
}
