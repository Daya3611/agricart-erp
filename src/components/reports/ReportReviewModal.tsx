'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, AlertTriangle, MessageSquare, History, User, Building2, MapPin } from 'lucide-react';
import { DailyReport, UserProfile } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AttachmentGallery } from './AttachmentGallery';
import { formatReadableDateTime } from '@/lib/utils/date-utils';

interface ReportReviewModalProps {
  report: DailyReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserProfile;
  onRefresh?: () => void;
}

export function ReportReviewModal({
  report,
  open,
  onOpenChange,
  currentUser,
  onRefresh,
}: ReportReviewModalProps) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!report) return null;

  const handleReviewAction = async (actionStatus: 'approved' | 'correction_requested' | 'rejected') => {
    if (actionStatus === 'correction_requested' && !comment.trim()) {
      setFeedback({ type: 'error', message: 'Please provide reviewer comments explaining the required corrections.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/reports/${report.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: actionStatus, actionStatus, comment }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update report status.');
      }

      setFeedback({ type: 'success', message: `Report successfully updated to ${actionStatus.replace('_', ' ')}!` });
      setTimeout(() => {
        onOpenChange(false);
        if (onRefresh) onRefresh();
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadges: Record<string, { label: string; variant: any }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    submitted: { label: 'Submitted (Awaiting Review)', variant: 'info' },
    under_review: { label: 'Under Review', variant: 'info' },
    correction_requested: { label: 'Correction Requested', variant: 'destructive' },
    approved: { label: 'Approved', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Review Daily Activity Report - ${report.reportDate}`}
      description={`Submitted by ${report.staffName} (${report.employeeId})`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Status Header & Meta Info */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-2">
            <Badge variant={statusBadges[report.status]?.variant || 'secondary'}>
              {statusBadges[report.status]?.label || report.status}
            </Badge>
            {report.isLate && (
              <Badge variant="warning" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Late Submission
              </Badge>
            )}
            {report.revisionNumber > 1 && (
              <Badge variant="purple" className="flex items-center gap-1">
                <History className="h-3 w-3" /> Revision #{report.revisionNumber}
              </Badge>
            )}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Submitted: <span className="font-bold text-slate-800">{formatReadableDateTime(report.submittedAt)}</span>
          </div>
        </div>

        {/* Staff & Location Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="font-semibold text-slate-500">Employee</p>
              <p className="font-bold text-slate-900">{report.staffName} ({report.employeeId})</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="font-semibold text-slate-500">Department</p>
              <p className="font-bold text-slate-900">{report.departmentName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="font-semibold text-slate-500">Center / Location</p>
              <p className="font-bold text-slate-900">{report.centerName} ({report.workLocation})</p>
            </div>
          </div>
        </div>

        {/* Activity Details Breakdown */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-emerald-700 border-b border-emerald-100 pb-1">
            Work Performed & Achievements
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 block mb-1">Activities Performed Today</span>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{report.activities || 'N/A'}</p>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 block mb-1">Tasks Completed</span>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{report.completedTasks || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">Farmers Visited</span>
              <span className="text-xl font-black text-emerald-700">{report.farmersVisited || 0}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">Meetings Conducted</span>
              <span className="text-xl font-black text-emerald-700">{report.meetingsConducted || 0}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">Work Start Time</span>
              <span className="text-sm font-bold text-slate-800">{report.workStartTime || '09:00'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">Work End Time</span>
              <span className="text-sm font-bold text-slate-800">{report.workEndTime || '18:00'}</span>
            </div>
          </div>

          {report.challenges && (
            <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200">
              <span className="text-xs font-bold text-amber-900 block mb-1">⚠️ Challenges & Issues Faced</span>
              <p className="text-xs text-amber-900 whitespace-pre-wrap">{report.challenges}</p>
            </div>
          )}

          {report.nextDayPlan && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 block mb-1">📋 Plan for Next Working Day</span>
              <p className="text-xs text-slate-800 whitespace-pre-wrap">{report.nextDayPlan}</p>
            </div>
          )}
        </div>

        {/* Evidence Attachments */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-emerald-700 border-b border-emerald-100 pb-1">
            Work Photo & Video Evidence
          </h3>
          <AttachmentGallery attachments={report.attachments || []} />
        </div>

        {/* Existing Reviewer Comments if any */}
        {report.reviewComments && (
          <div className="p-4 bg-sky-50 rounded-xl border border-sky-200 text-xs">
            <span className="font-bold text-sky-900 block mb-1">Previous Review Comments:</span>
            <p className="text-sky-900 font-medium italic">"{report.reviewComments}"</p>
            <p className="text-[10px] text-sky-700 mt-1">
              Reviewed by {report.reviewerName} on {formatReadableDateTime(report.reviewedAt)}
            </p>
          </div>
        )}

        {/* Review Action Form */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-emerald-600" /> Reviewer Comments & Notes
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add comments for Staff (required if requesting corrections)..."
            className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />

          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-bold ${feedback.type === 'success' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                }`}
            >
              {feedback.message}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handleReviewAction('correction_requested')}
              disabled={submitting}
              className="border-amber-300 text-amber-800 hover:bg-amber-50"
            >
              <XCircle className="h-4 w-4 mr-1 text-amber-600" /> Request Correction
            </Button>
            <Button
              variant="default"
              onClick={() => handleReviewAction('approved')}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve Report
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
