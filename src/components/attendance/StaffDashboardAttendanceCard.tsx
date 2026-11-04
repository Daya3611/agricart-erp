'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  MapPin,
  CheckCircle2,
  LogIn,
  LogOut,
  Navigation,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AttendanceSession, UserProfile, GpsCoordinate } from '@/types';
import {
  captureCurrentGps,
  formatCapturedTime,
  formatGpsCoordinates,
  getGoogleMapsUrl,
} from '@/lib/utils/geolocation';
import { LocationDisplayCard } from '@/components/reports/LocationDisplayCard';
import {
  saveAttendanceLocally,
  loadLocalAttendance,
  syncPendingAttendanceToServer,
} from '@/lib/offline/sync-service';
import { getOperationalDateString } from '@/lib/utils/date-utils';

interface StaffDashboardAttendanceCardProps {
  user: UserProfile | null;
  session: AttendanceSession | null;
  loading?: boolean;
  onSessionChange?: (session: AttendanceSession | null) => void;
  className?: string;
}

export function StaffDashboardAttendanceCard({
  user,
  session,
  loading = false,
  onSessionChange,
  className = '',
}: StaffDashboardAttendanceCardProps) {
  const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(session);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [activeElapsedMinutes, setActiveElapsedMinutes] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  // Sync prop session with internal state
  useEffect(() => {
    setCurrentSession(session);
  }, [session]);

  // Network online/offline listener
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = async () => {
      setIsOnline(true);
      try {
        const res = await syncPendingAttendanceToServer();
        if (res.syncedCount > 0) {
          setStatusMessage({
            type: 'success',
            text: `Reconnected! Successfully synced ${res.syncedCount} offline attendance record(s).`,
          });
          // Refresh session from server
          fetchLatestSession();
        }
      } catch (err) {
        console.warn('Attendance sync error on reconnect:', err);
      }
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchLatestSession = async () => {
    try {
      const res = await fetch('/api/attendance/current');
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentSession(data.session);
        onSessionChange?.(data.session);
      }
    } catch (err: any) {
      console.warn('Failed to refresh attendance session:', err.message);
    }
  };

  // Live timer for active session duration
  const isActive = currentSession?.status === 'active' || currentSession?.attendanceStatus === 'active';
  const isClosed = currentSession?.status === 'closed' || currentSession?.attendanceStatus === 'closed' || currentSession?.attendanceStatus === 'system_closed';
  const isSystemClosed = Boolean(currentSession?.systemClosed || currentSession?.logoutType === 'automatic_midnight' || currentSession?.attendanceStatus === 'system_closed');

  useEffect(() => {
    if (!isActive || !currentSession) return;

    const calcElapsed = () => {
      const startIso = currentSession.loginAt || currentSession.loginTimestamp;
      if (startIso) {
        const startMs = new Date(startIso).getTime();
        if (!isNaN(startMs) && startMs > 0) {
          const mins = Math.max(0, Math.round((Date.now() - startMs) / 60000));
          setActiveElapsedMinutes(mins);
        }
      }
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [isActive, currentSession?.loginAt, currentSession?.loginTimestamp]);

  // Handle Login
  const handleLogin = async () => {
    if (!user) {
      setStatusMessage({ type: 'error', text: 'You must be logged in to record attendance.' });
      return;
    }

    setActionLoading(true);
    setStatusMessage({ type: 'info', text: 'Capturing GPS latitude, longitude, and reverse geocoding address...' });

    try {
      const geoResult = await captureCurrentGps();
      const todayStr = getOperationalDateString();
      const nowIso = new Date().toISOString();

      if (navigator.onLine) {
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
          throw new Error(data.error || 'Failed to record attendance login.');
        }

        setCurrentSession(data.session);
        onSessionChange?.(data.session);

        // Also cache locally
        await saveAttendanceLocally({
          employeeUid: user.uid,
          employeeId: user.employeeId || '',
          attendanceDate: todayStr,
          action: 'login',
          sessionData: {
            gps: geoResult.coords,
            locationStatus: geoResult.status,
          },
          syncStatus: 'synced',
        });

        setStatusMessage({
          type: 'success',
          text: `Attendance Login recorded at ${formatCapturedTime(data.session.loginTimestamp || nowIso)}. Status: Logged In.`,
        });
      } else {
        // Offline handling
        const offlineSession: AttendanceSession = {
          id: `att_${user.uid}_${todayStr}`,
          employeeUid: user.uid,
          employeeId: user.employeeId || '',
          employeeName: user.fullName || 'Staff Member',
          departmentId: user.departmentId || '',
          centerId: user.assignedCenterIds?.[0] || '',
          date: todayStr,
          attendanceDate: todayStr,
          loginTimestamp: nowIso,
          loginAt: nowIso,
          loginGps: geoResult.coords,
          loginLocation: geoResult.coords,
          loginLocationStatus: geoResult.status,
          logoutTimestamp: null,
          logoutAt: null,
          logoutGps: null,
          logoutLocation: null,
          logoutLocationStatus: null,
          logoutType: null,
          status: 'active',
          attendanceStatus: 'active',
          systemClosed: false,
          attendanceDurationMinutes: 0,
          syncStatus: 'saved_offline',
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await saveAttendanceLocally({
          employeeUid: user.uid,
          employeeId: user.employeeId || '',
          attendanceDate: todayStr,
          action: 'login',
          sessionData: {
            gps: geoResult.coords,
            locationStatus: geoResult.status,
          },
          syncStatus: 'saved_offline',
        });

        setCurrentSession(offlineSession);
        onSessionChange?.(offlineSession);

        setStatusMessage({
          type: 'info',
          text: 'Attendance Login saved offline. It will synchronize automatically when online.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to record attendance login.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    if (!user) {
      setStatusMessage({ type: 'error', text: 'You must be logged in to record attendance.' });
      return;
    }

    if (!isActive) {
      setStatusMessage({ type: 'error', text: 'No active attendance session found to logout.' });
      return;
    }

    setActionLoading(true);
    setStatusMessage({ type: 'info', text: 'Capturing logout GPS location and calculating total duration...' });

    try {
      const geoResult = await captureCurrentGps();
      const todayStr = getOperationalDateString();
      const nowIso = new Date().toISOString();

      if (navigator.onLine) {
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
          throw new Error(data.error || 'Failed to record attendance logout.');
        }

        setCurrentSession(data.session);
        onSessionChange?.(data.session);

        await saveAttendanceLocally({
          employeeUid: user.uid,
          employeeId: user.employeeId || '',
          attendanceDate: todayStr,
          action: 'logout',
          sessionData: {
            gps: geoResult.coords,
            locationStatus: geoResult.status,
          },
          syncStatus: 'synced',
        });

        const durationMins = data.session.attendanceDurationMinutes || data.session.durationMinutes || 0;
        const durHours = Math.floor(durationMins / 60);
        const durRemMins = durationMins % 60;
        const durStr = durHours > 0 ? `${durHours}h ${durRemMins}m` : `${durRemMins} mins`;

        setStatusMessage({
          type: 'success',
          text: `Attendance Logout recorded at ${formatCapturedTime(nowIso)}. Total Working Duration: ${durStr}. Day Completed!`,
        });
      } else {
        // Offline logout handling
        const startIso = currentSession?.loginAt || currentSession?.loginTimestamp || nowIso;
        const durationMins = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(startIso).getTime()) / 60000));

        const offlineClosedSession: AttendanceSession = {
          ...(currentSession as AttendanceSession),
          logoutTimestamp: nowIso,
          logoutAt: nowIso,
          logoutGps: geoResult.coords,
          logoutLocation: geoResult.coords,
          logoutLocationStatus: geoResult.status,
          logoutType: 'explicit',
          status: 'closed',
          attendanceStatus: 'closed',
          systemClosed: false,
          attendanceDurationMinutes: durationMins,
          durationMinutes: durationMins,
          syncStatus: 'saved_offline',
          updatedAt: nowIso,
        };

        await saveAttendanceLocally({
          employeeUid: user.uid,
          employeeId: user.employeeId || '',
          attendanceDate: todayStr,
          action: 'logout',
          sessionData: {
            gps: geoResult.coords,
            locationStatus: geoResult.status,
          },
          syncStatus: 'saved_offline',
        });

        setCurrentSession(offlineClosedSession);
        onSessionChange?.(offlineClosedSession);

        setStatusMessage({
          type: 'info',
          text: 'Attendance Logout saved locally offline. Will synchronize when online.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to record attendance logout.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to open Google Maps
  const handleOpenMap = (loc: GpsCoordinate | null | undefined) => {
    if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return;
    const url = getGoogleMapsUrl(loc);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Duration formatting
  const calculateDisplayDuration = (): string => {
    if (isClosed && currentSession) {
      const mins = currentSession.attendanceDurationMinutes || currentSession.durationMinutes || 0;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h} hrs ${m} mins` : `${m} mins`;
    }
    if (isActive) {
      const h = Math.floor(activeElapsedMinutes / 60);
      const m = activeElapsedMinutes % 60;
      return h > 0 ? `${h} hrs ${m} mins (active)` : `${m} mins (active)`;
    }
    return '0 mins';
  };

  const loginLoc = currentSession?.loginLocation || currentSession?.loginGps;
  const logoutLoc = currentSession?.logoutLocation || currentSession?.logoutGps;

  return (
    <Card className={`p-5 sm:p-6 rounded-[22px] bg-card border border-border shadow-2xs space-y-5 transition-all ${className}`}>
      {/* Top Header: Title, Timezone & Status Badges */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-foreground tracking-tight">
                Staff Daily Attendance
              </h3>
              <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-border px-2 py-0">
                Asia/Kolkata (IST)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              High-accuracy browser GPS verification • Separate from field activity logs
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sync indicator */}
          {isOnline ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
              <Wifi className="h-3 w-3" />
              {currentSession?.syncStatus === 'saved_offline' ? 'Pending Sync' : 'Synced'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200">
              <WifiOff className="h-3 w-3" />
              Offline Mode
            </span>
          )}

          {/* Primary Attendance Status Pill */}
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#E8F5EC] text-[#228B4E] dark:bg-[#183323] dark:text-[#4ade80] border border-[#CDE7D4]">
              <span className="h-2 w-2 rounded-full bg-[#228B4E] animate-ping" />
              Logged In
            </span>
          ) : isClosed ? (
            isSystemClosed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#FEF7E8] text-[#D99A28] dark:bg-[#451a03]/40 dark:text-[#fbbf24] border border-[#F6E6C4]">
                <AlertTriangle className="h-3.5 w-3.5" />
                System Closed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#EEF4FF] text-[#1D60C9] dark:bg-[#172554]/40 dark:text-[#60a5fa] border border-[#D4E4FC]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Day Completed
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Not Logged In
            </span>
          )}
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300'
              : statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300'
              : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <Navigation className="h-4 w-4 shrink-0 animate-pulse" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold underline shrink-0 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Mini Cards Overview: Status, Duration, Accuracy, Sync */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Today's Status */}
        <div className="p-3 rounded-2xl bg-muted/40 border border-border space-y-1">
          <div className="text-[11px] font-bold text-muted-foreground">Today's Status</div>
          <div className="text-sm font-extrabold text-foreground truncate">
            {isActive ? 'Logged In' : isClosed ? (isSystemClosed ? 'System Closed' : 'Day Completed') : 'Not Logged In'}
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {currentSession?.date || getOperationalDateString()}
          </span>
        </div>

        {/* Card 2: Working Duration */}
        <div className="p-3 rounded-2xl bg-muted/40 border border-border space-y-1">
          <div className="text-[11px] font-bold text-muted-foreground">Working Duration</div>
          <div className="text-sm font-extrabold text-foreground truncate">
            {calculateDisplayDuration()}
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {isActive ? 'Live counter running' : isClosed ? 'Calculated on logout' : 'Pending start'}
          </span>
        </div>

        {/* Card 3: GPS Accuracy */}
        <div className="p-3 rounded-2xl bg-muted/40 border border-border space-y-1">
          <div className="text-[11px] font-bold text-muted-foreground">GPS Accuracy</div>
          <div className="text-sm font-extrabold text-foreground truncate">
            {loginLoc?.accuracy ? `±${Math.round(loginLoc.accuracy)}m` : 'Browser GPS'}
          </div>
          <span className="text-[10px] text-primary font-semibold block">
            {loginLoc ? 'Location Verified' : 'Awaiting check-in'}
          </span>
        </div>

        {/* Card 4: Synchronization */}
        <div className="p-3 rounded-2xl bg-muted/40 border border-border space-y-1">
          <div className="text-[11px] font-bold text-muted-foreground">Sync Status</div>
          <div className="text-sm font-extrabold text-foreground truncate">
            {currentSession?.syncStatus === 'saved_offline' ? 'Saved Offline' : currentSession ? 'Synced to Cloud' : 'Ready'}
          </div>
          <span className="text-[10px] text-muted-foreground block truncate">
            {user?.employeeId ? `ID: ${user.employeeId}` : 'Firestore'}
          </span>
        </div>
      </div>

      {/* 2-Column Section: Login Details vs Logout Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Box A: Login Details */}
        <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <LogIn className="h-4 w-4 text-[#228B4E]" />
              Login Details
            </span>
            {loginLoc && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenMap(loginLoc)}
                className="h-7 px-2.5 rounded-full text-[11px] font-semibold border-border hover:bg-muted gap-1 shadow-2xs"
              >
                <MapPin className="h-3 w-3 text-primary" />
                View Location
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
              </Button>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Login Time:</span>
              <span className="font-extrabold text-foreground">
                {currentSession?.loginTimestamp
                  ? formatCapturedTime(currentSession.loginTimestamp)
                  : 'Not logged in yet'}
              </span>
            </div>

            {loginLoc ? (
              <LocationDisplayCard
                location={loginLoc}
                label="Login Location (Captured on Login)"
                variant="compact"
                status={currentSession?.loginLocationStatus}
              />
            ) : (
              <div className="p-3 rounded-xl bg-card border border-dashed border-border text-[11px] text-muted-foreground text-center">
                Click <strong>Login</strong> to capture your initial GPS coordinates and address.
              </div>
            )}
          </div>
        </div>

        {/* Box B: Logout Details */}
        <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <LogOut className="h-4 w-4 text-[#DC5252]" />
              Logout Details
            </span>
            {logoutLoc && !isSystemClosed && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenMap(logoutLoc)}
                className="h-7 px-2.5 rounded-full text-[11px] font-semibold border-border hover:bg-muted gap-1 shadow-2xs"
              >
                <MapPin className="h-3 w-3 text-rose-600" />
                View Location
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
              </Button>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Logout Time:</span>
              <span className="font-extrabold text-foreground">
                {isSystemClosed
                  ? '11:59:59 PM (System Closed)'
                  : currentSession?.logoutTimestamp
                  ? formatCapturedTime(currentSession.logoutTimestamp)
                  : isActive
                  ? 'Active / Working'
                  : 'Pending'}
              </span>
            </div>

            {isSystemClosed ? (
              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  System Closed at Midnight Boundary
                </div>
                <p className="text-[10px] text-muted-foreground">
                  The employee did not perform manual logout before 11:59 PM. In strict accordance with ERP policy, no logout GPS was fabricated.
                </p>
              </div>
            ) : logoutLoc ? (
              <LocationDisplayCard
                location={logoutLoc}
                label="Logout Location (Captured on Logout)"
                variant="compact"
                status={currentSession?.logoutLocationStatus || undefined}
              />
            ) : isActive ? (
              <div className="p-3 rounded-xl bg-card border border-border text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Working in progress...</span>
                <span className="text-primary font-bold">{activeElapsedMinutes}m elapsed</span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-card border border-dashed border-border text-[11px] text-muted-foreground text-center">
                Logout details will be captured upon ending your attendance day.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer: Login / Logout Buttons */}
      <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {isClosed ? (
            <span className="inline-flex items-center gap-1.5 text-foreground font-semibold">
              <CheckCircle2 className="h-4 w-4 text-[#228B4E]" />
              Attendance for today ({currentSession?.date || getOperationalDateString()}) is completed. Both actions are locked.
            </span>
          ) : isActive ? (
            <span>
              Click <strong>Logout</strong> when you are ready to conclude your working day. Field activities will NOT be affected.
            </span>
          ) : (
            <span>
              Click <strong>Login</strong> to record your daily attendance with verified GPS coordinates and place name.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          {!currentSession || (!isActive && !isClosed) ? (
            /* Action: Login */
            <Button
              type="button"
              onClick={handleLogin}
              disabled={actionLoading || loading}
              className="w-full sm:w-auto bg-[#228B4E] hover:bg-[#176638] text-white font-bold text-xs h-10 px-6 rounded-full flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              <LogIn className={`h-4 w-4 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>{actionLoading ? 'Capturing GPS & Logging In...' : 'Login (Start Attendance)'}</span>
            </Button>
          ) : isActive ? (
            /* Action: Logout */
            <Button
              type="button"
              onClick={handleLogout}
              disabled={actionLoading || loading}
              className="w-full sm:w-auto bg-[#DC5252] hover:bg-[#b93838] text-white font-bold text-xs h-10 px-6 rounded-full flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              <LogOut className={`h-4 w-4 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>{actionLoading ? 'Capturing GPS & Logging Out...' : 'Logout (End Attendance)'}</span>
            </Button>
          ) : (
            /* Disabled when completed */
            <Button
              type="button"
              disabled
              className="w-full sm:w-auto bg-muted text-muted-foreground font-semibold text-xs h-10 px-6 rounded-full flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
            >
              <CheckCircle2 className="h-4 w-4 text-[#228B4E]" />
              <span>Attendance Completed</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
