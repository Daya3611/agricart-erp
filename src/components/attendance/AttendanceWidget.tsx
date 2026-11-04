'use client';

import React, { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle2, LogIn, LogOut, Navigation, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AttendanceSession, UserProfile } from '@/types';
import { captureCurrentGps, formatGpsCoordinates, getGoogleMapsUrl } from '@/lib/utils/geolocation';
import { LocationDisplayCard } from '@/components/reports/LocationDisplayCard';

interface AttendanceWidgetProps {
  user: UserProfile;
  className?: string;
  onStatusChange?: (session: AttendanceSession | null) => void;
}

export function AttendanceWidget({ user, className, onStatusChange }: AttendanceWidgetProps) {
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [gpsStatusText, setGpsStatusText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/attendance/current');
      const data = await res.json();
      if (res.ok && data.success) {
        setSession(data.session);
        onStatusChange?.(data.session);
      }
    } catch (err: any) {
      console.warn('Attendance session fetch warning:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleClockIn = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setGpsStatusText('Capturing GPS location...');

    try {
      const geoResult = await captureCurrentGps();
      if (geoResult.coords) {
        setGpsStatusText(`GPS captured (±${geoResult.coords.accuracy}m)`);
      } else {
        setGpsStatusText('GPS unavailable');
      }

      const res = await fetch('/api/attendance/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gps: geoResult.coords,
          locationStatus: geoResult.status,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record clock-in attendance.');
      }

      setSession(data.session);
      onStatusChange?.(data.session);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
      setTimeout(() => setGpsStatusText(null), 4000);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setGpsStatusText('Capturing GPS location for logout...');

    try {
      const geoResult = await captureCurrentGps();
      const res = await fetch('/api/attendance/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gps: geoResult.coords,
          locationStatus: geoResult.status,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record clock-out.');
      }

      setSession(data.session);
      onStatusChange?.(data.session);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
      setTimeout(() => setGpsStatusText(null), 4000);
    }
  };

  const isClockedIn = Boolean(session && session.status === 'active');
  const isClockedOut = Boolean(session && session.status === 'closed');

  return (
    <div className={`p-4 bg-card rounded-2xl border border-border shadow-2xs space-y-3 ${className || ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary shrink-0" />
          <div>
            <h3 className="text-xs font-bold text-foreground">Attendance & Time Tracker</h3>
            <p className="text-[11px] text-muted-foreground">Real-time daily field attendance and GPS capture</p>
          </div>
        </div>

        <div>
          {loading ? (
            <Badge variant="secondary" className="text-[10px]">Checking...</Badge>
          ) : isClockedIn ? (
            <Badge variant="default" className="text-[10px] bg-emerald-600 text-white font-bold">
              Active Session
            </Badge>
          ) : isClockedOut ? (
            <Badge variant="secondary" className="text-[10px]">
              Day Closed
            </Badge>
          ) : (
            <Badge variant="warning" className="text-[10px]">
              Not Logged In
            </Badge>
          )}
        </div>
      </div>

      {/* Session details */}
      {session && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
          <div>
            <span className="text-muted-foreground text-[11px] block">Login Time:</span>
            <span className="font-bold text-foreground">
              {new Date(session.loginTimestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
            {session.loginGps && (
              <div className="mt-1">
                <LocationDisplayCard location={session.loginGps} variant="compact" label="Login Location" />
              </div>
            )}
          </div>

          <div>
            <span className="text-muted-foreground text-[11px] block">Logout Time:</span>
            <span className="font-bold text-foreground">
              {session.logoutTimestamp
                ? new Date(session.logoutTimestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                : 'Active / Working'}
            </span>
            {session.logoutGps && (
              <div className="mt-1">
                <LocationDisplayCard location={session.logoutGps} variant="compact" label="Logout Location" />
              </div>
            )}
            {session.logoutType === 'automatic_midnight' && (
              <span className="text-[10px] text-amber-600 block mt-0.5 font-medium">Auto-closed at midnight</span>
            )}
          </div>
        </div>
      )}

      {gpsStatusText && (
        <div className="flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse">
          <Navigation className="h-3.5 w-3.5" />
          <span>{gpsStatusText}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {!session || (!isClockedIn && !isClockedOut) ? (
          <Button
            size="sm"
            onClick={handleClockIn}
            disabled={actionLoading || loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl"
          >
            <LogIn className="h-4 w-4 mr-1.5" />
            {actionLoading ? 'Capturing GPS & Clocking In...' : 'Clock In / Start Day'}
          </Button>
        ) : isClockedIn ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleClockOut}
            disabled={actionLoading || loading}
            className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs h-9 rounded-xl"
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            {actionLoading ? 'Capturing GPS & Logging Out...' : 'Clock Out / End Day'}
          </Button>
        ) : (
          <div className="w-full text-center py-1 text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Attendance completed for today</span>
          </div>
        )}
      </div>
    </div>
  );
}
