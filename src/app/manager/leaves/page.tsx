'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Plus, Clock, CheckCircle2, XCircle, Search, Eye, UserCheck, Users } from 'lucide-react';
import { LeaveRecord, UserProfile } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function ManagerLeavesPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [teamStaff, setTeamStaff] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusTab, setStatusTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [reviewingLeave, setReviewingLeave] = useState<LeaveRecord | null>(null);
  const [viewingLeave, setViewingLeave] = useState<LeaveRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessRes, leavesRes, staffRes] = await Promise.all([
        fetch('/api/auth/session').then((r) => r.json()),
        fetch('/api/leaves').then((r) => r.json()),
        fetch('/api/staff').then((r) => r.json()),
      ]);

      if (sessRes.authenticated) setCurrentUser(sessRes.user);
      if (leavesRes.leaves) setLeaves(leavesRes.leaves);
      if (staffRes.users) setTeamStaff(staffRes.users);
    } catch (err) {
      console.error('Failed to load team leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLeaves = leaves.filter((l) => {
    if (statusTab !== 'all' && l.approvalStatus !== statusTab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = l.staffName.toLowerCase().includes(q);
      const matchEmpId = l.employeeId.toLowerCase().includes(q);
      if (!matchName && !matchEmpId) return false;
    }
    return true;
  });

  const pendingCount = leaves.filter((l) => l.approvalStatus === 'pending').length;
  const approvedCount = leaves.filter((l) => l.approvalStatus === 'approved').length;

  const statusBadges: Record<string, { label: string; variant: any }> = {
    pending: { label: 'Pending Approval', variant: 'warning' },
    approved: { label: 'Approved', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
    draft: { label: 'Draft', variant: 'secondary' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600" /> Team Leave & Absence Requests
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Review and approve leave applications for staff in your assigned department and centers.
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-purple-700 hover:bg-purple-800 text-white font-bold"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Apply Leave for Team Member
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Team Leaves</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{leaves.length}</span>
              <span className="text-xs text-slate-500 font-medium">Logged</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Pending Reviews</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-800">{pendingCount}</span>
              <span className="text-xs text-amber-700 font-bold">Action Required</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Approved Leaves</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-800">{approvedCount}</span>
              <span className="text-xs text-emerald-700 font-bold">Active</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <Tabs value={statusTab} onValueChange={setStatusTab}>
            <TabsList>
              <TabsTrigger value="all">All ({leaves.length})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="w-full sm:w-64">
            <Input
              type="search"
              pill
              placeholder="Search team member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Team Leaves Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">
            Team Leaves Directory ({filteredLeaves.length})
          </CardTitle>
          <CardDescription>
            Absence requests and verified days for department reporting
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading team leave records...</div>
          ) : filteredLeaves.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-slate-100 text-xs text-slate-500">
              No leave records found.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
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
                          <p className="font-bold text-slate-900">{l.staffName}</p>
                          <p className="text-[11px] text-slate-500">{l.employeeId}</p>
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
                          {l.approvalStatus === 'pending' && currentUser && currentUser.uid !== l.staffUid && (
                            <Button
                              size="sm"
                              onClick={() => setReviewingLeave(l)}
                              className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs"
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
                          {l.employeeId} • {l.startDate} {l.startDate !== l.endDate ? `to ${l.endDate}` : ''}
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
                      {l.reason && (
                        <div className="p-2.5 bg-slate-50 rounded-lg text-slate-600 italic text-[11px] mt-1 border border-slate-100">
                          &ldquo;{l.reason}&rdquo;
                        </div>
                      )}
                    </RecordCardContent>

                    <RecordCardActions>
                      {l.approvalStatus === 'pending' && currentUser && currentUser.uid !== l.staffUid && (
                        <Button
                          size="sm"
                          onClick={() => setReviewingLeave(l)}
                          className="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs h-10"
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Review
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingLeave(l)}
                        className={`font-bold text-xs h-10 ${l.approvalStatus === 'pending' && currentUser && currentUser.uid !== l.staffUid ? 'flex-1' : 'w-full'}`}
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

      {/* Add Modal */}
      {currentUser && (
        <LeaveModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          currentUser={currentUser}
          employees={teamStaff}
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
