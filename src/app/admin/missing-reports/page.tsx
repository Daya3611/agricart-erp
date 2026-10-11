'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Send, CheckCircle2, Mail } from 'lucide-react';
import { UserProfile, DailyReport } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function AdminMissingReportsPage() {
  const [missingStaff, setMissingStaff] = useState<UserProfile[]>([]);
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

      if (staffData.users && repData.reports) {
        const todayStr = new Date().toISOString().split('T')[0];
        const submittedUids = new Set(
          repData.reports
            .filter((r: DailyReport) => r.reportDate === todayStr && r.status !== 'draft')
            .map((r: DailyReport) => r.staffUid)
        );

        const missing = staffData.users.filter(
          (u: UserProfile) => u.role === 'staff' && u.accountStatus === 'active' && !submittedUids.has(u.uid)
        );
        setMissingStaff(missing);
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
            Active staff members expected to report today who have not submitted their daily activity report.
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
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
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
            <div className="p-8 text-center text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl">
              🎉 All active field staff have submitted their daily activity reports for today!
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
