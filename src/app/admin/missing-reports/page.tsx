'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Send, CheckCircle2, Mail } from 'lucide-react';
import { UserProfile, DailyReport } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  RecordCard,
  RecordCardHeader,
  RecordCardTitle,
  RecordCardSubtitle,
  RecordCardContent,
  RecordCardRow,
  RecordCardActions,
} from '@/components/ui/record-card';

export default function AdminMissingReportsPage() {
  const [missingStaff, setMissingStaff] = useState<UserProfile[]>([]);
  const [onLeaveStaff, setOnLeaveStaff] = useState<{ user: UserProfile; leaveDetails: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringCron, setTriggeringCron] = useState(false);
  const [cronFeedback, setCronFeedback] = useState<string | null>(null);

  const fetchMissingData = async () => {
    setLoading(true);
    try {
      const staffRes = await fetch('/api/staff');
      const staffData = await staffRes.json();

      const repRes = await fetch('/api/reports');
      const repData = await repRes.json();

      const leavesRes = await fetch('/api/leaves?status=approved');
      const leavesData = await leavesRes.json();

      if (staffData.users && repData.reports) {
        const todayStr = new Date().toISOString().split('T')[0];
        const submittedUids = new Set(
          repData.reports
            .filter((r: DailyReport) => r.reportDate === todayStr && r.status !== 'draft')
            .map((r: DailyReport) => r.staffUid)
        );

        // Find staff on approved leave today
        const onLeaveMap = new Map<string, string>();
        if (leavesData.leaves) {
          leavesData.leaves.forEach((l: any) => {
            if (l.startDate <= todayStr && l.endDate >= todayStr && l.approvalStatus === 'approved') {
              onLeaveMap.set(l.staffUid, `${l.leaveType.toUpperCase()} (${l.startDate} to ${l.endDate})`);
            }
          });
        }

        const missing: UserProfile[] = [];
        const onLeaveList: { user: UserProfile; leaveDetails: string }[] = [];

        staffData.users.forEach((u: UserProfile) => {
          if (u.role === 'staff' && u.accountStatus === 'active') {
            if (onLeaveMap.has(u.uid)) {
              onLeaveList.push({ user: u, leaveDetails: onLeaveMap.get(u.uid)! });
            } else if (!submittedUids.has(u.uid)) {
              missing.push(u);
            }
          }
        });

        setMissingStaff(missing);
        setOnLeaveStaff(onLeaveList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissingData();
  }, []);

  const handleRunRemindersCron = async () => {
    setTriggeringCron(true);
    setCronFeedback(null);
    try {
      const res = await fetch('/api/cron/reminders?secret=agricart_cron_secret_key_8492049182390123');
      const data = await res.json();
      if (data.success) {
        setCronFeedback(`✅ Reminder job completed! Sent ${data.remindersSent} reminders, ${data.escalationsSent} escalations.`);
        fetchMissingData();
      } else {
        setCronFeedback(`❌ Reminder job error: ${data.error}`);
      }
    } catch (err: any) {
      setCronFeedback(`❌ Failed to trigger scheduled reminders: ${err.message}`);
    } finally {
      setTriggeringCron(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-600" /> Missing & Overdue Daily Reports
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Active Staffs expected to report today who have not submitted their daily activity report.
          </p>
        </div>

        <Button
          onClick={handleRunRemindersCron}
          disabled={triggeringCron}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
        >
          <Send className={`h-4 w-4 mr-1.5 ${triggeringCron ? 'animate-bounce' : ''}`} />
          {triggeringCron ? 'Processing Reminders...' : 'Send Resend Reminders Now'}
        </Button>
      </div>

      {cronFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {cronFeedback}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">
            Staff Pending Submissions ({missingStaff.length})
          </CardTitle>
          <CardDescription>
            Automatic Resend email reminders are scheduled daily at deadline (07:00 PM Asia/Kolkata).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Checking missing reports...</div>
          ) : missingStaff.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold text-emerald-800 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>All active field staff have submitted their daily activity reports for today!</span>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Staff Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Center / Location</TableHead>
                      <TableHead>Deadline Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missingStaff.map((staff) => (
                      <TableRow key={staff.uid}>
                        <TableCell className="font-bold text-slate-900">{staff.employeeId}</TableCell>
                        <TableCell>
                          <p className="font-bold text-slate-900">{staff.fullName}</p>
                          <p className="text-[11px] text-slate-500">{staff.email}</p>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">{staff.departmentName || 'Field Operations'}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">{staff.assignedCenterNames?.[0] || 'Nashik Center'}</TableCell>
                        <TableCell>
                          <Badge variant="warning">OVERDUE (Missing)</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRunRemindersCron}
                            className="text-xs font-bold text-amber-700 border-amber-300 hover:bg-amber-50"
                          >
                            <Mail className="h-3.5 w-3.5 mr-1" /> Send Reminder Email
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Record Cards (< 768px) */}
              <div className="md:hidden space-y-3">
                {missingStaff.map((staff) => (
                  <RecordCard key={staff.uid}>
                    <RecordCardHeader>
                      <div className="min-w-0 flex-1">
                        <RecordCardTitle className="truncate">{staff.fullName}</RecordCardTitle>
                        <RecordCardSubtitle>
                          {staff.employeeId} • {staff.email}
                        </RecordCardSubtitle>
                      </div>
                      <Badge variant="warning" className="text-[10px] shrink-0">
                        OVERDUE
                      </Badge>
                    </RecordCardHeader>

                    <RecordCardContent>
                      <RecordCardRow label="Department" value={staff.departmentName || 'Field Operations'} />
                      <RecordCardRow label="Center" value={staff.assignedCenterNames?.[0] || 'Nashik Center'} />
                    </RecordCardContent>

                    <RecordCardActions>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRunRemindersCron}
                        className="w-full text-xs font-bold text-amber-800 border-amber-300 hover:bg-amber-50 h-10 rounded-lg"
                      >
                        <Mail className="h-3.5 w-3.5 mr-1.5" /> Send Reminder Email
                      </Button>
                    </RecordCardActions>
                  </RecordCard>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {onLeaveStaff.length > 0 && (
        <Card className="border-sky-200 bg-sky-50/30">
          <CardHeader>
            <CardTitle className="text-base font-bold text-sky-950 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
              Staff on Approved Leave Today ({onLeaveStaff.length})
            </CardTitle>
            <CardDescription className="text-sky-800">
              These Staffs have authorized approved leave for today and are exempt from daily report submission.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Center / Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved Leave Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onLeaveStaff.map(({ user: staff, leaveDetails }) => (
                    <TableRow key={staff.uid}>
                      <TableCell className="font-bold text-slate-900">{staff.employeeId}</TableCell>
                      <TableCell>
                        <p className="font-bold text-slate-900">{staff.fullName}</p>
                        <p className="text-[11px] text-slate-500">{staff.email}</p>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">{staff.departmentName || 'Field Operations'}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">{staff.assignedCenterNames?.[0] || 'Nashik Center'}</TableCell>
                      <TableCell>
                        <Badge className="bg-sky-100 text-sky-800 border-sky-300 font-bold">On Leave</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium">
                        {leaveDetails}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Record Cards (< 768px) */}
            <div className="md:hidden space-y-3">
              {onLeaveStaff.map(({ user: staff, leaveDetails }) => (
                <RecordCard key={staff.uid}>
                  <RecordCardHeader>
                    <div className="min-w-0 flex-1">
                      <RecordCardTitle className="truncate">{staff.fullName}</RecordCardTitle>
                      <RecordCardSubtitle>
                        {staff.employeeId} • {staff.email}
                      </RecordCardSubtitle>
                    </div>
                    <Badge className="bg-sky-100 text-sky-800 border-sky-300 font-bold text-[10px] shrink-0">
                      On Leave
                    </Badge>
                  </RecordCardHeader>

                  <RecordCardContent>
                    <RecordCardRow label="Department" value={staff.departmentName || 'Field Operations'} />
                    <RecordCardRow label="Center" value={staff.assignedCenterNames?.[0] || 'Nashik Center'} />
                    <RecordCardRow label="Leave Details" value={leaveDetails} />
                  </RecordCardContent>
                </RecordCard>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
