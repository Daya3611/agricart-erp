'use client';

import React, { useState } from 'react';
import { Search, Filter, RefreshCw, FileSpreadsheet, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { FilterParams, Department, Center } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

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
  const [mobileExpanded, setMobileExpanded] = useState(false);

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

  // Calculate how many non-default filters are active
  const activeFiltersCount = [
    filters.datePreset && filters.datePreset !== 'today',
    Boolean(filters.departmentId),
    Boolean(filters.centerId),
    filters.status && filters.status !== 'all',
    Boolean(filters.searchQuery?.trim()),
  ].filter(Boolean).length;

  return (
    <div className="bg-card p-4 sm:p-5 rounded-[22px] border border-border shadow-2xs space-y-4">
      {/* Mobile Top Controls: Search + Filter Toggle Button */}
      <div className="lg:hidden flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search staff, ID, task..."
            value={filters.searchQuery || ''}
            onChange={(e) => handleChange('searchQuery', e.target.value)}
            className="pl-9 h-10 text-xs rounded-full border-border focus:border-primary/40 focus:ring-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          className={cn(
            'flex items-center gap-1.5 px-3.5 h-10 rounded-full text-xs font-semibold border transition-colors shrink-0 touch-manipulation',
            activeFiltersCount > 0 || mobileExpanded
              ? 'bg-[#E8F5EC] dark:bg-[#173822] border-[#CDE7D4] dark:border-[#1E4A2E] text-[#176638] dark:text-[#34D399] font-bold'
              : 'bg-card border-border text-foreground hover:bg-muted'
          )}
          aria-expanded={mobileExpanded}
          aria-label="Toggle filters"
        >
          <Filter className="h-4 w-4 text-primary" />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 min-w-[16px] justify-center">
              {activeFiltersCount}
            </Badge>
          )}
          {mobileExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 ml-0.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 ml-0.5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Filter Selects: Collapsible on Mobile, Full Grid on Desktop */}
      <div
        className={cn(
          'gap-3',
          mobileExpanded ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'hidden lg:grid lg:grid-cols-6'
        )}
      >
        {/* Date Preset Selector */}
        <div>
          <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
            Date Range
          </label>
          <Select
            value={filters.datePreset || 'today'}
            onChange={(e) => handleChange('datePreset', e.target.value)}
            className="rounded-xl text-xs"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="this_month">Current Month</option>
            <option value="fy">Financial Year</option>
            <option value="all">All Dates</option>
          </Select>
        </div>

        {/* Department Filter */}
        <div>
          <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
            Department
          </label>
          <Select
            value={filters.departmentId || ''}
            onChange={(e) => handleChange('departmentId', e.target.value)}
            className="rounded-xl text-xs"
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
          <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
            Center / Location
          </label>
          <Select
            value={filters.centerId || ''}
            onChange={(e) => handleChange('centerId', e.target.value)}
            className="rounded-xl text-xs"
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
          <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
            Report Status
          </label>
          <Select
            value={filters.status || 'all'}
            onChange={(e) => handleChange('status', e.target.value)}
            className="rounded-xl text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="resubmitted">Resubmitted Revision</option>
            <option value="approved">Approved</option>
            <option value="edit_requested">Edit Requested</option>
            <option value="correction_requested">Correction Requested</option>
            <option value="draft">Draft</option>
            <option value="missing">Missing / Overdue</option>
          </Select>
        </div>

        {/* Search Query (Desktop only in grid) */}
        <div className="hidden lg:block lg:col-span-2">
          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
            Search Staff / Task
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by staff name, ID, or activity..."
              value={filters.searchQuery || ''}
              onChange={(e) => handleChange('searchQuery', e.target.value)}
              className="pl-9 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* Toolbar Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="text-muted-foreground hover:text-foreground h-9 px-2.5 text-xs font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Reset Filters
        </Button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {onExportCSV && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCSV}
              className="h-9 px-3 text-xs font-semibold border-border"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mr-1" /> Export CSV
            </Button>
          )}
          {onExportPDF && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPDF}
              className="h-9 px-3 text-xs font-semibold border-border"
            >
              <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 mr-1" /> Export PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
