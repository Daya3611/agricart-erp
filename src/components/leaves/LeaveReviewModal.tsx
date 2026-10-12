'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, User, Building2, MapPin, Calendar, Clock, MessageSquare } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LeaveRecord, UserProfile } from '@/types';

interface LeaveReviewModalProps {
  leave: LeaveRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserProfile;
  onRefresh?: () => void;
}

export function LeaveReviewModal({
  leave,
  open,
  onOpenChange,
  currentUser,
  onRefresh,
}: LeaveReviewModalProps) {
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!leave) return null;

  // Non-negotiable policy: Prevent self-approval
  const isSelfApproval = currentUser.uid === leave.staffUid;

  const handleReviewAction = async (action: 'approved' | 'rejected') => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (action === 'rejected' && (!rejectionReason.trim() || rejectionReason.trim().length < 3)) {
      setErrorMsg('Please specify a rejection reason explaining why the leave is denied (min 3 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/leaves/${leave.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejectionReason: action === 'rejected' ? rejectionReason.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update leave status.');
      }

      setSuccessMsg(`Leave request successfully ${action.toUpperCase()}!`);
      setTimeout(() => {
        onOpenChange(false);
        setRejectionReason('');
        setSuccessMsg(null);
        if (onRefresh) onRefresh();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusVariant =
    leave.approvalStatus === 'approved'
      ? 'default'
      : leave.approvalStatus === 'rejected'
      ? 'destructive'
      : 'warning';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Review Leave Application"
      description={`Leave request submitted for ${leave.staffName} (${leave.employeeId})`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pt-1 text-xs">
        {/* Status Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Current Status:</span>
            <Badge variant={statusVariant} className="uppercase text-[11px] font-bold">
              {leave.approvalStatus}
            </Badge>
            <Badge variant="purple" className="capitalize text-[11px] font-bold">
              {leave.leaveType.replace('_', ' ')}
            </Badge>
          </div>

          <div className="text-slate-500 font-medium">
            Requested on {new Date(leave.createdAt).toLocaleDateString('en-IN')}
          </div>
        </div>

        {/* Self-approval Warning */}
        {isSelfApproval && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 font-semibold flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Self-Approval Prohibited</p>
              <p className="text-[11px] mt-0.5 text-amber-800">
                Company policy prevents users from approving or rejecting their own leave requests. Another administrator or supervisor must review this application.
              </p>
            </div>
          </div>
        )}

        {/* Employee Summary Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100/90">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-700 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 font-semibold block">Employee</span>
              <span className="font-bold text-slate-900">{leave.staffName}</span>
              <span className="text-[10px] text-slate-500 block">{leave.employeeId}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-700 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 font-semibold block">Department</span>
              <span className="font-bold text-slate-900">{leave.departmentName || 'Field Operations'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-700 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 font-semibold block">Center</span>
              <span className="font-bold text-slate-900">{leave.centerName || 'Main Center'}</span>
            </div>
          </div>
        </div>

        {/* Dates & Duration Details */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Start Date</span>
            <span className="text-sm font-black text-slate-800 mt-0.5 block">{leave.startDate}</span>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">End Date</span>
            <span className="text-sm font-black text-slate-800 mt-0.5 block">{leave.endDate}</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Duration</span>
            <span className="text-base font-black text-emerald-900 mt-0.5 block">
              {leave.daysCount} {leave.daysCount === 1 ? 'Day' : 'Days'}
              {leave.isHalfDay && ' (Half)'}
            </span>
          </div>
        </div>

        {/* Reason Box */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 space-y-1 shadow-2xs">
          <span className="font-bold text-slate-700 block">Reason for Leave:</span>
          <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{leave.reason}</p>
        </div>

        {/* Supporting Attachment */}
        {leave.attachmentUrl && (
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Supporting Attachment Provided:</span>
            <a
              href={leave.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 underline font-bold hover:text-emerald-800"
            >
              View Document
            </a>
          </div>
        )}

        {/* Existing Decision / Rejection details if already reviewed */}
        {leave.rejectionReason && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-1">
            <span className="font-bold block">Previous Rejection Reason:</span>
            <p className="italic">{leave.rejectionReason}</p>
            <p className="text-[10px] text-rose-700 mt-1">
              Rejected by {leave.rejectedByName || 'Supervisor'} on {leave.rejectedAt ? new Date(leave.rejectedAt).toLocaleString('en-IN') : 'Recent'}
            </p>
          </div>
        )}

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Review Action Form (Visible when pending and not self-approval) */}
        {leave.approvalStatus === 'pending' && !isSelfApproval && (
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> Rejection Remarks (Required if rejecting):
              </label>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain the reason if you need to reject this leave request..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => handleReviewAction('rejected')}
                disabled={submitting}
                className="border-rose-300 text-rose-700 hover:bg-rose-50 font-bold"
              >
                <XCircle className="h-4 w-4 mr-1 text-rose-600" /> Reject Leave
              </Button>
              <Button
                onClick={() => handleReviewAction('approved')}
                disabled={submitting}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve Leave
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
