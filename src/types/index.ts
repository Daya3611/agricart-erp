export * from '@/lib/firebase/collections';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'staff';

export type AccountStatus = 'active' | 'inactive' | 'pending_setup' | 'deactivated';

export type InvitationStatus = 'pending' | 'sent' | 'accepted';

export interface UserProfile {
  uid: string; // Firebase Auth UID
  employeeId: string; // Human-readable business identifier e.g. AGRI-EMP-0001
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  departmentId: string;
  departmentName?: string;
  assignedCenterIds: string[];
  assignedCenterNames?: string[];
  reportingManagerUid?: string;
  reportingManagerName?: string;
  designation: string;
  emergencyContact?: string;
  bio?: string;
  joiningDate?: string | null; // YYYY-MM-DD
  workScheduleId?: string;
  accountStatus: AccountStatus;
  invitationStatus?: InvitationStatus;
  createdByUid?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export type EmployeeProfile = UserProfile;

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  managerUids: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Center {
  id: string;
  name: string;
  code: string;
  address: string;
  locationDetails: string;
  departmentId: string;
  departmentName?: string;
  assignedStaffUids: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReportStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'correction_requested'
  | 'approved'
  | 'rejected';

export interface ReportAttachment {
  id: string;
  reportId: string;
  staffUid: string;
  storagePath: string;
  downloadUrl?: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  caption?: string;
  uploadedByUid: string;
  uploadedAt: string;
}

export interface ReportComment {
  id: string;
  reportId: string;
  authorUid: string;
  authorName: string;
  authorRole: UserRole;
  comment: string;
  createdAt: string;
}

export interface ReportRevision {
  id: string;
  reportId: string;
  revisionNumber: number;
  previousData: Partial<DailyReport>;
  updatedData: Partial<DailyReport>;
  editorUid: string;
  editorName: string;
  createdAt: string;
}

export interface DailyReport {
  id: string;
  staffUid: string;
  employeeId: string;
  staffName: string;
  staffEmail: string;
  departmentId: string;
  departmentName: string;
  centerId: string;
  centerName: string;
  reportDate: string; // YYYY-MM-DD
  workLocation: string;
  workStartTime?: string;
  workEndTime?: string;
  activities: string;
  completedTasks: string;
  farmersVisited: number;
  meetingsConducted: number;
  achievements?: string;
  challenges?: string;
  pendingWork?: string;
  supportRequired?: string;
  nextDayPlan?: string;
  remarks?: string;
  attachments: ReportAttachment[];
  status: ReportStatus;
  isLate?: boolean;
  submittedAt?: string;
  reviewerUid?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewComments?: string;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkSchedule {
  id: string;
  name: string;
  workingDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  deadline: string; // HH:mm format, e.g., "19:00"
  timezone: string; // default "Asia/Kolkata"
  reminderPolicy: {
    initialReminderTime: string; // HH:mm format
    subsequentIntervalHours: number;
    maxAttempts: number;
    escalateToManager: boolean;
  };
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  applicableDepartmentIds: string[]; // empty array = all departments
  applicableCenterIds: string[]; // empty array = all centers
  createdAt: string;
}

export interface LeaveRecord {
  id: string;
  staffUid: string;
  staffName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  leaveType: 'casual' | 'sick' | 'earned' | 'unpaid' | 'other';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedByUid?: string;
  reason?: string;
  createdAt: string;
}

export type ReminderType = 'initial' | 'followup' | 'final' | 'manager_escalation';

export interface ReminderLog {
  id: string;
  staffUid: string;
  staffName: string;
  staffEmail: string;
  reportDate: string;
  reminderType: ReminderType;
  attemptNumber: number;
  idempotencyKey: string;
  status: 'sent' | 'failed' | 'skipped';
  sentAt: string;
  errorMessage?: string;
  createdAt: string;
}

export type EmailType =
  | 'staff_invitation'
  | 'password_setup'
  | 'password_reset'
  | 'report_submitted'
  | 'report_approved'
  | 'correction_requested'
  | 'daily_reminder'
  | 'final_reminder'
  | 'manager_escalation'
  | 'admin_notification';

export type EmailDeliveryStatus = 'queued' | 'accepted' | 'delivered' | 'bounced' | 'failed';

export interface EmailLog {
  id: string;
  recipient: string;
  emailType: EmailType;
  staffUid?: string;
  reportId?: string;
  providerMessageId?: string;
  deliveryStatus: EmailDeliveryStatus;
  attemptCount: number;
  errorMessage?: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  resourceType: 'user' | 'report' | 'department' | 'center' | 'settings' | 'schedule' | 'holiday' | 'leave' | 'auth' | 'system' | 'system_settings';
  resourceId: string;
  details?: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}


export interface SystemSettings {
  id: 'global';
  companyName: string;
  companyLogoUrl?: string;
  reportingSettings: {
    defaultDeadline: string; // "19:00"
    allowLateSubmissions: boolean;
    requirePhotos: boolean;
    maxPhotosPerReport: number;
    maxVideosPerReport: number;
    maxPhotoSizeBytes: number; // e.g. 10 * 1024 * 1024
    maxVideoSizeBytes: number; // e.g. 100 * 1024 * 1024
  };
  reminderSettings: {
    enabled: boolean;
    cronSchedule: string; // "0 19 * * *"
    defaultTimezone: string; // "Asia/Kolkata"
    initialReminderDelayMinutes: number;
    maxAttempts: number;
    escalateToManager: boolean;
  };
  emailSettings: {
    fromEmail: string;
    fromName: string;
  };
  updatedByUid?: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalActiveStaff: number;
  scheduledStaffToday: number;
  reportsExpectedToday: number;
  reportsSubmittedToday: number;
  missingReportsToday: number;
  overdueReports: number;
  awaitingApprovalCount: number;
  correctionRequestedCount: number;
  approvedReportsCount: number;
  dailySubmissionRate: number; // percentage 0-100
  deptCompletionRates: Array<{ id: string; name: string; total: number; submitted: number; rate: number }>;
  centerCompletionRates: Array<{ id: string; name: string; total: number; submitted: number; rate: number }>;
  recentActivities: AuditLog[];
  weeklyTrends: Array<{ date: string; submitted: number; missing: number; expected: number }>;
  monthlyTrends: Array<{ month: string; submitted: number; missing: number; rate: number }>;
}

export interface FilterParams {
  datePreset?: 'today' | 'yesterday' | 'last7' | 'last30' | 'this_month' | 'fy' | 'custom';
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  centerId?: string;
  staffUid?: string;
  status?: ReportStatus | 'all' | 'missing' | 'overdue';
  searchQuery?: string;
}
