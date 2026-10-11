'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import { DashboardStats, DailyReport } from '@/types';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function ManagerAnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/reports').then((res) => res.json()),
      fetch('/api/analytics').then((res) => res.json()),
    ])
      .then(([repData, statsData]) => {
        if (repData.reports) setReports(repData.reports);
        if (statsData.stats) setStats(statsData.stats);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-purple-600" /> Department Performance Analytics
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Reporting compliance rates, stakeholder visits, and submission volume for your assigned team.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">Department Overview Metrics</CardTitle>
          <CardDescription>Cumulative field achievements recorded by department staff</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100">
            <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Reports Logged</span>
            <span className="text-3xl font-black text-purple-800">{reports.length}</span>
          </div>
          <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100">
            <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Farmers Visited</span>
            <span className="text-3xl font-black text-purple-800">
              {reports.reduce((acc, r) => acc + (r.farmersVisited || 0), 0)}
            </span>
          </div>
          <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100">
            <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Group Meetings</span>
            <span className="text-3xl font-black text-purple-800">
              {reports.reduce((acc, r) => acc + (r.meetingsConducted || 0), 0)}
            </span>
          </div>
          <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100">
            <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Evidence Files</span>
            <span className="text-3xl font-black text-purple-800">
              {reports.reduce((acc, r) => acc + (r.attachments?.length || 0), 0)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Scoped Charts */}
      {stats && <AnalyticsCharts stats={stats} />}
    </div>
  );
}
