'use client';

import React from 'react';
import { Search, Filter, Calendar, RefreshCw, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { FilterParams, Department, Center } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface FilterToolbarProps {
  filters: FilterParams;
  onFilterChange: (newFilters: FilterParams) => void;
  departments: Department[];
  centers: Center[];
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

export function FilterToolbar({
  filters,
  onFilterChange,
  departments,
  centers,
  onExportCSV,
  onExportPDF,
}: FilterToolbarProps) {
  const handleChange = (key: keyof FilterParams, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onFilterChange({
      datePreset: 'today',
      departmentId: '',
      centerId: '',
      status: 'all',
      searchQuery: '',
    });
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Date Preset Selector */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Date Range</label>
          <Select
            value={filters.datePreset || 'today'}
            onChange={(e) => handleChange('datePreset', e.target.value)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="this_month">Current Month</option>
            <option value="fy">Financial Year</option>
          </Select>
        </div>

        {/* Department Filter */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Department</label>
          <Select
            value={filters.departmentId || ''}
            onChange={(e) => handleChange('departmentId', e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Center Filter */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Center / Location</label>
          <Select
            value={filters.centerId || ''}
            onChange={(e) => handleChange('centerId', e.target.value)}
          >
            <option value="">All Centers</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Report Status</label>
          <Select
            value={filters.status || 'all'}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="correction_requested">Correction Requested</option>
            <option value="draft">Draft</option>
            <option value="missing">Missing / Overdue</option>
          </Select>
        </div>

        {/* Search Query */}
        <div className="lg:col-span-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Search Staff / Task</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by staff name, employee ID, or activity..."
              value={filters.searchQuery || ''}
              onChange={(e) => handleChange('searchQuery', e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Toolbar Footer Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <Button variant="ghost" size="sm" onClick={resetFilters} className="text-slate-500">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset Filters
        </Button>

        <div className="flex items-center gap-2">
          {onExportCSV && (
            <Button variant="outline" size="sm" onClick={onExportCSV}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 mr-1" /> Export CSV
            </Button>
          )}
          {onExportPDF && (
            <Button variant="outline" size="sm" onClick={onExportPDF}>
              <FileText className="h-3.5 w-3.5 text-rose-600 mr-1" /> Export PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
