'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Plus, Clock, CheckCircle2, XCircle, Search, Filter, Eye, ShieldCheck, UserCheck } from 'lucide-react';
import { LeaveRecord, UserProfile, Department, Center } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RecordCard,
  RecordCardHeader,
  RecordCardTitle,
  RecordCardSubtitle,
  RecordCardContent,
  RecordCardRow,
  RecordCardActions,
} from '@/components/ui/record-card';
import { LeaveModal } from '@/components/leaves/LeaveModal';
import { LeaveReviewModal } from '@/components/leaves/LeaveReviewModal';
import { LeaveDetailsModal } from '@/components/leaves/LeaveDetailsModal';

export default function AdminLeavesPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusTab, setStatusTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [reviewingLeave, setReviewingLeave] = useState<LeaveRecord | null>(null);
  const [viewingLeave, setViewingLeave] = useState<LeaveRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessRes, leavesRes, staffRes, deptRes] = await Promise.all([
        fetch('/api/auth/session').then((r) => r.json()),
        fetch('/api/leaves').then((r) => r.json()),
        fetch('/api/staff?limit=100').then((r) => r.json()),
        fetch('/api/departments').then((r) => r.json()),
      ]);

      if (sessRes.authenticated) setCurrentUser(sessRes.user);
      if (leavesRes.leaves) setLeaves(leavesRes.leaves);
      if (staffRes.users) setEmployees(staffRes.users);
      if (deptRes.departments) setDepartments(deptRes.departments);
    } catch (err) {
      console.error('Failed to load leave records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter leaves
  const filteredLeaves = leaves.filter((l) => {
    if (statusTab !== 'all' && l.approvalStatus !== statusTab) return false;
    if (leaveTypeFilter !== 'all' && l.leaveType !== leaveTypeFilter) return false;
    if (deptFilter !== 'all' && l.departmentId !== deptFilter) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = l.staffName.toLowerCase().includes(q);
      const matchEmpId = l.employeeId.toLowerCase().includes(q);
      const matchReason = l.reason.toLowerCase().includes(q);
      if (!matchName && !matchEmpId && !matchReason) return false;
    }
    return true;
  });

  // KPI counts
  const pendingCount = leaves.filter((l) => l.approvalStatus === 'pending').length;
  const approvedCount = leaves.filter((l) => l.approvalStatus === 'approved').length;
  const rejectedCount = leaves.filter((l) => l.approvalStatus === 'rejected').length;

  const statusBadges: Record<string, { label: string; variant: any }> = {
    pending: { label: 'Pending Approval', variant: 'warning' },
    approved: { label: 'Approved', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
    draft: { label: 'Draft', variant: 'secondary' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-emerald-600" /> Employee Leave & Absence Management
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage employee leaves, review pending absence requests, and synchronize approved time-off with monthly activity logs.
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Record / Apply Leave
        </Button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Leaves</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{leaves.length}</span>
              <span className="text-xs text-slate-500 font-medium">Recorded</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Pending Approval</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-800">{pendingCount}</span>
              <span className="text-xs text-amber-700 font-bold">Action Needed</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Approved Leaves</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-800">{approvedCount}</span>
              <span className="text-xs text-emerald-700 font-bold">Active</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/40">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Rejected</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-800">{rejectedCount}</span>
              <span className="text-xs text-rose-600 font-medium">Denied</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Tab Controls */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Status Tabs */}
            <Tabs value={statusTab} onValueChange={setStatusTab}>
              <TabsList>
                <TabsTrigger value="all">All ({leaves.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
                <TabsTrigger value="rejected">Rejected ({rejectedCount})</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Quick Search */}
            <div className="w-full sm:w-64">
              <Input
                type="search"
                pill
                placeholder="Search employee or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Leave Type:</span>
              <Select
                pill
                value={leaveTypeFilter}
                onChange={(e) => setLeaveTypeFilter(e.target.value)}
                className="w-40 text-xs"
              >
                <option value="all">All Types</option>
                <option value="casual">Casual (CL)</option>
                <option value="sick">Sick (SL)</option>
                <option value="earned">Earned (EL)</option>
                <option value="unpaid">Unpaid (LWP)</option>
                <option value="half_day">Half-Day</option>
                <option value="compensatory">Comp-Off</option>
                <option value="other">Other</option>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Department:</span>
              <Select
                pill
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-44 text-xs"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>

            {(leaveTypeFilter !== 'all' || deptFilter !== 'all' || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLeaveTypeFilter('all');
                  setDeptFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-slate-500"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leave Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">
            Leave Applications ({filteredLeaves.length})
          </CardTitle>
          <CardDescription>
            Audit log of employee absences, supervisor reviews, and monthly reporting statuses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading leave records...</div>
          ) : filteredLeaves.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-slate-100 text-xs text-slate-500">
              No leave applications found matching selected criteria.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department / Center</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeaves.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div>
                            <p className="font-bold text-slate-900">{l.staffName}</p>
                            <p className="text-[11px] text-slate-500 font-semibold">{l.employeeId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-medium text-slate-800">{l.departmentName || 'Field Operations'}</p>
                          <p className="text-[11px] text-slate-500">{l.centerName || 'Main Center'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="purple" className="capitalize text-[10px]">
                            {l.leaveType.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                          {l.startDate} {l.startDate !== l.endDate ? `to ${l.endDate}` : ''}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-emerald-800">
                          {l.daysCount} {l.daysCount === 1 ? 'day' : 'days'}
                          {l.isHalfDay && ' (Half)'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadges[l.approvalStatus]?.variant || 'secondary'}>
                            {statusBadges[l.approvalStatus]?.label || l.approvalStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                          {l.approvalStatus === 'pending' && currentUser && (
                            <Button
                              size="sm"
                              onClick={() => setReviewingLeave(l)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                            >
                              <UserCheck className="h-3.5 w-3.5 mr-1" /> Review
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingLeave(l)}
                            className="text-xs font-bold"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Record Cards (< 768px) */}
              <div className="md:hidden space-y-3">
                {filteredLeaves.map((l) => (
                  <RecordCard key={l.id}>
                    <RecordCardHeader>
                      <div className="min-w-0 flex-1">
                        <RecordCardTitle className="truncate">{l.staffName}</RecordCardTitle>
                        <RecordCardSubtitle>
                          {l.employeeId} • {l.departmentName || 'Field Operations'}
                        </RecordCardSubtitle>
                      </div>
                      <Badge
                        variant={statusBadges[l.approvalStatus]?.variant || 'secondary'}
                        className="text-[10px] shrink-0"
                      >
                        {statusBadges[l.approvalStatus]?.label || l.approvalStatus}
                      </Badge>
                    </RecordCardHeader>

                    <RecordCardContent>
                      <RecordCardRow
                        label="Leave Type"
                        value={
                          <Badge variant="purple" className="capitalize text-[10px]">
                            {l.leaveType.replace('_', ' ')}
                          </Badge>
                        }
                      />
                      <RecordCardRow
                        label="Duration"
                        value={
                          <span className="text-emerald-800 font-bold">
                            {l.daysCount} {l.daysCount === 1 ? 'day' : 'days'}
                            {l.isHalfDay ? ' (Half Day)' : ''}
                          </span>
                        }
                      />
                      <RecordCardRow
                        label="Dates"
                        value={
                          <span>
                            {l.startDate} {l.startDate !== l.endDate ? `to ${l.endDate}` : ''}
                          </span>
                        }
                      />
                      {l.centerName && (
                        <RecordCardRow label="Center" value={l.centerName} />
                      )}
                      {l.reason && (
                        <div className="p-2.5 bg-slate-50 rounded-lg text-slate-600 italic text-[11px] mt-1 border border-slate-100">
                          &ldquo;{l.reason}&rdquo;
                        </div>
                      )}
                    </RecordCardContent>

                    <RecordCardActions>
                      {l.approvalStatus === 'pending' && currentUser && (
                        <Button
                          size="sm"
                          onClick={() => setReviewingLeave(l)}
                          className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-10"
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Review
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingLeave(l)}
                        className={`font-bold text-xs h-10 ${l.approvalStatus === 'pending' && currentUser ? 'flex-1' : 'w-full'}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> View Details
                      </Button>
                    </RecordCardActions>
                  </RecordCard>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Leave Modal */}
      {currentUser && (
        <LeaveModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          currentUser={currentUser}
          employees={employees}
          onSuccess={loadData}
        />
      )}

      {/* Review Modal */}
      {reviewingLeave && currentUser && (
        <LeaveReviewModal
          leave={reviewingLeave}
          open={Boolean(reviewingLeave)}
          onOpenChange={() => setReviewingLeave(null)}
          currentUser={currentUser}
          onRefresh={loadData}
        />
      )}

      {/* Details Modal */}
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
