'use client';

import React from 'react';
import { History, User, Building2, MapPin, Calendar, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { LeaveRecord } from '@/types';

interface LeaveDetailsModalProps {
  leave: LeaveRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaveDetailsModal({ leave, open, onOpenChange }: LeaveDetailsModalProps) {
  if (!leave) return null;

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
      title="Leave Record Details"
      description={`Leave Ref #${leave.id.slice(-8)} — ${leave.staffName}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pt-1 text-xs">
        {/* Status Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Status:</span>
            <Badge variant={statusVariant} className="uppercase font-bold text-[11px]">
              {leave.approvalStatus}
            </Badge>
            <Badge variant="purple" className="capitalize font-bold text-[11px]">
              {leave.leaveType.replace('_', ' ')}
            </Badge>
          </div>

          <div className="text-slate-500 font-medium">
            Recorded: {new Date(leave.createdAt).toLocaleString('en-IN')}
          </div>
        </div>

        {/* Employee Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
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

        {/* Duration Cards */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">From</span>
            <span className="text-xs font-bold text-slate-800 mt-0.5 block">{leave.startDate}</span>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">To</span>
            <span className="text-xs font-bold text-slate-800 mt-0.5 block">{leave.endDate}</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Days</span>
            <span className="text-sm font-black text-emerald-900 mt-0.5 block">
              {leave.daysCount} {leave.daysCount === 1 ? 'Day' : 'Days'}
              {leave.isHalfDay && ' (Half)'}
            </span>
          </div>
        </div>

        {/* Reason */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="font-bold text-slate-700 block">Reason / Purpose:</span>
          <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{leave.reason}</p>
        </div>

        {/* Rejection Note if rejected */}
        {leave.rejectionReason && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-1">
            <span className="font-bold block">Rejection Note:</span>
            <p className="italic">{leave.rejectionReason}</p>
            <p className="text-[10px] text-rose-700 mt-1">
              Rejected by {leave.rejectedByName || 'Supervisor'} on {leave.rejectedAt ? new Date(leave.rejectedAt).toLocaleString('en-IN') : 'Recent'}
            </p>
          </div>
        )}

        {/* Audit Trail History */}
        <div className="space-y-2 pt-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-emerald-800">
            <History className="h-4 w-4" /> Status Change Audit Trail
          </h4>

          {leave.auditHistory && leave.auditHistory.length > 0 ? (
            <div className="space-y-2">
              {leave.auditHistory.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 capitalize">{item.status}</span>
                      <span className="text-[10px] text-slate-500">by {item.actorName} ({item.actorRole})</span>
                    </div>
                    {item.note && <p className="text-slate-700 text-[11px]">{item.note}</p>}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 text-center">
              No previous audit history recorded.
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
