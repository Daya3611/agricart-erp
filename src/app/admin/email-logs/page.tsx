'use client';

import React, { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { EmailLog } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function AdminEmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEmailLogs() {
      try {
        const res = await fetch('/api/email-logs');
        const data = await res.json();
        if (data.logs) {
          setLogs(data.logs);
        }
      } catch (err) {
        console.error('Failed to fetch email logs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEmailLogs();
  }, []);

  const statusBadges: Record<string, { label: string; variant: any }> = {
    delivered: { label: 'Delivered', variant: 'default' },
    accepted: { label: 'Queued / Accepted', variant: 'info' },
    bounced: { label: 'Bounced', variant: 'destructive' },
    failed: { label: 'Failed', variant: 'destructive' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Mail className="h-6 w-6 text-emerald-600" /> Resend Transactional Email Delivery Logs
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Audit invitation emails, daily report reminders, manager escalations, and report approval notifications.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">Email Delivery Audit Trail ({logs.length})</CardTitle>
          <CardDescription>Tracks Resend API message IDs, attempt counts, and provider delivery status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading email logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No email delivery logs recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Email Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Message ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-bold text-slate-900 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-900">{log.recipient}</TableCell>
                    <TableCell className="text-xs font-semibold text-emerald-700 uppercase">{log.emailType.replace('_', ' ')}</TableCell>
                    <TableCell className="text-xs text-slate-700">{log.subject}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadges[log.deliveryStatus]?.variant || 'secondary'}>
                        {statusBadges[log.deliveryStatus]?.label || log.deliveryStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-slate-500">
                      {log.providerMessageId || 'N/A'}
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
