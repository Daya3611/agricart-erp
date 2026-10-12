'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, FileEdit, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { DailyReport } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatReadableDate, formatReadableDateTime } from '@/lib/utils/date-utils';

export default function StaffCorrectionsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports')
      .then((res) => res.json())
      .then((data) => {
        if (data.reports) {
          // Filter reports with correction_requested or edit_requested status
          setReports(data.reports.filter((r: DailyReport) => r.status === 'correction_requested' || r.status === 'edit_requested'));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-rose-600" /> Corrections & Edits Required
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Daily reports that require your review and resubmission based on manager feedback.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">
            Pending Corrections Queue ({reports.length})
          </CardTitle>
          <CardDescription>
            Click "Edit & Resubmit" to modify the report according to reviewer instructions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Checking for required corrections...</div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center bg-emerald-50 rounded-2xl border border-emerald-100 space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-emerald-950 text-sm">No Corrections Required!</h3>
              <p className="text-xs text-emerald-800 font-medium max-w-md mx-auto">
                All of your submitted daily activity reports have either been approved or are currently undergoing initial review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="p-5 bg-rose-50/50 rounded-2xl border border-rose-200/80 space-y-3 shadow-2xs hover:border-rose-300 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">
                        Report for {formatReadableDate(r.reportDate)}
                      </span>
                      <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                        {r.status === 'edit_requested' ? 'Edit Requested' : 'Correction Requested'}
                      </Badge>
                      {r.isLate && <Badge variant="warning" className="text-[10px]">Late Submission</Badge>}
                    </div>

                    <span className="text-[11px] text-slate-500 font-medium">
                      Reviewed: {r.reviewedAt ? formatReadableDateTime(r.reviewedAt) : 'Recently'}
                    </span>
                  </div>

                  {/* Reviewer Feedback Box */}
                  <div className="p-3.5 bg-white rounded-xl border border-rose-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-900">
                        Reviewer: {r.editRequest?.requesterName || r.reviewerName || 'Department Manager'}
                      </span>
                      {r.editRequest?.requestedAt && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          {formatReadableDateTime(r.editRequest.requestedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800 italic">
                      "{r.editRequest?.reason || r.reviewComments || 'Please provide additional details regarding your activities and tasks.'}"
                    </p>
                    {r.editRequest?.instructions && (
                      <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200 text-[11px] text-amber-950 font-medium">
                        <span className="font-bold block text-amber-900 mb-0.5">Specific Instructions:</span>
                        {r.editRequest.instructions}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                    <div>
                      <span className="font-semibold text-slate-500 block">Reported Activities:</span>
                      <p className="line-clamp-2">{r.activities}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500 block">Completed Tasks:</span>
                      <p className="line-clamp-2">{r.completedTasks}</p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-rose-100">
                    <span className="text-xs font-bold text-emerald-700">
                      📷 {r.attachments?.length || 0} attachments uploaded
                    </span>

                    <Link href={`/staff/daily-report?id=${r.id}`}>
                      <Button className="rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm">
                        <FileEdit className="h-3.5 w-3.5 mr-1.5" /> Edit & Resubmit Report
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
