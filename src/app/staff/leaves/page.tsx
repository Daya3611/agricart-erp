'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CalendarOff,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  FileText,
  Filter,
  RotateCcw,
  ArrowRight,
  X,
} from 'lucide-react';
import { LeaveRecord, UserProfile } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LeaveModal } from '@/components/leaves/LeaveModal';
import { LeaveDetailsModal } from '@/components/leaves/LeaveDetailsModal';
import { formatReadableDate } from '@/lib/utils/date-utils';

export default function StaffLeavesPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [viewingLeave, setViewingLeave] = useState<LeaveRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessRes, leavesRes] = await Promise.all([
        fetch('/api/auth/session').then((r) => r.json()),
        fetch('/api/leaves').then((r) => r.json()),
      ]);

      if (sessRes.authenticated) setCurrentUser(sessRes.user);
      if (leavesRes.leaves) setLeaves(leavesRes.leaves);
    } catch (err) {
      console.error('Failed to load my leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingLeaves = leaves.filter((l) => l.approvalStatus === 'pending');
  const approvedLeaves = leaves.filter((l) => l.approvalStatus === 'approved');
  const rejectedLeaves = leaves.filter((l) => l.approvalStatus === 'rejected');
  const totalApprovedDays = approvedLeaves.reduce((acc, l) => acc + (l.daysCount || 0), 0);

  const filteredLeaves = leaves.filter((l) => {
    if (statusFilter === 'all') return true;
    return l.approvalStatus === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px] sm:text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-50 text-amber-900 border-amber-200 font-bold text-[10px] sm:text-xs">
            <Clock className="h-3 w-3 mr-1" /> Pending Approval
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-50 text-red-800 border-red-200 font-bold text-[10px] sm:text-xs">
            <XCircle className="h-3 w-3 mr-1" /> Rejected
          </Badge>
        );
      case 'draft':
      default:
        return (
          <Badge variant="outline" className="text-slate-600 font-bold text-[10px] sm:text-xs">
            Draft
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header & Request Leave Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              My Leaves & Time-Off Requests
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
            Apply for leave, track supervisor approvals, and view approved days on your monthly activity report.
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-10 min-h-[44px] rounded-full shadow-xs w-full sm:w-auto"
        >
          
          <span>Request Leave</span>
        </Button>
      </div>

      {/* 2. Top Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Applied</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{leaves.length}</span>
          </div>
          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <FileText className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Pending Review</span>
            <span className="text-xl sm:text-2xl font-black text-amber-900 leading-tight">{pendingLeaves.length}</span>
          </div>
          <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Approved Days</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-900 leading-tight">{totalApprovedDays}</span>
          </div>
          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">Monthly Sync</span>
            <span className="text-xs sm:text-sm font-extrabold text-purple-900 leading-tight block mt-1">Auto-Marked</span>
          </div>
          <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-700">
            <CalendarOff className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 3. Filter Panel */}
      <Card className="border border-slate-200/90 shadow-2xs">
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">Filter Leaves</span>
              <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {filteredLeaves.length} of {leaves.length}
              </span>
            </div>

            {statusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label htmlFor="leave-status" className="block text-[11px] font-bold text-slate-600 mb-1">
                Approval Status
              </label>
              <select
                id="leave-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <option value="all">All Applications</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {statusFilter !== 'all' && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                Status: <span className="capitalize font-bold">{statusFilter}</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="text-slate-400 hover:text-slate-700 ml-0.5"
                  aria-label="Remove filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Applications History */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Leave Applications History
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {filteredLeaves.length} {filteredLeaves.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        {loading ? (
          <div className="bg-white p-8 text-center rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <Clock className="h-6 w-6 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading leave applications...</p>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <CalendarOff className="h-8 w-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Leave Applications Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {statusFilter !== 'all'
                ? 'No leave requests match your selected status filter.'
                : 'You have not submitted any leave applications yet.'}
            </p>
            {statusFilter !== 'all' ? (
              <Button size="sm" variant="outline" onClick={() => setStatusFilter('all')} className="mt-2 text-xs font-bold">
                Clear Filter
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="mt-2 text-xs font-bold bg-emerald-700 text-white">
                Request Leave
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewed By</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeaves.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Badge variant="purple" className="capitalize text-[10px]">
                          {l.leaveType.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {formatReadableDate(l.startDate)} {l.startDate !== l.endDate ? `to ${formatReadableDate(l.endDate)}` : ''}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-emerald-800">
                        {l.daysCount} {l.daysCount === 1 ? 'day' : 'days'}
                        {l.isHalfDay && ' (Half)'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 max-w-xs truncate">
                        {l.reason}
                      </TableCell>
                      <TableCell>{getStatusBadge(l.approvalStatus)}</TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {l.approvedByName ? `Approved by ${l.approvedByName}` : l.rejectedByName ? `Rejected by ${l.rejectedByName}` : 'Awaiting Review'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingLeave(l)}
                          className="text-xs font-bold rounded-lg h-9"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards List (< 768px) */}
            <div className="md:hidden space-y-3">
              {filteredLeaves.map((l) => (
                <article
                  key={l.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3"
                >
                  {/* Top Row: Leave Type, Dates & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-slate-900 capitalize">
                          {l.leaveType.replace('_', ' ')} Leave
                        </h3>
                        {l.isHalfDay && (
                          <Badge variant="outline" className="text-[9px] uppercase font-bold text-purple-700 bg-purple-50 border-purple-200">
                            Half Day
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {formatReadableDate(l.startDate)}
                        {l.startDate !== l.endDate ? ` — ${formatReadableDate(l.endDate)}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0">{getStatusBadge(l.approvalStatus)}</div>
                  </div>

                  {/* Duration & Details */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      <span>{l.daysCount} {l.daysCount === 1 ? 'day absence' : 'days absence'}</span>
                    </span>

                    {l.halfDayType && (
                      <span className="text-[11px] text-purple-800 font-medium">
                        ({l.halfDayType === 'first_half' ? 'First Half: 09:00 - 13:30' : 'Second Half: 13:30 - 18:00'})
                      </span>
                    )}
                  </div>

                  {/* Reason Callout */}
                  {l.reason && (
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed italic">
                      "{l.reason}"
                    </div>
                  )}

                  {/* Review Note Callout */}
                  {l.approvalStatus === 'approved' && l.approvedByName && (
                    <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-100 text-xs text-emerald-900 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Approved by {l.approvedByName}</span>
                        <span className="text-[11px] text-slate-600">Absence will be marked on your official monthly record.</span>
                      </div>
                    </div>
                  )}

                  {l.approvalStatus === 'rejected' && (
                    <div className="p-2.5 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900 flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Rejected{l.rejectedByName ? ` by ${l.rejectedByName}` : ''}</span>
                        <span className="text-[11px] text-red-800 italic">{l.rejectionReason || 'No reason provided.'}</span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setViewingLeave(l)}
                      className="text-xs font-bold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                    >
                      <span>View Leave Details</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Add Leave Modal */}
      {currentUser && (
        <LeaveModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          currentUser={currentUser}
          employees={[currentUser]}
          preselectedStaffUid={currentUser.uid}
          onSuccess={loadData}
        />
      )}

      {/* 6. Details Modal */}
      {viewingLeave && (
        <LeaveDetailsModal
          leave={viewingLeave}
          open={Boolean(viewingLeave)}
          onOpenChange={() => setViewingLeave(null)}
        />
      )}
    </div>
  );
}

