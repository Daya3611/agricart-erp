import { adminDb, adminAuth, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { logAuditAction } from '@/lib/services/audit-service';

export interface MigrationReport {
  success: boolean;
  employeesMigrated: number;
  departmentsMigrated: number;
  centersMigrated: number;
  dailyReportsMigrated: number;
  auditLogsMigrated: number;
  emailLogsMigrated: number;
  systemSettingsMigrated: number;
  workSchedulesSeeded: number;
  errors: string[];
}

export async function migrateToErpCollections(): Promise<MigrationReport> {
  const report: MigrationReport = {
    success: true,
    employeesMigrated: 0,
    departmentsMigrated: 0,
    centersMigrated: 0,
    dailyReportsMigrated: 0,
    auditLogsMigrated: 0,
    emailLogsMigrated: 0,
    systemSettingsMigrated: 0,
    workSchedulesSeeded: 0,
    errors: [],
  };

  if (!hasValidAdminCredentials) {
    report.success = false;
    report.errors.push('Firebase Admin credentials are not configured.');
    return report;
  }

  const batch = adminDb.batch();
  let opCount = 0;

  async function commitBatchIfFull() {
    if (opCount >= 400) {
      await batch.commit();
      opCount = 0;
    }
  }

  try {
    // 1. Migrate users -> erp_emp
    const usersSnap = await adminDb.collection('users').get();
    let empCounter = 1;

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const targetUid = data.uid || doc.id;
      const targetRef = adminDb.collection(ERP_COLLECTIONS.employees).doc(targetUid);

      const existingTarget = await targetRef.get();
      if (!existingTarget.exists) {
        const empId =
          data.employeeId ||
          `AGRI-EMP-${String(empCounter++).padStart(4, '0')}`;

        const employeeProfile = {
          uid: targetUid,
          employeeId: empId,
          fullName: data.fullName || data.name || data.displayName || 'Staff',
          email: (data.email || '').toLowerCase().trim(),
          phone: data.phone || data.mobile || '',
          designation: data.designation || 'Field Officer',
          role: data.role || 'staff',
          departmentId: data.departmentId || 'dept_field_ops',
          departmentName: data.departmentName || 'Field Operations & Procurement',
          assignedCenterIds: data.assignedCenterIds || [],
          assignedCenterNames: data.assignedCenterNames || [],
          reportingManagerUid: data.reportingManagerUid || '',
          reportingManagerName: data.reportingManagerName || '',
          joiningDate: data.joiningDate || new Date().toISOString().split('T')[0],
          workScheduleId: data.workScheduleId || 'sched_standard',
          accountStatus: data.accountStatus || 'active',
          invitationStatus: data.invitationStatus || 'accepted',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdByUid: data.createdByUid || 'system_migration',
        };

        batch.set(targetRef, employeeProfile, { merge: true });
        opCount++;
        report.employeesMigrated++;
        await commitBatchIfFull();
      } else {
        report.employeesMigrated++;
      }
    }

    // 2. Migrate departments -> erp_departments
    const deptSnap = await adminDb.collection('departments').get();
    for (const doc of deptSnap.docs) {
      const targetRef = adminDb.collection(ERP_COLLECTIONS.departments).doc(doc.id);
      const existing = await targetRef.get();
      if (!existing.exists) {
        batch.set(targetRef, doc.data(), { merge: true });
        opCount++;
        report.departmentsMigrated++;
        await commitBatchIfFull();
      } else {
        report.departmentsMigrated++;
      }
    }

    // 3. Migrate centers -> erp_centers
    const centersSnap = await adminDb.collection('centers').get();
    for (const doc of centersSnap.docs) {
      const targetRef = adminDb.collection(ERP_COLLECTIONS.centers).doc(doc.id);
      const existing = await targetRef.get();
      if (!existing.exists) {
        batch.set(targetRef, doc.data(), { merge: true });
        opCount++;
        report.centersMigrated++;
        await commitBatchIfFull();
      } else {
        report.centersMigrated++;
      }
    }

    // 4. Migrate dailyReports -> erp_daily_reports
    const reportsSnap = await adminDb.collection('dailyReports').get();
    for (const doc of reportsSnap.docs) {
      const targetRef = adminDb.collection(ERP_COLLECTIONS.dailyReports).doc(doc.id);
      const existing = await targetRef.get();
      if (!existing.exists) {
        batch.set(targetRef, doc.data(), { merge: true });
        opCount++;
        report.dailyReportsMigrated++;
        await commitBatchIfFull();
      } else {
        report.dailyReportsMigrated++;
      }
    }

    // 5. Migrate auditLogs -> erp_audit_logs
    const auditSnap = await adminDb.collection('auditLogs').get();
    for (const doc of auditSnap.docs) {
      const targetRef = adminDb.collection(ERP_COLLECTIONS.auditLogs).doc(doc.id);
      const existing = await targetRef.get();
      if (!existing.exists) {
        batch.set(targetRef, doc.data(), { merge: true });
        opCount++;
        report.auditLogsMigrated++;
        await commitBatchIfFull();
      } else {
        report.auditLogsMigrated++;
      }
    }

    // 6. Migrate emailLogs -> erp_email_logs
    const emailSnap = await adminDb.collection('emailLogs').get();
    for (const doc of emailSnap.docs) {
      const targetRef = adminDb.collection(ERP_COLLECTIONS.emailLogs).doc(doc.id);
      const existing = await targetRef.get();
      if (!existing.exists) {
        batch.set(targetRef, doc.data(), { merge: true });
        opCount++;
        report.emailLogsMigrated++;
        await commitBatchIfFull();
      } else {
        report.emailLogsMigrated++;
      }
    }

    // 7. Migrate systemSettings -> erp_system_settings
    const settingsSnap = await adminDb.collection('systemSettings').get();
    for (const doc of settingsSnap.docs) {
      const targetRef = adminDb.collection(ERP_COLLECTIONS.systemSettings).doc(doc.id);
      const existing = await targetRef.get();
      if (!existing.exists) {
        batch.set(targetRef, doc.data(), { merge: true });
        opCount++;
        report.systemSettingsMigrated++;
        await commitBatchIfFull();
      } else {
        report.systemSettingsMigrated++;
      }
    }

    // 8. Seed default work schedule if not present in erp_work_schedules
    const standardSchedRef = adminDb.collection(ERP_COLLECTIONS.workSchedules).doc('sched_standard');
    const existingSched = await standardSchedRef.get();
    if (!existingSched.exists) {
      const standardSchedule = {
        id: 'sched_standard',
        name: 'Standard Field Operations Schedule (Mon-Sat)',
        workingDays: [1, 2, 3, 4, 5, 6],
        deadline: '19:00',
        timezone: 'Asia/Kolkata',
        reminderPolicy: {
          initialReminderTime: '19:00',
          subsequentIntervalHours: 1,
          maxAttempts: 3,
          escalateToManager: true,
        },
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      batch.set(standardSchedRef, standardSchedule);
      opCount++;
      report.workSchedulesSeeded++;
    }

    if (opCount > 0) {
      await batch.commit();
    }

    await logAuditAction({
      actorUid: 'system_migration',
      actorName: 'ERP Migration Utility',
      actorRole: 'super_admin',
      action: 'migrate_to_erp_collections',
      resourceType: 'system',
      resourceId: 'migration',
      details: `Migrated data to dedicated ERP collections: ${report.employeesMigrated} employees, ${report.departmentsMigrated} depts, ${report.centersMigrated} centers`,
    });
  } catch (err: any) {
    report.success = false;
    report.errors.push(err.message);
  }

  return report;
}
