'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  MapPin,
  Clock,
  User,
  Building2,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Radio,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LocationDisplayCard } from '@/components/reports/LocationDisplayCard';
import { formatCapturedTime } from '@/lib/utils/geolocation';

interface ActiveEmployeeRecord {
  reportId: string;
  staffUid: string;
  staffName: string;
  employeeId: string;
  departmentName: string;
  centerName: string;
  reportDate: string;
  activeActivity: any;
  completedCount: number;
  totalDurationMinutes: number;
}

interface CompletedActivityRecord {
  reportId: string;
  staffUid: string;
  staffName: string;
  employeeId: string;
  departmentName: string;
  centerName: string;
  reportDate: string;
  activity: any;
}

export function AdminLiveActivityTracker({ onSelectReport }: { onSelectReport?: (reportId: string) => void }) {
  const [activeList, setActiveList] = useState<ActiveEmployeeRecord[]>([]);
  const [completedList, setCompletedList] = useState<CompletedActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchLiveData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/field-reports/live');
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveList(data.activeEmployees || []);
        setCompletedList(data.recentCompletedActivities || []);
        setLastRefreshed(new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }));
      }
    } catch (err) {
      console.warn('Failed to fetch live activity tracking:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000); // 30s polling
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-emerald-900/20 dark:border-emerald-500/20 shadow-xs mb-6 overflow-hidden">
      <CardHeader className="bg-emerald-950/5 dark:bg-emerald-950/20 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
              </span>
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Field Operations: Live Activity Monitor
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time tracking of staff in the field with start/end GPS locations & human-readable addresses
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 font-bold text-xs py-1 px-2.5">
              <Radio className="h-3.5 w-3.5 mr-1.5 text-emerald-600 animate-pulse" />
              {activeList.length} Active Now
            </Badge>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchLiveData}
              disabled={loading}
              className="text-xs h-8 rounded-lg"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh {lastRefreshed && `(${lastRefreshed})`}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-6">
        {/* Currently Active Employees */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            Currently Active Activities ({activeList.length})
          </h4>

          {activeList.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
              No staff members currently have an activity marked <strong className="text-foreground">IN PROGRESS</strong> right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeList.map((emp) => {
                const act = emp.activeActivity;
                const startTime = formatCapturedTime(act.activityStartAt || act.activityStart);
                const startLoc = act.activityStartLocation || act.activityStartGps;

                // Live duration calculation
                let elapsedMins = 0;
                if (act.activityStartAt || act.activityStart) {
                  const s = new Date(act.activityStartAt || act.activityStart).getTime();
                  if (!isNaN(s)) {
                    elapsedMins = Math.max(0, Math.round((Date.now() - s) / 60000));
                  }
                }

                return (
                  <div
                    key={`${emp.staffUid}_${act.slotNumber}`}
                    className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/15 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-emerald-900/10 pb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{emp.staffName}</span>
                          <span className="text-[11px] text-muted-foreground">({emp.employeeId})</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Building2 className="h-3 w-3 text-muted-foreground/70" />
                          <span>{emp.departmentName}</span>
                          <span>•</span>
                          <span>{emp.centerName}</span>
                        </div>
                      </div>

                      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] animate-pulse">
                        ● IN PROGRESS
                      </Badge>
                    </div>

                    {/* Activity Title & Village */}
                    <div className="bg-card/70 p-2.5 rounded-lg border border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">
                          Activity #{act.slotNumber}: {act.activityNameLabel || act.activityName?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          Active for {elapsedMins} mins
                        </span>
                      </div>
                      {act.activityName !== 'desk_job' && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Village: <strong className="text-foreground">{act.village || 'Not specified'}</strong>
                          {act.wadi && ` (${act.wadi})`}
                        </p>
                      )}
                    </div>

                    {/* Start Location with full details */}
                    <LocationDisplayCard
                      location={startLoc}
                      label={`Start Location (Started ${startTime})`}
                      status={act.activityStartLocationStatus}
                    />

                    {/* Footer Actions */}
                    {onSelectReport && (
                      <div className="pt-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectReport(emp.reportId)}
                          className="text-xs h-7 text-primary hover:bg-primary/10 font-bold"
                        >
                          <Eye className="h-3 w-3 mr-1" /> View Today's Full Report
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recently Completed Activities Stream */}
        {completedList.length > 0 && (
          <div className="pt-3 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Recent Completed Activities Today ({completedList.length})
            </h4>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground text-[11px]">
                    <th className="p-2.5 text-left font-bold">Employee</th>
                    <th className="p-2.5 text-left font-bold">Activity</th>
                    <th className="p-2.5 text-left font-bold">Village</th>
                    <th className="p-2.5 text-left font-bold">Start Location</th>
                    <th className="p-2.5 text-left font-bold">End Location</th>
                    <th className="p-2.5 text-right font-bold">Duration</th>
                    <th className="p-2.5 text-center font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {completedList.slice(0, 8).map((item, idx) => {
                    const act = item.activity;
                    const startLoc = act.activityStartLocation || act.activityStartGps;
                    const endLoc = act.activityEndLocation || act.activityEndGps;

                    return (
                      <tr key={idx} className="hover:bg-muted/20 transition-colors">
                        <td className="p-2.5 font-bold text-foreground whitespace-nowrap">
                          {item.staffName}
                          <span className="block text-[10px] text-muted-foreground font-normal">{item.employeeId}</span>
                        </td>
                        <td className="p-2.5">
                          <span className="font-semibold">{act.activityNameLabel || act.activityName?.replace(/_/g, ' ')}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {formatCapturedTime(act.activityStartAt || act.activityStart)} - {formatCapturedTime(act.activityEndAt || act.activityEnd)}
                          </span>
                        </td>
                        <td className="p-2.5 text-muted-foreground whitespace-nowrap">
                          {act.activityName === 'desk_job' ? 'Office' : (act.village || '—')}
                        </td>
                        <td className="p-2.5 max-w-[180px]">
                          <LocationDisplayCard location={startLoc} variant="compact" />
                        </td>
                        <td className="p-2.5 max-w-[180px]">
                          <LocationDisplayCard location={endLoc} variant="compact" />
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-primary whitespace-nowrap">
                          {act.durationMinutes || act.activityDurationMinutes || 0}m
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] text-emerald-800 bg-emerald-50 border-emerald-200">
                            Completed
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
