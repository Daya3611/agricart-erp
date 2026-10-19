'use client';

import React, { useState } from 'react';
import {
  Search,
  ChevronDown,
  Sprout,
  Users,
  FileText,
  Eye,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DailyReport } from '@/types';
import { formatReadableDate } from '@/lib/utils/date-utils';

interface VertixRecentActivitiesProps {
  reports: DailyReport[];
  loading?: boolean;
  onSelectReport?: (report: DailyReport) => void;
}

export function VertixRecentActivities({
  reports = [],
  loading = false,
  onSelectReport,
}: VertixRecentActivitiesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'approved' | 'submitted' | 'under_review' | 'correction_requested' | 'draft'
  >('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredReports = reports.filter((r) => {
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'submitted' &&
        (r.status === 'submitted' || r.status === 'under_review' || r.status === 'resubmitted')) ||
      (statusFilter === 'correction_requested' &&
        (r.status === 'correction_requested' || r.status === 'edit_requested')) ||
      r.status === statusFilter;

    if (!matchesStatus) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    return (
      (r.staffName && r.staffName.toLowerCase().includes(q)) ||
      (r.employeeId && r.employeeId.toLowerCase().includes(q)) ||
      (r.activities && r.activities.toLowerCase().includes(q)) ||
      (r.departmentName && r.departmentName.toLowerCase().includes(q)) ||
      (r.id && r.id.toLowerCase().includes(q))
    );
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredReports.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredReports.map((r) => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const formatReportId = (r: DailyReport) => {
    if (r.id && r.id.length > 6) {
      return `REP_${r.id.substring(r.id.length - 6).toUpperCase()}`;
    }
    return `REP_${(r.employeeId || '0000').replace(/\D/g, '').padStart(4, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#228B4E] dark:text-[#4ade80]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#228B4E] dark:bg-[#4ade80]" />
            Approved
          </span>
        );
      case 'submitted':
      case 'under_review':
      case 'resubmitted':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1D60C9] dark:text-[#60a5fa]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1D60C9] dark:bg-[#60a5fa]" />
            In Review
          </span>
        );
      case 'correction_requested':
      case 'edit_requested':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D99A28] dark:text-[#fbbf24]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D99A28] dark:bg-[#fbbf24]" />
            Correction
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            Draft
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#DC5252] dark:text-[#f87171]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#DC5252] dark:bg-[#f87171]" />
            Pending
          </span>
        );
    }
  };

  const getActivityIcon = (index: number) => {
    if (index % 3 === 0) return Sprout;
    if (index % 3 === 1) return Users;
    return FileText;
  };

  return (
    <Card className="p-6 rounded-[22px]">
      {/* Table Header: Title + Search Pill + Filter Pill */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <h3 className="text-base font-extrabold text-foreground tracking-tight">
          Recent Activities
        </h3>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Search Input Pill */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search activities..."
              className="w-full h-9 pl-9 pr-3 rounded-full bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          {/* Filter Dropdown Pill */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="appearance-none h-9 pl-3.5 pr-8 rounded-full bg-card border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-primary cursor-pointer hover:bg-muted transition-colors"
            >
              <option value="all">Filter: All</option>
              <option value="approved">Approved</option>
              <option value="submitted">In Review</option>
              <option value="correction_requested">Correction</option>
              <option value="draft">Draft</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          Loading recent activity records...
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No reporting activities found matching your criteria.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-bold text-[11px]">
                <th className="py-3 px-2 w-8">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === filteredReports.length &&
                      filteredReports.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">Report ID</th>
                <th className="py-3 px-3">Activities &amp; Details</th>
                <th className="py-3 px-3">Field Coverage</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredReports.slice(0, 8).map((report, idx) => {
                const ActivityIcon = getActivityIcon(idx);
                const isSelected = selectedIds.includes(report.id);

                return (
                  <tr
                    key={report.id || idx}
                    className={`hover:bg-muted/50 transition-colors cursor-pointer group ${
                      isSelected ? 'bg-primary-light/30' : ''
                    }`}
                    onClick={() => onSelectReport?.(report)}
                  >
                    {/* Checkbox */}
                    <td
                      className="py-3.5 px-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(report.id)}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>

                    {/* Report ID */}
                    <td className="py-3.5 px-3 font-bold text-foreground whitespace-nowrap">
                      {formatReportId(report)}
                    </td>

                    {/* Activity & Staff */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0">
                          <ActivityIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate max-w-[180px] sm:max-w-xs">
                            {report.activities || 'Field inspection & consultation'}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {report.staffName} • {report.departmentName || report.workLocation || 'Field Ops'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Real Field Coverage (Farmers visited & meetings) */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-foreground">
                        {report.farmersVisited || 0} Farmers
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {report.meetingsConducted || 0} Meetings
                      </div>
                    </td>

                    {/* Status with dot */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {getStatusBadge(report.status)}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-3 text-muted-foreground font-medium whitespace-nowrap">
                      {report.reportDate ? formatReadableDate(report.reportDate) : 'Today'}
                    </td>

                    {/* Action Menu */}
                    <td
                      className="py-3.5 px-2 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelectReport?.(report)}
                        className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="View Report"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
