'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';

export interface ChartDataPoint {
  label: string;
  series1: number; // e.g. Submitted or Approved
  series2: number; // e.g. Missing or In Review
}

interface VertixIncomeChartProps {
  title?: string;
  subtitle?: string;
  legendSeries1?: string;
  legendSeries2?: string;
  data?: ChartDataPoint[];
  loading?: boolean;
}

export function VertixIncomeChart({
  title = 'Reporting Activity',
  subtitle = 'Daily report submissions and verification status',
  legendSeries1 = 'Approved',
  legendSeries2 = 'Submitted',
  data = [],
  loading = false,
}: VertixIncomeChartProps) {
  const hasData =
    data &&
    data.length > 0 &&
    data.some((d) => (d.series1 || 0) > 0 || (d.series2 || 0) > 0);

  // Calculate dynamic maximum domain for Y-Axis
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.series1 || 0, d.series2 || 0)),
    5
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-xl p-2.5 shadow-lg text-xs space-y-1">
          <p className="font-bold text-foreground">{label}</p>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">{legendSeries1}:</span>
            <span className="font-bold text-foreground">
              {payload[0]?.value ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#252923] dark:bg-muted-foreground" />
            <span className="text-muted-foreground">{legendSeries2}:</span>
            <span className="font-bold text-foreground">
              {payload[1]?.value ?? 0}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6 rounded-[22px] h-full flex flex-col justify-between">
      {/* Header matching original layout */}
      <div className="space-y-1 mb-4">
        <h3 className="text-base font-extrabold text-foreground tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>

        {/* Legend row */}
        <div className="flex items-center justify-between pt-3">
          <span className="text-xs font-bold text-foreground">Activity Breakdown</span>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span>{legendSeries1}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#252923] dark:bg-muted-foreground" />
              <span>{legendSeries2}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bar Chart Container / Clean Honest Empty State */}
      <div className="h-48 sm:h-56 w-full -ml-3">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Loading reporting activity...
          </div>
        ) : !hasData ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 ml-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-2">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold text-foreground">
              No reporting data available
            </p>
            <p className="text-[11px] text-muted-foreground max-w-[220px] mt-0.5">
              Activity history will appear as daily reports are submitted and verified.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              barGap={3}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-border opacity-60"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'currentColor', fontWeight: 500 }}
                className="text-muted-foreground"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor' }}
                className="text-muted-foreground"
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, Math.ceil(maxVal * 1.2)]}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'currentColor', opacity: 0.05 }}
              />
              {/* Primary Accent Green Bar */}
              <Bar
                dataKey="series1"
                name={legendSeries1}
                fill="#228B4E"
                radius={[5, 5, 0, 0]}
                barSize={12}
              />
              {/* Charcoal / Theme-aware Second Bar */}
              <Bar
                dataKey="series2"
                name={legendSeries2}
                fill="var(--chart-2)"
                radius={[5, 5, 0, 0]}
                barSize={12}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
