import { saveDocument, fetchDocument, fetchCollection, deleteDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { adminAuth, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/resend';
import { logAuditAction } from '@/lib/services/audit-service';
import { Department, Center, UserProfile, SystemSettings, GlobalReportingConfig } from '@/types';

export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 'dept_field_ops',
    name: 'Field Operations & Procurement',
    code: 'DEPT-OPS',
    description: 'On-field crop monitoring, farmer registration, and direct produce procurement.',
    managerUids: ['mgr_003'],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dept_quality_qa',
    name: 'Quality Assurance & Grading',
    code: 'DEPT-QA',
    description: 'Inspection, moisture testing, grading, and certification of agricultural produce.',
    managerUids: ['mgr_003'],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dept_logistics',
    name: 'Supply Chain & Logistics',
    code: 'DEPT-LOG',
    description: 'Cold storage management, transit scheduling, and distribution center operations.',
    managerUids: ['adm_002'],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dept_advisory',
    name: 'Farmer Advisory & Extension',
    code: 'DEPT-ADV',
    description: 'Organizing farmer training workshops, organic input distribution, and soil testing.',
    managerUids: ['mgr_003'],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const DEFAULT_CENTERS: Center[] = [
  {
    id: 'center_nashik_north',
    name: 'Nashik North Processing Center',
    code: 'CNT-NSK-01',
    address: 'Plot 42, MIDC Dindori Road, Nashik, Maharashtra 422004',
    locationDetails: 'Primary Onion, Tomato & Vegetable Grading Packhouse',
    departmentId: 'dept_field_ops',
    departmentName: 'Field Operations & Procurement',
    assignedStaffUids: ['stf_104', 'stf_105'],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'center_pune_hub',
    name: 'Pune Central Logistics Hub',
    code: 'CNT-PUN-02',
    address: 'Gate 14, APMC Market Yard, Gultekdi, Pune, Maharashtra 411037',
    locationDetails: 'Cold Storage & Inter-state Transport Distribution Terminal',
    departmentId: 'dept_logistics',
    departmentName: 'Supply Chain & Logistics',
    assignedStaffUids: ['stf_106'],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'center_sangli_hub',
    name: 'Sangli Grape & Agri Hub',
    code: 'CNT-SGL-03',
    address: 'Kupwad MIDC Industrial Area, Sangli, Maharashtra 416436',
    locationDetails: 'Export Grape Processing & Raisin Grading Unit',
    departmentId: 'dept_quality_qa',
    departmentName: 'Quality Assurance & Grading',
    assignedStaffUids: ['stf_107'],
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const DEFAULT_USERS: UserProfile[] = [];


export const DEFAULT_GLOBAL_REPORTING_CONFIG: GlobalReportingConfig = {
  timezone: 'Asia/Kolkata',
  reportingPeriod: 'calendar_month',
  submissionDeadline: '19:00',
  allowLateSubmissions: true,
  workingDays: [1, 2, 3, 4, 5, 6], // Monday through Saturday
  holidays: [
    { date: '2026-01-26', name: 'Republic Day' },
    { date: '2026-03-03', name: 'Holi / Dhulivandan' },
    { date: '2026-04-14', name: 'Dr. Ambedkar Jayanti' },
    { date: '2026-05-01', name: 'Maharashtra Day / Labour Day' },
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-10-02', name: 'Mahatma Gandhi Jayanti' },
    { date: '2026-10-20', name: 'Dussehra' },
    { date: '2026-11-08', name: 'Diwali' },
    { date: '2026-12-25', name: 'Christmas' },
  ],
  requireAttendanceForActivity: true,
  minActivitiesPerDay: 1,
  maxDailyActivitySlots: 20,
  leaveCountsAsWorkingDay: false,
  includeLeaveInMissingReports: false,
  includePhotosInExports: true,
  includeGpsInExports: true,
  gpsVisibleToAdmin: true,
  pdfSettings: {
    showOrgHeader: true,
    headerTitle: 'DAILY FIELD ACTIVITY REPORT',
    footerText: 'Confidential Staff Activity Record • Official Verified Submission',
    showSignatures: true,
  },
  docxSettings: {
    headerTitle: 'MONTHLY FIELD ACTIVITY & ATTENDANCE REPORT',
    includeTableOfContents: false,
  },
  excelSettings: {
    freezePanes: true,
    autoFilter: true,
    highlightMissingDays: true,
    includeReviewHistory: true,
  },
  requiredActivityFields: {
    farmerName: true,
    village: true,
    observations: true,
    photoEvidence: false,
  },
  exportPermissions: {
    allowStaffExcelExport: true,
    allowStaffPdfExport: true,
    allowStaffDocxExport: true,
  },
  organization: {
    companyName: 'Agricart Farmers Producer Company Ltd',
    companyLogoUrl: '/logo.png',
    address: 'Plot 42, MIDC Dindori Road, Nashik, Maharashtra 422004',
    phone: '+91 253 2500000',
    email: 'contact@agricartfpc.in',
    footerText: 'Agricart Farmers Producer Company Ltd • All rights reserved.',
  },
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  reportingConfig: DEFAULT_GLOBAL_REPORTING_CONFIG,
  id: 'global',
  companyName: 'Agricart Farmers Producer Company Ltd',
  companyLogoUrl: '/logo.png',
  reportingSettings: {
    defaultDeadline: '19:00',
    allowLateSubmissions: true,
    requirePhotos: true,
    maxPhotosPerReport: 10,
    maxVideosPerReport: 3,
    maxPhotoSizeBytes: 10 * 1024 * 1024,
    maxVideoSizeBytes: 100 * 1024 * 1024,
  },
  reminderSettings: {
    enabled: true,
    cronSchedule: '0 19 * * *',
    defaultTimezone: 'Asia/Kolkata',
    initialReminderDelayMinutes: 0,
    maxAttempts: 3,
    escalateToManager: true,
  },
  emailSettings: {
    fromEmail: 'erp@agricartfpc.in',
    fromName: 'Agricart FPC ERP',
  },
  updatedAt: new Date().toISOString(),
};

export interface BootstrapResult {
  success: boolean;
  user?: UserProfile;
  message?: string;
  error?: string;
  accountExists?: boolean;
  needsCreation?: boolean;
}

export async function bootstrapInitialSuperAdmin(
  providedAuthUid?: string,
  providedEmail?: string,
  fullName?: string
): Promise<BootstrapResult> {
  const rawAdminEmail = process.env.ADMIN_EMAIL;
  if (!rawAdminEmail || !rawAdminEmail.trim()) {
    return {
      success: false,
      error: 'ADMIN_EMAIL environment variable is missing or invalid. Super Admin bootstrap stopped.',
    };
  }

  const normalizedConfiguredEmail = rawAdminEmail.toLowerCase().trim();

  // If email was provided, strictly ensure it matches ADMIN_EMAIL to prevent unauthorized role escalation
  if (providedEmail && providedEmail.toLowerCase().trim() !== normalizedConfiguredEmail) {
    return {
      success: false,
      error: `FORBIDDEN: Provided email (${providedEmail}) does not match configured ADMIN_EMAIL. Bootstrap rejected.`,
    };
  }

  // Prevent concurrent provisioning with a distributed lock document
  const lockDocId = 'super_admin_bootstrap';
  const existingLock = await fetchDocument('systemLocks', lockDocId);
  const nowMs = Date.now();
  if (existingLock && (existingLock as any).lockedAt) {
    const lockAgeMs = nowMs - new Date((existingLock as any).lockedAt).getTime();
    if (lockAgeMs < 15000) {
      // Lock held within last 15 seconds
      return {
        success: false,
        error: 'Bootstrap procedure is currently in progress. Please retry shortly.',
      };
    }
  }

  await saveDocument('systemLocks', lockDocId, {
    lockedAt: new Date().toISOString(),
    lockedBy: 'bootstrapInitialSuperAdmin',
  });

  try {
    let authUid = providedAuthUid;
    let authUser: any = null;

    if (hasValidAdminCredentials) {
      try {
        authUser = await adminAuth.getUserByEmail(normalizedConfiguredEmail);
        authUid = authUser.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/user-not-found') {
          return {
            success: false,
            error: `Firebase Authentication account does not exist for configured ADMIN_EMAIL (${normalizedConfiguredEmail}). Please create the account via Firebase Console or run the documented invitation procedure. Accounts are never created with hardcoded passwords.`,
            accountExists: false,
            needsCreation: true,
          };
        }
        throw authErr;
      }

      // Verify email on the Firebase Auth account
      if (!authUser.emailVerified) {
        await adminAuth.updateUser(authUser.uid, { emailVerified: true });
      }

      // Grant Super Admin role via trusted Firebase Admin SDK custom claims
      await adminAuth.setCustomUserClaims(authUser.uid, {
        role: 'super_admin',
        admin: true,
      });
    }

    if (!authUid) {
      authUid = 'usr_super_admin';
    }

    // Look up existing profile or legacy profile to preserve details
    let existingProfile: UserProfile | null = null;
    const existingDoc = await fetchDocument(ERP_COLLECTIONS.employees, authUid);
    if (existingDoc) {
      existingProfile = (existingDoc as unknown) as UserProfile;
    } else {
      // Fallback search by email in erp_emp
      const matched = (await fetchCollection(ERP_COLLECTIONS.employees, [
        { field: 'email', op: '==', value: normalizedConfiguredEmail },
      ])) as UserProfile[];
      if (matched.length > 0) {
        existingProfile = matched[0];
      }
    }

    const now = new Date().toISOString();
    const superAdminProfile: UserProfile = {
      uid: authUid,
      employeeId: existingProfile?.employeeId || 'AGRI-EMP-0001',
      fullName: authUser?.displayName || existingProfile?.fullName || fullName || 'Super Admin',
      email: normalizedConfiguredEmail,
      phone: authUser?.phoneNumber || existingProfile?.phone || '',
      role: 'super_admin',
      departmentId: existingProfile?.departmentId || 'dept_field_ops',
      departmentName: existingProfile?.departmentName || 'Field Operations & Procurement',
      assignedCenterIds: existingProfile?.assignedCenterIds || [],
      designation: existingProfile?.designation || 'Managing Director & CEO',
      joiningDate: existingProfile?.joiningDate || now.split('T')[0],
      workScheduleId: existingProfile?.workScheduleId || 'sched_standard',
      accountStatus: 'active',
      invitationStatus: 'accepted',
      createdAt: existingProfile?.createdAt || now,
      updatedAt: now,
    };

    // Save profile using the authenticated Firebase UID as the document ID in erp_emp
    await saveDocument(ERP_COLLECTIONS.employees, authUid, superAdminProfile);
    await saveDocument(ERP_COLLECTIONS.systemSettings, 'global', DEFAULT_SYSTEM_SETTINGS);

    for (const d of DEFAULT_DEPARTMENTS) {
      const existingDept = await fetchDocument(ERP_COLLECTIONS.departments, d.id);
      if (!existingDept) {
        await saveDocument(ERP_COLLECTIONS.departments, d.id, d);
      }
    }
    for (const c of DEFAULT_CENTERS) {
      const existingCenter = await fetchDocument(ERP_COLLECTIONS.centers, c.id);
      if (!existingCenter) {
        await saveDocument(ERP_COLLECTIONS.centers, c.id, c);
      }
    }

    const standardSchedRef = await fetchDocument(ERP_COLLECTIONS.workSchedules, 'sched_standard');
    if (!standardSchedRef) {
      await saveDocument(ERP_COLLECTIONS.workSchedules, 'sched_standard', {
        id: 'sched_standard',
        name: 'Standard Field Operations Schedule (Mon-Sat)',
        workingDays: [1, 2, 3, 4, 5, 6],
        deadline: '19:00',
        dailyCutoffTime: '19:00',
        timezone: 'Asia/Kolkata',
        reminderPolicy: {
          initialReminderTime: '19:00',
          subsequentIntervalHours: 1,
          maxAttempts: 3,
          escalateToManager: true,
        },
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    await logAuditAction({
      actorUid: authUid,
      actorName: superAdminProfile.fullName,
      actorRole: 'super_admin',
      action: 'bootstrap_super_admin',
      resourceType: 'user',
      resourceId: authUid,
      details: `Provisioned and verified initial Super Admin account for ${normalizedConfiguredEmail}`,
    });

    return {
      success: true,
      user: superAdminProfile,
      message: 'Super Admin provisioned successfully.',
    };
  } finally {
    try {
      await deleteDocument('systemLocks', lockDocId);
    } catch { }
  }
}

export async function inviteInitialSuperAdmin(targetEmail?: string) {
  const rawAdminEmail = process.env.ADMIN_EMAIL;
  if (!rawAdminEmail || !rawAdminEmail.trim()) {
    return { success: false, error: 'ADMIN_EMAIL is not configured.' };
  }
  const email = (targetEmail || rawAdminEmail).toLowerCase().trim();
  if (email !== rawAdminEmail.toLowerCase().trim()) {
    return { success: false, error: 'Forbidden: Can only invite the configured ADMIN_EMAIL.' };
  }

  let authUser: any;
  try {
    authUser = await adminAuth.getUserByEmail(email);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      // Create user without hardcoded password
      authUser = await adminAuth.createUser({
        email,
        emailVerified: false,
      });
    } else {
      throw err;
    }
  }

  // Generate secure password reset / setup link
  const setupUrl = await adminAuth.generatePasswordResetLink(email);

  await sendEmail({
    to: email,
    subject: 'Agricart ERP Super Admin Setup Invitation',
    html: `<p>Welcome to Agricart FPC ERP. Please complete setup of your Super Admin account by creating your password: <a href="${setupUrl}">${setupUrl}</a></p>`,
    emailType: 'password_setup',
    staffUid: authUser.uid,
  });

  return { success: true, uid: authUser.uid, setupUrl };
}

export async function seedInitialDatabase() {
  return bootstrapInitialSuperAdmin();
}

