'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Users,
  Navigation,
  MapPin,
  Lock,
  Download,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldReportDailySummary, GpsCoordinate, LocationCaptureStatus } from '@/types';
import { captureCurrentGps, formatGpsCoordinates, getGoogleMapsUrl } from '@/lib/utils/geolocation';

interface FieldDailySummaryCardProps {
  summary: FieldReportDailySummary;
  isFinalized: boolean;
  finalizationGps?: GpsCoordinate | null;
  onFinalize: (gps: GpsCoordinate | null, status: LocationCaptureStatus) => Promise<void>;
  onDownloadPDF?: () => void;
  isReadOnly?: boolean;
}

export function FieldDailySummaryCard({
  summary,
  isFinalized,
  finalizationGps,
  onFinalize,
  onDownloadPDF,
  isReadOnly = false,
}: FieldDailySummaryCardProps) {
  const [finalizing, setFinalizing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFinalizeClick = async () => {
    setFinalizing(true);
    setErrorMsg(null);
    setGpsStatus('Capturing finalization GPS location...');

    try {
      const geoResult = await captureCurrentGps();
      if (geoResult.coords) {
        setGpsStatus(`GPS captured (±${geoResult.coords.accuracy}m)`);
      } else {
        setGpsStatus('GPS unavailable');
      }

      await onFinalize(geoResult.coords, geoResult.status);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to finalize report.');
    } finally {
      setFinalizing(false);
      setTimeout(() => setGpsStatus(null), 4000);
    }
  };

  return (
    <div id="daily-summary-section" className="border border-border rounded-2xl bg-card shadow-2xs overflow-hidden scroll-mt-6">
      {/* Header */}
      <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Daily Activity Summary & Finalization</h3>
            <p className="text-[11px] text-muted-foreground">
              Consolidated operational calculations across all recorded activity slots
            </p>
          </div>
        </div>

        {isFinalized && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-1 rounded-full border border-emerald-300">
            <Lock className="h-3 w-3" /> Finalized
          </span>
        )}
      </div>

      {/* Grid of Key Calculations */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/40 rounded-xl border border-border text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Activities
            </span>
            <span className="text-xl font-black text-foreground mt-0.5 block">
              {summary.totalActivities}
            </span>
          </div>

          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
              Total Task Time
            </span>
            <span className="text-xl font-black text-emerald-900 dark:text-emerald-200 mt-0.5 block">
              {summary.totalActivityHours} hrs
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              ({summary.totalActivityMinutes} mins)
            </span>
          </div>

          <div className="p-3 bg-sky-50/60 dark:bg-sky-950/20 rounded-xl border border-sky-200 dark:border-sky-900/40 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 block">
              Working Period
            </span>
            <span className="text-xl font-black text-sky-900 dark:text-sky-200 mt-0.5 block">
              {summary.totalWorkingPeriodHours} hrs
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              ({summary.totalWorkingPeriodMinutes} mins)
            </span>
          </div>

          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-900/40 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300 block">
              Total Contacts
            </span>
            <span className="text-xl font-black text-purple-900 dark:text-purple-200 mt-0.5 block">
              {summary.totalParticipantContacts}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              (M: {summary.totalMaleParticipants} | F: {summary.totalFemaleParticipants})
            </span>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3 bg-muted/20 rounded-xl border border-border/60">
          <div className="space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>First Activity Start:</span>
              <span className="font-semibold text-foreground">
                {summary.firstActivityStart ? summary.firstActivityStart.split('T')[1]?.slice(0, 5) : '—'}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Last Activity End:</span>
              <span className="font-semibold text-foreground">
                {summary.lastActivityEnd ? summary.lastActivityEnd.split('T')[1]?.slice(0, 5) : '—'}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Field / Community Time:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {summary.totalFieldActivityMinutes} mins
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Desk Job / Office Time:</span>
              <span className="font-semibold text-blue-700 dark:text-blue-400">
                {summary.totalDeskJobMinutes} mins
              </span>
            </div>
          </div>
        </div>

        {/* Finalization GPS coordinates */}
        {finalizationGps && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-bold text-foreground block">Finalization GPS Recorded</span>
                <span className="text-muted-foreground text-[11px]">{formatGpsCoordinates(finalizationGps)}</span>
              </div>
            </div>
            <a
              href={getGoogleMapsUrl(finalizationGps) || '#'}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-primary hover:underline"
            >
              View on Map
            </a>
          </div>
        )}

        {gpsStatus && (
          <p className="text-xs text-primary font-medium flex items-center gap-1.5 animate-pulse">
            <Navigation className="h-3.5 w-3.5" />
            <span>{gpsStatus}</span>
          </p>
        )}

        {errorMsg && (
          <p className="text-xs text-rose-600 font-bold flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          {!isFinalized && !isReadOnly && (
            <>
              <Button
                type="button"
                onClick={handleFinalizeClick}
                disabled={finalizing || summary.totalActivities === 0}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-10 rounded-xl shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {finalizing
                  ? 'Capturing Finalization GPS & Submitting...'
                  : `Finalize Daily Report (${summary.totalActivities} ${summary.totalActivities === 1 ? 'Activity' : 'Activities'})`}
              </Button>
              {summary.totalActivities === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium text-center">
                  ⚠️ Please complete and end at least 1 activity slot above to enable daily report finalization.
                </p>
              )}
            </>
          )}

          {isFinalized && onDownloadPDF && (
            <Button
              type="button"
              onClick={onDownloadPDF}
              className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-10 rounded-xl shadow-xs"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download One-Page Daily PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
