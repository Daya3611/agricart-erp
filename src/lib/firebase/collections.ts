/**
 * Centralized, typed Firestore Collection names for Agricart FPC ERP.
 * All ERP operations must reference these constants rather than scattering string literals.
 */
export const ERP_COLLECTIONS = {
  employees: 'erp_emp',
  departments: 'erp_departments',
  centers: 'erp_centers',
  dailyReports: 'erp_daily_reports',
  reportAttachments: 'erp_report_attachments',
  reportComments: 'erp_report_comments',
  reportRevisions: 'erp_report_revisions',
  workSchedules: 'erp_work_schedules',
  holidays: 'erp_holidays',
  leaveRecords: 'erp_leave_records',
  reminderLogs: 'erp_reminder_logs',
  emailLogs: 'erp_email_logs',
  auditLogs: 'erp_audit_logs',
  systemSettings: 'erp_system_settings',
  media: 'erp_media',
  // Field Activity Reporting & Attendance Collections
  attendanceSessions: 'erp_attendance_sessions',
  fieldReports: 'erp_field_reports',
  fieldActivities: 'erp_field_activities',
  fieldReportAttachments: 'erp_field_report_attachments',
  fieldReportRevisions: 'erp_field_report_revisions',
  fieldReportReviews: 'erp_field_report_reviews',
  fieldReportSyncLogs: 'erp_field_report_sync_logs',
} as const;

export type ErpCollectionKey = keyof typeof ERP_COLLECTIONS;
export type ErpCollectionName = (typeof ERP_COLLECTIONS)[ErpCollectionKey];
