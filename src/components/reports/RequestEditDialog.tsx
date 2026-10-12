'use client';

import React, { useState } from 'react';
import { AlertTriangle, Send, Calendar, User, Building2, MapPin, X } from 'lucide-react';
import { DailyReport } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatReadableDate } from '@/lib/utils/date-utils';

interface RequestEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: DailyReport;
  onSuccess: () => void;
}

export function RequestEditDialog({
  open,
  onOpenChange,
  report,
  onSuccess,
}: RequestEditDialogProps) {
  const [reason, setReason] = useState('');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setReason('');
      setInstructions('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      setError('Please provide a valid reason for requesting an edit.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/reports/${report.id}/request-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason.trim(),
          instructions: instructions.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit edit request.');
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Request Report Edit"
      description="Reopen this approved report and send revision instructions to the staff member."
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Report & Staff Summary Card */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-700" />
              <span className="font-extrabold text-slate-900 text-xs">
                Report Date: {formatReadableDate(report.reportDate)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-semibold">Status:</span>
              <Badge variant="default" className="bg-emerald-700 text-white text-[10px] font-bold">
                Approved
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 font-medium">Employee</p>
                <p className="font-bold text-slate-900 truncate">{report.staffName} ({report.employeeId})</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 font-medium">Department</p>
                <p className="font-bold text-slate-900 truncate">{report.departmentName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Notice */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Submitting this request will change the status to <strong>Edit Requested</strong>. The employee will be notified to revise and resubmit. The original approval record is preserved in the audit history.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800">
            {error}
          </div>
        )}

        {/* Form Inputs */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Reason for Requesting Edit <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">Required</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Clearly explain why this approved report needs revision..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 shadow-2xs focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Specific Instructions for Employee</span>
              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
            </label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Update visited farmer counts, correct start time, or re-upload missing field photos..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 shadow-2xs focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Dialog Actions: rounded pill buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            className="rounded-full px-5 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={submitting || !reason.trim()}
            className="rounded-full px-5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
          >
            {submitting ? (
              'Submitting...'
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" /> Send Edit Request
              </>
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
