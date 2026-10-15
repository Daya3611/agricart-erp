'use client';

import React, { useEffect, useState } from 'react';
import { Clock, Eye, RotateCcw, Paperclip, CheckCircle2 } from 'lucide-react';
import { DailyReport, UserProfile } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  RecordCard,
  RecordCardHeader,
  RecordCardTitle,
  RecordCardSubtitle,
  RecordCardContent,
  RecordCardRow,
  RecordCardActions,
} from '@/components/ui/record-card';
import { ReportReviewModal } from '@/components/reports/ReportReviewModal';

export default function AdminPendingReviewsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const sessRes = await fetch('/api/auth/session');
      const sessData = await sessRes.json();
      if (sessData.authenticated) setUser(sessData.user);

      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.reports) {
        setReports(
          data.reports.filter(
            (r: any) => r.status === 'submitted' || r.status === 'under_review' || r.status === 'resubmitted'
          )
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-6 w-6 text-sky-600" /> Pending Reviews Queue
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Daily activity reports and revisions submitted by field staff waiting for administrator verification and approval.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">
            Reports Awaiting Review ({reports.length})
          </CardTitle>
          <CardDescription>Click Review to open evidence modal, verify activities, and approve or request corrections</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading pending reviews...</div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-xs text-emerald-800 font-bold bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> All clear! There are no pending report reviews in the queue.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold text-slate-900">{r.reportDate}</TableCell>
                        <TableCell>
                          <p className="font-bold text-slate-900">{r.staffName}</p>
                          <p className="text-[11px] text-slate-500">{r.employeeId}</p>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">{r.departmentName}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">
                          {r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString('en-IN') : 'Just now'}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-emerald-700">
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3.5 w-3.5" /> {r.attachments?.length || 0} Attachments
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.status === 'resubmitted' ? 'purple' : 'info'}>
                            {r.status === 'resubmitted' ? 'Resubmitted' : 'Submitted'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => setSelectedReport(r)}
                            className={`rounded-lg px-4 text-xs font-bold text-white h-9 ${
                              r.status === 'resubmitted'
                                ? 'bg-purple-700 hover:bg-purple-800'
                                : 'bg-emerald-700 hover:bg-emerald-800'
                            }`}
                          >
                            {r.status === 'resubmitted' ? (
                              <>
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Review Revision
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5 mr-1" /> Review Now
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Record Cards (< 768px) */}
              <div className="md:hidden space-y-3">
                {reports.map((r) => (
                  <RecordCard key={r.id}>
                    <RecordCardHeader>
                      <div className="min-w-0 flex-1">
                        <RecordCardTitle className="truncate">{r.staffName}</RecordCardTitle>
                        <RecordCardSubtitle>
                          {r.employeeId} • {r.reportDate}
                        </RecordCardSubtitle>
                      </div>
                      <Badge variant={r.status === 'resubmitted' ? 'purple' : 'info'} className="text-[10px] shrink-0">
                        {r.status === 'resubmitted' ? 'Resubmitted' : 'Submitted'}
                      </Badge>
                    </RecordCardHeader>

                    <RecordCardContent>
                      <RecordCardRow label="Department" value={r.departmentName} />
                      <RecordCardRow
                        label="Submitted At"
                        value={r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString('en-IN') : 'Just now'}
                      />
                      <RecordCardRow
                        label="Evidence"
                        value={
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                            <Paperclip className="h-3.5 w-3.5" /> {r.attachments?.length || 0} files
                          </span>
                        }
                      />
                    </RecordCardContent>

                    <RecordCardActions>
                      <Button
                        size="sm"
                        onClick={() => setSelectedReport(r)}
                        className={`w-full text-xs font-bold text-white h-10 rounded-lg ${
                          r.status === 'resubmitted'
                            ? 'bg-purple-700 hover:bg-purple-800'
                            : 'bg-emerald-700 hover:bg-emerald-800'
                        }`}
                      >
                        {r.status === 'resubmitted' ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Review Revision
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5 mr-1.5" /> Review Report
                          </>
                        )}
                      </Button>
                    </RecordCardActions>
                  </RecordCard>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedReport && user && (
        <ReportReviewModal
          report={selectedReport}
          open={Boolean(selectedReport)}
          onOpenChange={() => setSelectedReport(null)}
          currentUser={user}
          onRefresh={fetchPending}
        />
      )}
    </div>
  );
}
