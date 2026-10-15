'use client';

import React from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Paperclip,
  ExternalLink,
  Users,
  Briefcase,
  History,
  X,
} from 'lucide-react';
import { DailyReport, ReportAttachment } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatReadableDate, formatReadableDateTime } from '@/lib/utils/date-utils';

interface ReportDetailsDialogProps {
  report: DailyReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showHistoryLink?: boolean;
}

export function ReportDetailsDialog({
  report,
  open,
  onOpenChange,
  showHistoryLink = true,
}: ReportDetailsDialogProps) {
  if (!report) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
          </Badge>
        );
      case 'submitted':
      case 'under_review':
      case 'resubmitted':
        return (
          <Badge className="bg-amber-50 text-amber-900 border-amber-200 font-bold text-xs">
            <Clock className="h-3 w-3 mr-1" /> {status === 'resubmitted' ? 'Resubmitted' : 'Awaiting Review'}
          </Badge>
        );
      case 'correction_requested':
      case 'edit_requested':
        return (
          <Badge className="bg-rose-50 text-rose-800 border-rose-200 font-bold text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" /> {status === 'edit_requested' ? 'Edit Requested' : 'Correction Required'}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-50 text-red-800 border-red-200 font-bold text-xs">
            <XCircle className="h-3 w-3 mr-1" /> Rejected
          </Badge>
        );
      case 'draft':
      default:
        return (
          <Badge variant="outline" className="text-slate-600 font-bold text-xs">
            Draft
          </Badge>
        );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Daily Activity Report - ${formatReadableDate(report.reportDate)}`}
      description={`Staff: ${report.staffName || 'Staff Member'} (${report.employeeId || ''})`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 max-h-[72vh] overflow-y-auto text-xs pr-1">
        {/* Header Status Strip */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">Status:</span>
            {getStatusBadge(report.status)}
            {report.revisionNumber > 1 && (
              <Badge variant="purple" className="text-[10px] font-bold">
                Revision #{report.revisionNumber}
              </Badge>
            )}
            {report.isLate && (
              <Badge variant="warning" className="text-[10px] font-bold">
                Late Submission
              </Badge>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            {report.submittedAt ? (
              <span>Submitted: {formatReadableDateTime(report.submittedAt)}</span>
            ) : (
              <span>Created: {formatReadableDateTime(report.createdAt)}</span>
            )}
          </div>
        </div>

        {/* Supervisor Feedback or Edit Request Banner */}
        {(report.editRequest?.reason || report.reviewComments) && (
          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 block">
                {report.status === 'edit_requested' || report.status === 'correction_requested'
                  ? 'Revision Instructions from Supervisor:'
                  : 'Supervisor Review Feedback:'}
              </span>
              <span className="text-[10px] text-amber-800 font-medium">
                {report.reviewerName || report.editRequest?.requesterName || 'Reviewer'}
              </span>
            </div>
            <p className="text-slate-800 italic leading-relaxed">
              "{report.editRequest?.reason || report.reviewComments}"
            </p>
            {report.editRequest?.instructions && (
              <div className="p-2 bg-white/80 rounded-xl border border-amber-200/80 text-[11px] text-amber-950 font-medium mt-1">
                <span className="font-bold block text-amber-900 mb-0.5">Instructions:</span>
                {report.editRequest.instructions}
              </div>
            )}
          </div>
        )}

        {/* Schedule & Operational Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Work Location
            </span>
            <div className="flex items-center gap-1.5 text-slate-900 font-bold truncate">
              <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{report.workLocation || 'Field Operations'}</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Shift Timing
            </span>
            <div className="flex items-center gap-1.5 text-slate-900 font-bold">
              <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>{report.workStartTime || '09:00'} — {report.workEndTime || '18:00'}</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Engagement Counts
            </span>
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
              <Users className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>{report.farmersVisited || 0} Farmers | {report.meetingsConducted || 0} Mtgs</span>
            </div>
          </div>
        </div>

        {/* Activities Performed */}
        <div>
          <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block mb-1">
            Activities Performed
          </span>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-800 whitespace-pre-wrap leading-relaxed">
            {report.activities || 'No activities specified.'}
          </div>
        </div>

        {/* Tasks Completed */}
        <div>
          <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block mb-1">
            Tasks Completed
          </span>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-800 whitespace-pre-wrap leading-relaxed">
            {report.completedTasks || 'No completed tasks specified.'}
          </div>
        </div>

        {/* Achievements & Challenges Grid */}
        {(report.achievements || report.challenges) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {report.achievements && (
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block mb-1">
                  Key Achievements
                </span>
                <p className="text-slate-800 leading-relaxed">{report.achievements}</p>
              </div>
            )}
            {report.challenges && (
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                  Challenges Encountered
                </span>
                <p className="text-slate-800 leading-relaxed">{report.challenges}</p>
              </div>
            )}
          </div>
        )}

        {/* Pending Work & Next Day Plan */}
        {(report.pendingWork || report.nextDayPlan) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {report.pendingWork && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Pending Work
                </span>
                <p className="text-slate-800 leading-relaxed">{report.pendingWork}</p>
              </div>
            )}
            {report.nextDayPlan && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Plan for Next Working Day
                </span>
                <p className="text-slate-800 leading-relaxed">{report.nextDayPlan}</p>
              </div>
            )}
          </div>
        )}

        {/* Remarks */}
        {report.remarks && (
          <div>
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block mb-1">
              General Remarks
            </span>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-slate-700">
              {report.remarks}
            </div>
          </div>
        )}

        {/* Attachments Section */}
        {report.attachments && report.attachments.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
              Uploaded Evidence Attachments ({report.attachments.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {report.attachments.map((att: ReportAttachment) => (
                <div
                  key={att.id}
                  className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-900 block truncate">{att.originalFilename}</span>
                    {att.caption && (
                      <span className="text-[10px] text-emerald-800 italic block truncate">
                        "{att.caption}"
                      </span>
                    )}
                  </div>
                  {att.downloadUrl && (
                    <a
                      href={att.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline shrink-0"
                    >
                      <span>View</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {showHistoryLink ? (
            <Link
              href="/staff/report-history"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              <History className="h-3.5 w-3.5" />
              <span>Go to Full Report History</span>
            </Link>
          ) : (
            <div />
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="font-bold text-xs rounded-xl h-9"
          >
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

