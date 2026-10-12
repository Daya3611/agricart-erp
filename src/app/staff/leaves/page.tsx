'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Plus, Clock, CheckCircle2, XCircle, AlertCircle, Eye, FileText } from 'lucide-react';
import { LeaveRecord, UserProfile } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LeaveModal } from '@/components/leaves/LeaveModal';
import { LeaveDetailsModal } from '@/components/leaves/LeaveDetailsModal';

export default function StaffLeavesPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
  const totalApprovedDays = approvedLeaves.reduce((acc, l) => acc + (l.daysCount || 0), 0);

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
            <Calendar className="h-6 w-6 text-emerald-600" /> My Leaves & Time-Off Requests
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Apply for leave, track manager verification, and view approved days on your monthly activity report.
          </p>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Request Leave
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Applications</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{leaves.length}</span>
              <span className="text-xs text-slate-500 font-medium">All Time</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Pending Review</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-800">{pendingLeaves.length}</span>
              <span className="text-xs text-amber-700 font-medium">In Queue</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Approved Leaves</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-800">{approvedLeaves.length}</span>
              <span className="text-xs text-emerald-700 font-bold">{totalApprovedDays} Days Total</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block">Reporting Impact</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xs font-bold text-purple-900">Auto Marked</span>
              <span className="text-xs text-purple-700 font-medium">"On Leave"</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaves History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">
            My Leave Applications History
          </CardTitle>
          <CardDescription>
            Official records reflected in your monthly employee performance report
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading leave applications...</div>
          ) : leaves.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-slate-100 text-xs text-slate-500">
              No leave records found. Click "Request Leave" above to submit an absence request.
            </div>
          ) : (
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
                {leaves.map((l) => (
                  <TableRow key={l.id}>
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
                    <TableCell className="text-xs text-slate-700 max-w-xs truncate">
                      {l.reason}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadges[l.approvalStatus]?.variant || 'secondary'}>
                        {statusBadges[l.approvalStatus]?.label || l.approvalStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {l.approvedByName ? `Approved by ${l.approvedByName}` : l.rejectedByName ? `Rejected by ${l.rejectedByName}` : 'Awaiting Review'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingLeave(l)}
                        className="text-xs font-bold"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Leave Modal */}
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
