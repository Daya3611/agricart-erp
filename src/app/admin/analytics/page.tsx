'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, FileSpreadsheet, FileText } from 'lucide-react';
import { DashboardStats, DailyReport } from '@/types';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { exportReportsToCSV, exportReportsToPDF } from '@/lib/utils/export-utils';

export default function AdminAnalyticsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-emerald-600" /> Analytics & Organizational Reports
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Analyze staff submission trends, department productivity, photo/video evidence availability, and export records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportReportsToCSV(reports)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 mr-1.5" /> Export All CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReportsToPDF(reports)}>
            <FileText className="h-4 w-4 text-rose-600 mr-1.5" /> Export All PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">Key Performance Indicators (KPIs)</CardTitle>
          <CardDescription>Agricart FPC staff activity & compliance metrics summary</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Total Reports Processed</span>
            <span className="text-3xl font-black text-emerald-700">{reports.length}</span>
          </div>
          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Farmers Visited Total</span>
            <span className="text-3xl font-black text-emerald-700">
              {reports.reduce((acc, r) => acc + (r.farmersVisited || 0), 0)}
            </span>
          </div>
          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Meetings Conducted</span>
            <span className="text-3xl font-black text-emerald-700">
              {reports.reduce((acc, r) => acc + (r.meetingsConducted || 0), 0)}
            </span>
          </div>
          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Evidence Files Uploaded</span>
            <span className="text-3xl font-black text-emerald-700">
              {reports.reduce((acc, r) => acc + (r.attachments?.length || 0), 0)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Charts */}
      {stats && <AnalyticsCharts stats={stats} />}
    </div>
  );
}
