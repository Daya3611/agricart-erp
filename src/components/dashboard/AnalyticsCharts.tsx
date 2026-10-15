'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DashboardStats } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface AnalyticsChartsProps {
  stats: DashboardStats;
}

export function AnalyticsCharts({ stats }: AnalyticsChartsProps) {
  const pieData = [
    { name: 'Submitted / Approved', value: stats.reportsSubmittedToday, color: '#16a34a' },
    { name: 'Awaiting Review', value: stats.awaitingApprovalCount, color: '#0284c7' },
    { name: 'Correction Requested', value: stats.correctionRequestedCount, color: '#e11d48' },
    { name: 'Missing / Overdue', value: stats.missingReportsToday, color: '#d97706' },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Weekly Submission Trend Area Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
            <span>Weekly Reporting Submission Trend</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              Live Firestore Analytics
            </span>
          </CardTitle>
          <CardDescription>Comparison between expected daily reports and actual staff submissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weeklyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="submitted" name="Submitted Reports" stroke="#15803d" strokeWidth={2.5} fill="#15803d" fillOpacity={0.12} />
                <Area type="monotone" dataKey="missing" name="Missing Reports" stroke="#b45309" strokeWidth={2} strokeDasharray="4 4" fill="#b45309" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">Today's Report Status Breakdown</CardTitle>
          <CardDescription>Real-time submission state distribution</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center">
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full space-y-1.5 mt-2">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Department Completion Bar Chart */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">Department-wise Submission Completion Rates (%)</CardTitle>
          <CardDescription>Track reporting performance across organizational departments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.deptCompletionRates} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, 'Completion Rate']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', borderColor: '#e2e8f0' }}
                />
                <Bar dataKey="rate" name="Completion Rate (%)" fill="#16a34a" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Center Completion Bar Chart */}
      {stats.centerCompletionRates && stats.centerCompletionRates.length > 0 && (
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">Procurement & Storage Center Completion Rates (%)</CardTitle>
            <CardDescription>Track submission rates across physical packhouses and distribution hubs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.centerCompletionRates} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    formatter={(value: any) => [`${value}%`, 'Completion Rate']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', borderColor: '#e2e8f0' }}
                  />
                  <Bar dataKey="rate" name="Center Completion Rate (%)" fill="#0284c7" radius={[8, 8, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Reporting Trends Area/Bar Chart */}
      {stats.monthlyTrends && stats.monthlyTrends.length > 0 && (
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">Monthly Reporting Submission Trends</CardTitle>
            <CardDescription>Historic 6-month submission performance and volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', borderColor: '#e2e8f0' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="submitted" name="Submitted Reports" fill="#16a34a" radius={[6, 6, 0, 0]} barSize={32} />
                  <Bar dataKey="missing" name="Missing Reports" fill="#d97706" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
