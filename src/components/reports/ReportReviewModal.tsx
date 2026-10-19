'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  History,
  User,
  Building2,
  MapPin,
  FileEdit,
  ShieldCheck,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import { DailyReport, UserProfile } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AttachmentGallery } from './AttachmentGallery';
import { formatReadableDateTime } from '@/lib/utils/date-utils';
import { RequestEditDialog } from './RequestEditDialog';

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
  const [requestEditOpen, setRequestEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    setComment('');
    setFeedback(null);
    setRequestEditOpen(false);
  }, [report?.id, open]);

  if (!report) return null;

  const isAuthorizedReviewer = ['super_admin', 'admin', 'manager'].includes(currentUser.role);

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

  const handleEditRequestSuccess = () => {
    onOpenChange(false);
    if (onRefresh) onRefresh();
  };

  const statusBadges: Record<string, { label: string; variant: any }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    submitted: { label: 'Submitted (Awaiting Review)', variant: 'info' },
    under_review: { label: 'Under Review', variant: 'info' },
    correction_requested: { label: 'Correction Requested', variant: 'destructive' },
    edit_requested: { label: 'Edit Requested', variant: 'destructive' },
    resubmitted: { label: 'Resubmitted Revision', variant: 'purple' },
    approved: { label: 'Approved', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Review Daily Activity Report - ${report.reportDate}`}
        description={`Submitted by ${report.staffName} (${report.employeeId})`}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          {/* Status Header & Meta Info */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/40 rounded-xl border border-border">
            <div className="flex flex-wrap items-center gap-2">
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
            <div className="text-xs text-muted-foreground font-medium">
              Submitted: <span className="font-bold text-foreground">{formatReadableDateTime(report.submittedAt)}</span>
              {report.resubmittedAt && (
                <span className="ml-2 text-purple-600 dark:text-purple-400 font-bold">
                  • Resubmitted: {formatReadableDateTime(report.resubmittedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Staff & Location Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-primary/5 p-4 rounded-xl border border-primary/20">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <div>
                <p className="font-semibold text-muted-foreground">Employee</p>
                <p className="font-bold text-foreground">{report.staffName} ({report.employeeId})</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <div>
                <p className="font-semibold text-muted-foreground">Department</p>
                <p className="font-bold text-foreground">{report.departmentName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <div>
                <p className="font-semibold text-muted-foreground">Center / Location</p>
                <p className="font-bold text-foreground">{report.centerName} ({report.workLocation})</p>
              </div>
            </div>
          </div>

          {/* Activity Details Breakdown (Read-Only) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border pb-1">
              Work Performed & Achievements
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 bg-card rounded-xl border border-border">
                <span className="text-xs font-bold text-muted-foreground block mb-1">Activities Performed Today</span>
                <p className="text-sm text-foreground whitespace-pre-wrap">{report.activities || 'N/A'}</p>
              </div>

              <div className="p-3.5 bg-card rounded-xl border border-border">
                <span className="text-xs font-bold text-muted-foreground block mb-1">Tasks Completed</span>
                <p className="text-sm text-foreground whitespace-pre-wrap">{report.completedTasks || 'N/A'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-muted/40 rounded-xl border border-border">
                <span className="text-[11px] font-bold text-muted-foreground block uppercase">Farmers Visited</span>
                <span className="text-xl font-black text-primary">{report.farmersVisited || 0}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border">
                <span className="text-[11px] font-bold text-muted-foreground block uppercase">Meetings Conducted</span>
                <span className="text-xl font-black text-primary">{report.meetingsConducted || 0}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border">
                <span className="text-[11px] font-bold text-muted-foreground block uppercase">Work Start Time</span>
                <span className="text-sm font-bold text-foreground">{report.workStartTime || '09:00'}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border">
                <span className="text-[11px] font-bold text-muted-foreground block uppercase">Work End Time</span>
                <span className="text-sm font-bold text-foreground">{report.workEndTime || '18:00'}</span>
              </div>
            </div>

            {report.challenges && (
              <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/60">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" /> Challenges & Issues Faced
                </span>
                <p className="text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap">{report.challenges}</p>
              </div>
            )}

            {report.nextDayPlan && (
              <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-primary shrink-0" /> Plan for Next Working Day
                </span>
                <p className="text-xs text-foreground whitespace-pre-wrap">{report.nextDayPlan}</p>
              </div>
            )}
          </div>

          {/* Evidence Attachments */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b border-border pb-1">
              Work Photo & Video Evidence
            </h3>
            <AttachmentGallery attachments={report.attachments || []} />
          </div>

          {/* Review Decision & Action Footer */}
          {report.status === 'approved' ? (
            /* ========================================================
               1. APPROVED STATUS: LOCKED ACTIONS & REQUEST EDIT
               ======================================================== */
            <div className="pt-4 border-t border-border space-y-4">
              {/* Approved Status Banner */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/60 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">This Report is Approved</h4>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                      {report.reviewerName || report.lastApproval?.reviewerName ? (
                        <>
                          Reviewed and approved by{' '}
                          <span className="font-semibold text-emerald-950 dark:text-emerald-100">
                            {report.reviewerName || report.lastApproval?.reviewerName}
                          </span>
                          {(report.reviewedAt || report.lastApproval?.decidedAt) &&
                            ` on ${formatReadableDateTime(report.reviewedAt || report.lastApproval?.decidedAt)}`}.
                        </>
                      ) : (
                        'This activity report has been approved and marked complete.'
                      )}
                    </p>
                    {(report.reviewComments || report.lastApproval?.comments) && (
                      <div className="mt-2 text-xs text-foreground bg-card p-2.5 rounded-lg border border-border">
                        <span className="font-semibold block text-[11px] text-primary">Reviewer Note:</span>
                        "{report.reviewComments || report.lastApproval?.comments}"
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant="default" className="bg-emerald-700 hover:bg-emerald-800 text-white shrink-0 font-bold">
                  Approved
                </Badge>
              </div>

              {/* Actions Footer for Approved State: Approve & Reject are hidden */}
              <div className="p-3.5 bg-muted/40 rounded-xl border border-border flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground font-medium">
                  Standard review actions (Approve & Reject) are locked because this report is already approved.
                </p>

                <div className="flex items-center gap-2.5">
                  {isAuthorizedReviewer && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRequestEditOpen(true)}
                      className="rounded-full border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 font-bold text-xs shadow-2xs"
                    >
                      <FileEdit className="h-3.5 w-3.5 mr-1.5 text-amber-600 dark:text-amber-400" />
                      Request Edit
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="rounded-full px-5 text-xs font-bold border-border text-foreground hover:bg-muted"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          ) : report.status === 'edit_requested' || report.status === 'correction_requested' ? (
            /* ========================================================
               2. EDIT REQUESTED: WAITING FOR EMPLOYEE REVISION
               ======================================================== */
            <div className="pt-4 border-t border-border space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                      Edit Requested (Waiting for Employee Revision)
                    </h4>
                  </div>
                  <Badge variant="warning" className="text-[10px] font-bold">Pending Revision</Badge>
                </div>

                <div className="p-3 bg-card rounded-lg border border-border text-xs text-foreground space-y-1">
                  <p>
                    <span className="font-bold text-amber-800 dark:text-amber-300">Reason:</span>{' '}
                    {report.editRequest?.reason || report.reviewComments || 'Revisions requested by reviewer.'}
                  </p>
                  {report.editRequest?.instructions && (
                    <p>
                      <span className="font-bold text-amber-800 dark:text-amber-300">Instructions:</span>{' '}
                      {report.editRequest.instructions}
                    </p>
                  )}
                  {report.editRequest?.requesterName && (
                    <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                      Requested by {report.editRequest.requesterName} on {formatReadableDateTime(report.editRequest.requestedAt)}
                    </p>
                  )}
                </div>

                {report.lastApproval && (
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 italic">
                    ℹ️ Previous approval by {report.lastApproval.reviewerName} on{' '}
                    {formatReadableDateTime(report.lastApproval.decidedAt)} is on hold pending employee revision.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border text-xs">
                <span className="text-muted-foreground font-medium">
                  Approval decisions are paused until the employee resubmits their revisions.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="rounded-full px-5 text-xs font-bold border-border text-foreground hover:bg-muted"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : report.status === 'resubmitted' ? (
            /* ========================================================
               3. RESUBMITTED: REVIEW REVISED REPORT (NEW DECISION)
               ======================================================== */
            <div className="pt-4 border-t border-border space-y-4">
              <div className="p-4 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                    <h4 className="text-sm font-bold text-purple-950 dark:text-purple-200">
                      Revised Report Resubmitted for Review (Revision #{report.revisionNumber})
                    </h4>
                  </div>
                  <Badge variant="purple" className="text-[10px] font-bold">Resubmitted</Badge>
                </div>

                {report.editRequest?.reason && (
                  <div className="p-3 bg-card rounded-lg border border-border text-xs text-foreground">
                    <span className="font-bold text-purple-800 dark:text-purple-300 block mb-0.5">Original Edit Request Reason:</span>
                    <p className="italic">"{report.editRequest.reason}"</p>
                  </div>
                )}

                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 font-medium">
                  ⚠️ <strong>Notice:</strong> The previous approval no longer represents this revised report. Please review the updated work details and make a fresh decision.
                </div>
              </div>

              {/* Revision Review Form */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-primary" /> Reviewer Comments for Resubmission
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add review notes for this resubmitted revision..."
                  className="w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                />

                {feedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold ${
                      feedback.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleReviewAction('rejected')}
                    disabled={submitting}
                    className="rounded-full px-5 text-xs font-bold border-rose-300 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1 text-rose-600 dark:text-rose-400" /> Reject Revision
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => handleReviewAction('approved')}
                    disabled={submitting}
                    className="rounded-full px-5 text-xs font-bold bg-[#228B4E] hover:bg-[#176638] text-white shadow-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Revision
                  </Button>
                </div>
              </div>
            </div>
          ) : report.status === 'rejected' ? (
            /* ========================================================
               4. REJECTED: LOCKED IN READ-ONLY
               ======================================================== */
            <div className="pt-4 border-t border-border space-y-3">
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-950 dark:text-rose-200">This Report is Rejected</h4>
                    <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5">
                      {report.reviewerName ? (
                        <>
                          Rejected by <span className="font-semibold text-rose-950 dark:text-rose-100">{report.reviewerName}</span>
                          {report.reviewedAt ? ` on ${formatReadableDateTime(report.reviewedAt)}` : ''}.
                        </>
                      ) : (
                        'This activity report has been marked rejected.'
                      )}
                    </p>
                    {report.reviewComments && (
                      <div className="mt-2 text-xs text-foreground bg-card p-2.5 rounded-lg border border-border">
                        <span className="font-semibold block text-[11px] text-rose-800 dark:text-rose-300">Rejection Reason:</span>
                        "{report.reviewComments}"
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant="destructive" className="shrink-0 font-bold">
                  Rejected
                </Badge>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="rounded-full px-5 text-xs font-bold border-border text-foreground hover:bg-muted"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            /* ========================================================
               5. SUBMITTED / UNDER REVIEW: STANDARD INITIAL REVIEW
               ======================================================== */
            <div className="pt-4 border-t border-border space-y-3">
              {report.reviewComments && (
                <div className="p-4 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-900/60 text-xs">
                  <span className="font-bold text-sky-900 dark:text-sky-200 block mb-1">Previous Review Comments:</span>
                  <p className="text-sky-900 dark:text-sky-300 font-medium italic">"{report.reviewComments}"</p>
                  <p className="text-[10px] text-sky-700 dark:text-sky-400 mt-1">
                    Reviewed by {report.reviewerName} on {formatReadableDateTime(report.reviewedAt)}
                  </p>
                </div>
              )}

              <label className="text-xs font-bold text-foreground block flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-primary" /> Reviewer Comments & Notes
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add comments for staff member (required if requesting corrections)..."
                className="w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold ${
                    feedback.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200'
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
                  className="rounded-full px-5 text-xs font-bold border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400" /> Request Correction
                </Button>
                <Button
                  variant="default"
                  onClick={() => handleReviewAction('approved')}
                  disabled={submitting}
                  className="rounded-full px-5 text-xs font-bold bg-[#228B4E] hover:bg-[#176638] text-white shadow-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Report
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      {/* Separate Request Edit Dialog */}
      {isAuthorizedReviewer && (
        <RequestEditDialog
          open={requestEditOpen}
          onOpenChange={setRequestEditOpen}
          report={report}
          onSuccess={handleEditRequestSuccess}
        />
      )}
    </>
  );
}
