import { adminDb } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { sendEmail } from '@/lib/email/resend';
import { getDailyReminderEmail, getManagerEscalationEmail } from '@/lib/email/templates';
import { getTodayDateString } from '@/lib/utils/date-utils';
import { UserProfile, DailyReport, ReminderLog } from '@/types';

export async function processAutomaticMissingReportReminders(targetDate = getTodayDateString()) {
  const results = {
    checkedStaffCount: 0,
    remindersSent: 0,
    escalationsSent: 0,
    skippedCount: 0,
    errors: [] as string[],
  };

  try {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const portalUrl = `${appUrl}/staff/daily-report`;

    const usersSnap = await adminDb.collection(ERP_COLLECTIONS.employees).where('role', '==', 'staff').where('accountStatus', '==', 'active').get();
    const staffMembers = usersSnap.docs.map((doc: any) => doc.data() as UserProfile);
    results.checkedStaffCount = staffMembers.length;

    const reportsSnap = await adminDb.collection(ERP_COLLECTIONS.dailyReports).where('reportDate', '==', targetDate).get();
    const existingReports = reportsSnap.docs.map((doc: any) => doc.data() as DailyReport);

    const submittedStaffUids = new Set(
      existingReports
        .filter((r: DailyReport) => r.status === 'submitted' || r.status === 'under_review' || r.status === 'approved')
        .map((r: DailyReport) => r.staffUid)
    );

    // Retrieve approved leaves covering targetDate to exclude staff on authorized leave
    const leavesSnap = await adminDb
      .collection(ERP_COLLECTIONS.leaveRecords)
      .where('approvalStatus', '==', 'approved')
      .get();
    const onLeaveStaffUids = new Set<string>();
    leavesSnap.docs.forEach((doc: any) => {
      const l = doc.data();
      if (l.startDate <= targetDate && l.endDate >= targetDate) {
        onLeaveStaffUids.add(l.staffUid);
      }
    });

    for (const staff of staffMembers) {
      if (submittedStaffUids.has(staff.uid) || onLeaveStaffUids.has(staff.uid)) {
        results.skippedCount++;
        continue;
      }

      const idempotencyKey = `reminder_${staff.uid}_${targetDate}_attempt_1`;
      const reminderRef = adminDb.collection(ERP_COLLECTIONS.reminderLogs).doc(idempotencyKey);
      const existingReminder = await reminderRef.get();

      if (existingReminder.exists) {
        const escalationKey = `escalation_${staff.uid}_${targetDate}`;
        const escalationRef = adminDb.collection(ERP_COLLECTIONS.reminderLogs).doc(escalationKey);
        const existingEscalation = await escalationRef.get();

        if (!existingEscalation.exists && staff.reportingManagerUid) {
          const managerDoc = await adminDb.collection(ERP_COLLECTIONS.employees).doc(staff.reportingManagerUid).get();
          if (managerDoc.exists) {
            const manager = managerDoc.data() as UserProfile;
            const { subject, html } = getManagerEscalationEmail({
              managerName: manager.fullName,
              staffName: staff.fullName,
              employeeId: staff.employeeId,
              reportDate: targetDate,
              portalUrl: `${appUrl}/missing-reports`,
            });

            await sendEmail({
              to: manager.email,
              subject,
              html,
              emailType: 'manager_escalation',
              staffUid: staff.uid,
            });

            const escalationLog: ReminderLog = {
              id: escalationKey,
              staffUid: staff.uid,
              staffName: staff.fullName,
              staffEmail: staff.email,
              reportDate: targetDate,
              reminderType: 'manager_escalation',
              attemptNumber: 2,
              idempotencyKey: escalationKey,
              status: 'sent',
              sentAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            };
            await escalationRef.set(escalationLog);
            results.escalationsSent++;
          }
        } else {
          results.skippedCount++;
        }
        continue;
      }

      const { subject, html } = getDailyReminderEmail({
        recipientName: staff.fullName,
        reportDate: targetDate,
        deadlineTime: '07:00 PM',
        portalUrl,
      });

      const emailResult = await sendEmail({
        to: staff.email,
        subject,
        html,
        emailType: 'daily_reminder',
        staffUid: staff.uid,
      });

      const reminderLog: ReminderLog = {
        id: idempotencyKey,
        staffUid: staff.uid,
        staffName: staff.fullName,
        staffEmail: staff.email,
        reportDate: targetDate,
        reminderType: 'initial',
        attemptNumber: 1,
        idempotencyKey,
        status: emailResult.success ? 'sent' : 'failed',
        sentAt: new Date().toISOString(),
        errorMessage: emailResult.error || undefined,
        createdAt: new Date().toISOString(),
      };

      await reminderRef.set(reminderLog);

      if (emailResult.success) {
        results.remindersSent++;
      } else {
        results.errors.push(`Failed for ${staff.email}: ${emailResult.error}`);
      }
    }

    return { success: true, ...results };
  } catch (err: any) {
    console.error('processAutomaticMissingReportReminders error:', err);
    return { success: false, error: err.message, ...results };
  }
}
