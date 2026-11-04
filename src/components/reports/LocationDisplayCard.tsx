'use client';

import React from 'react';
import { MapPin, Navigation, Clock, ExternalLink } from 'lucide-react';
import { GpsCoordinate, LocationCaptureStatus } from '@/types/field-activity';
import { formatGpsDisplay, getGoogleMapsUrl } from '@/lib/utils/geolocation';
import { Badge } from '@/components/ui/badge';

interface LocationDisplayCardProps {
  location?: GpsCoordinate | null;
  label?: string;
  status?: LocationCaptureStatus;
  className?: string;
  variant?: 'detailed' | 'compact';
}

export function LocationDisplayCard({
  location,
  label = 'Location',
  status,
  className = '',
  variant = 'detailed',
}: LocationDisplayCardProps) {
  if (!location || (location.latitude === 0 && location.longitude === 0)) {
    return (
      <div className={`p-3 rounded-xl border border-dashed border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span>{label}: <strong className="font-medium text-foreground/70">Not captured yet</strong></span>
        </div>
        {status === 'denied' && (
          <Badge variant="destructive" className="text-[10px] py-0 px-1.5 h-4">Permission Denied</Badge>
        )}
      </div>
    );
  }

  const { placeName, coordinates, accuracy, capturedTime } = formatGpsDisplay(location);
  const mapsUrl = getGoogleMapsUrl(location);

  if (variant === 'compact') {
    return (
      <div className={`text-xs space-y-0.5 p-2 rounded-lg bg-card/60 border border-border/60 ${className}`}>
        <div className="flex items-center justify-between gap-1">
          <span className="font-semibold text-foreground text-[11px] truncate flex items-center gap-1">
            <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
            {placeName}
          </span>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 hover:text-emerald-800 text-[10px] font-bold inline-flex items-center gap-0.5 shrink-0"
            >
              Map <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>{coordinates}</span>
          <span>•</span>
          <span>{accuracy}</span>
          <span>•</span>
          <span>{capturedTime}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3.5 rounded-xl border border-emerald-900/15 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/15 space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-emerald-900/10 dark:border-emerald-500/15 pb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
          {label}
        </span>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1"
          >
            Open in Google Maps <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-start gap-1.5">
          <span className="text-muted-foreground font-medium shrink-0">Location:</span>
          <span className="font-bold text-foreground break-words">{placeName}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 pt-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Navigation className="h-3 w-3 text-muted-foreground/70" />
            <span>Coordinates: <strong className="text-foreground font-mono">{coordinates}</strong></span>
          </div>
          <div>
            <span>Accuracy: <strong className="text-foreground">{accuracy}</strong></span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground/70" />
            <span>Captured: <strong className="text-foreground">{capturedTime}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
