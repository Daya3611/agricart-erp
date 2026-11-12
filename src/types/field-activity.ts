import { ReportStatus, UserRole, ApprovalHistoryRecord, EditRequestRecord } from './index';

export interface GpsCoordinate {
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  placeName?: string; // Human-readable address e.g. "Diva, Thane, Maharashtra, India"
  capturedAt?: string; // ISO string
  timestamp?: string; // ISO string (for backward compatibility)
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export type LocationData = GpsCoordinate;

export type LocationCaptureStatus = 'captured' | 'unavailable' | 'denied' | 'pending';

export type CanonicalActivityStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type ActivitySlotStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type ActivityChoiceKey =
  | 'farmer_visit'
  | 'farmer_group_meeting'
  | 'training'
  | 'demonstration'
  | 'field_visit'
  | 'survey_data_collection'
  | 'seed_conservation'
  | 'crop_conservation'
  | 'livestock_dairy'
  | 'milk_collection'
  | 'market_linkage'
  | 'water_conservation'
  | 'nursery_activity'
  | 'women_group_activity'
  | 'shg_activity'
  | 'school_activity'
  | 'community_meeting'
  | 'phone_coordination'
  | 'desk_job'
  | 'other';

export interface ActivityChoiceOption {
  key: ActivityChoiceKey;
  label: string;
  isDeskJob?: boolean;
}

export const ACTIVITY_CHOICES: ActivityChoiceOption[] = [
  { key: 'farmer_visit', label: 'Farmer Visit' },
  { key: 'farmer_group_meeting', label: 'Farmer Group Meeting' },
  { key: 'training', label: 'Training' },
  { key: 'demonstration', label: 'Demonstration' },
  { key: 'field_visit', label: 'Field Visit' },
  { key: 'survey_data_collection', label: 'Survey / Data Collection' },
  { key: 'seed_conservation', label: 'Seed Conservation' },
  { key: 'crop_conservation', label: 'Crop Conservation' },
  { key: 'livestock_dairy', label: 'Livestock / Dairy Activity' },
  { key: 'milk_collection', label: 'Milk Collection Coordination' },
  { key: 'market_linkage', label: 'Market Linkage' },
  { key: 'water_conservation', label: 'Water Conservation' },
  { key: 'nursery_activity', label: 'Nursery Activity' },
  { key: 'women_group_activity', label: 'Women Group Activity' },
  { key: 'shg_activity', label: 'SHG Activity' },
  { key: 'school_activity', label: 'School Activity' },
  { key: 'community_meeting', label: 'Community Meeting' },
  { key: 'phone_coordination', label: 'Phone Coordination' },
  { key: 'desk_job', label: 'Desk Job / Office Work', isDeskJob: true },
  { key: 'other', label: 'Other' },
];

export const SUPPORT_PROVIDED_OPTIONS = [
  { key: 'technical_guidance', label: 'Technical Guidance' },
  { key: 'input_linkage', label: 'Input Linkage' },
  { key: 'seed_support', label: 'Seed Support' },
  { key: 'crop_guidance', label: 'Crop Guidance' },
  { key: 'livestock_guidance', label: 'Livestock Guidance' },
  { key: 'dairy_guidance', label: 'Dairy Guidance' },
  { key: 'fodder_guidance', label: 'Fodder Guidance' },
  { key: 'market_linkage', label: 'Market Linkage' },
  { key: 'water_conservation_guidance', label: 'Water Conservation Guidance' },
  { key: 'documentation_support', label: 'Documentation Support' },
  { key: 'training', label: 'Training' },
  { key: 'phone_follow_up', label: 'Phone Follow-up' },
  { key: 'referral', label: 'Referral' },
  { key: 'other', label: 'Other' },
  { key: 'none', label: 'None' },
];

export const DESK_JOB_SUGGESTIONS = [
  'Data entry',
  'Report preparation',
  'Phone coordination',
  'Planning',
  'Documentation',
  'Meeting preparation',
  'Office correspondence',
  'Data compilation',
  'Other office work',
];

export interface FieldActivitySlot {
  activityId?: string; // Unique persistent document ID in erp_field_activities
  id?: string;
  slotNumber: number; // 1 to 20
  activityStatus?: ActivitySlotStatus;

  // Start Timing & Location
  activityStartAt?: string; // ISO string
  activityStart: string; // ISO string or datetime-local
  activityStartLocation?: GpsCoordinate | null;
  activityStartGps: GpsCoordinate | null;
  activityStartLocationStatus?: LocationCaptureStatus;

  // Activity Specification
  activityName: ActivityChoiceKey;
  activityNameLabel?: string;
  activityOther?: string;
  village?: string;
  wadi?: string;
  activityType?: 'single_farmer' | 'group' | 'group_meeting' | 'demonstration' | 'training' | 'other' | string;
  participantType?: string;
  farmerName?: string;
  groupDetails?: string;
  totalParticipants: number;
  maleParticipants: number;
  femaleParticipants: number;
  observations: string;
  farmerIssues?: string;
  supportProvided: string[]; // array of support keys or labels
  supportOther?: string;
  followUpRequired: boolean;
  followUpDetails?: string;
  followUpDate?: string;
  photoUrl?: string;
  videoUrl?: string;
  photoEvidence?: string[];
  videoEvidence?: string[];
  photoObjectKeys?: string[];
  photoMediaIds?: string[];
  photoMetadata?: EvidenceMetadataItem[];
  videoObjectKeys?: string[];
  videoMediaIds?: string[];
  videoMetadata?: EvidenceMetadataItem[];

  // End Timing & Location
  activityEndAt?: string; // ISO string
  activityEnd: string; // ISO string or datetime-local
  activityEndLocation?: GpsCoordinate | null;
  activityEndGps: GpsCoordinate | null;
  activityEndLocationStatus?: LocationCaptureStatus;
  activityDurationMinutes?: number;
  durationMinutes: number;

  // Synchronization & Timestamps
  syncStatus?: 'synced' | 'pending_sync' | 'saved_offline' | 'draft';
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
}

export interface FieldActivityRecord {
  activityId: string;
  id: string;
  reportId?: string;
  staffUid: string;
  employeeUid: string;
  employeeId: string;
  employeeName: string;
  departmentId?: string;
  departmentName?: string;
  centerId?: string;
  centerName?: string;
  reportDate: string; // YYYY-MM-DD
  slotNumber: number;

  activityStatus: ActivitySlotStatus;

  activityName: string | null;
  activityNameLabel?: string | null;
  activityOther?: string | null;
  village: string | null;
  wadi: string | null;

  activityStartAt: string; // ISO timestamp
  activityStartLocation: GpsCoordinate | null;
  activityStartGps?: GpsCoordinate | null;
  activityStartLocationStatus?: LocationCaptureStatus;

  activityEndAt: string | null; // ISO timestamp or null
  activityEndLocation: GpsCoordinate | null;
  activityEndGps?: GpsCoordinate | null;
  activityEndLocationStatus?: LocationCaptureStatus | null;

  activityDurationMinutes: number | null;
  durationMinutes?: number | null;

  participantType: string | null;
  activityType?: string | null;
  farmerName: string | null;
  groupDetails?: string | null;
  totalParticipants: number | null;
  maleParticipants: number | null;
  femaleParticipants: number | null;

  observations: string | null;
  farmerIssues: string | null;
  supportProvided: string[];
  supportOther?: string | null;
  followUpRequired: boolean;
  followUpDetails: string | null;
  followUpDate?: string | null;
  crpCode?: string;
  blockTaluka?: string;

  photoEvidence: string[];
  photoUrl?: string;
  photoObjectKeys?: string[];
  photoMediaIds?: string[];
  photoMetadata?: EvidenceMetadataItem[];
  videoEvidence: string[];
  videoUrl?: string;
  videoObjectKeys?: string[];
  videoMediaIds?: string[];
  videoMetadata?: EvidenceMetadataItem[];

  syncStatus?: 'synced' | 'pending_sync' | 'saved_offline';
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface EvidenceMetadataItem {
  objectKey?: string;
  mediaId?: string;
  mimeType: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy?: string;
  url?: string;
}

export interface FieldReportDailySummary {
  totalActivities: number;
  totalActivityMinutes: number;
  totalActivityHours: number;
  firstActivityStart: string | null;
  lastActivityEnd: string | null;
  totalWorkingPeriodMinutes: number;
  totalWorkingPeriodHours: number;
  totalParticipantContacts: number;
  totalMaleParticipants: number;
  totalFemaleParticipants: number;
  totalDeskJobMinutes: number;
  totalFieldActivityMinutes: number;
}

export interface FieldReport {
  id: string; // deterministic e.g. field_rep_${staffUid}_${reportDate}
  staffUid: string;
  employeeId: string;
  staffName: string;
  staffEmail: string;
  departmentId: string;
  departmentName: string;
  centerId: string;
  centerName: string;
  reportDate: string; // YYYY-MM-DD
  crpCode?: string;
  blockTaluka?: string;

  // Activities array (up to 20 bounded slots)
  activities: FieldActivitySlot[];

  // Consolidated Daily Summary
  summary: FieldReportDailySummary;

  // Finalization
  status: ReportStatus;
  finalized: boolean;
  finalizationTimestamp?: string;
  finalizationGps?: GpsCoordinate | null;
  finalizationLocationStatus?: LocationCaptureStatus;
  submittedAt?: string;
  resubmittedAt?: string;

  // Compliance & Reviews
  isLate?: boolean;
  hasLeaveConflict?: boolean;
  conflictDetails?: string;
  reviewerUid?: string;
  reviewerName?: string;
  reviewerRole?: string;
  reviewedAt?: string;
  reviewComments?: string;
  revisionNumber: number;
  editRequest?: EditRequestRecord;
  editRequestHistory?: EditRequestRecord[];
  lastApproval?: ApprovalHistoryRecord;
  approvalHistory?: ApprovalHistoryRecord[];

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Offline Sync metadata
  syncStatus?: 'synced' | 'pending_sync' | 'sync_failed' | 'saved_offline' | 'draft';
  idempotencyKey?: string;
}

export type LogoutType = 'explicit' | 'automatic_midnight';

export interface AttendanceSession {
  id: string; // deterministic e.g. att_${employeeUid}_${date}
  employeeUid: string;
  employeeId: string;
  employeeName: string;
  departmentId: string;
  departmentName?: string;
  centerId: string;
  centerName?: string;
  date: string; // YYYY-MM-DD (Asia/Kolkata)
  attendanceDate?: string;
  loginTimestamp: string;
  loginAt?: string;
  loginGps: GpsCoordinate | null;
  loginLocation?: GpsCoordinate | null;
  loginLocationStatus: LocationCaptureStatus;
  logoutTimestamp: string | null;
  logoutAt?: string | null;
  logoutGps: GpsCoordinate | null;
  logoutLocation?: GpsCoordinate | null;
  logoutLocationStatus: LocationCaptureStatus | null;
  logoutType: LogoutType | null;
  status: 'active' | 'closed';
  attendanceStatus?: 'active' | 'closed' | 'system_closed';
  attendanceDurationMinutes?: number;
  durationMinutes?: number;
  systemClosed?: boolean;
  syncStatus?: 'synced' | 'pending_sync' | 'saved_offline';
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeMonthlySummaryItem {
  employeeId: string;
  employeeName: string;
  employeeUid: string;
  departmentName: string;
  centerName: string;
  reportingMonth?: string;
  totalCalendarDays?: number;
  totalWorkingDays?: number;
  elapsedWorkingDays?: number;
  daysAttended?: number;
  presentDays?: number;
  absentDays?: number;
  upcomingDays?: number;
  attendancePercentage?: number | null;
  daysWithActivities?: number;
  totalActivities: number;
  completedActivities?: number;
  totalActivityMinutes?: number;
  totalActivityHours: number;
  totalWorkingPeriodMinutes?: number;
  totalWorkingHours: number;
  totalDeskJobHours: number;
  totalFieldActivityHours: number;
  totalFarmerContacts: number;
  totalMaleParticipants: number;
  totalFemaleParticipants: number;
  daysReportSubmitted: number;
  approvedActivityDays?: number;
  reportsApproved: number;
  daysRequiringCorrection?: number;
  reportsRequiringCorrection?: number;
  reportsRejected: number;
  reportsPendingReview: number;
  daysOnLeave?: number;
  leaveDays: number;
  missingAttendanceDays?: number;
  missingActivityDays?: number;
  daysReportMissing: number;
  lateSubmissions: number;
  totalDaysWorked: number;
  totalAttendanceSessions: number;
}

export interface EmployeeDailyActivityDetail {
  slotNumber: number;
  activityId?: string;
  activityName: string;
  activityNameLabel: string;
  activityOther?: string;
  activityType: string;
  village: string;
  wadi: string;
  farmerName?: string;
  groupDetails?: string;
  startTime: string;
  endTime: string;
  startTimeIso?: string;
  endTimeIso?: string;
  durationMinutes: number;
  participants: number;
  maleParticipants: number;
  femaleParticipants: number;
  observations: string;
  issues?: string;
  supportProvided: string[];
  supportOther?: string;
  followUpRequired: boolean;
  followUpDetails?: string;
  followUpDate?: string;
  startLocationName?: string;
  endLocationName?: string;
  startGps?: GpsCoordinate | null;
  endGps?: GpsCoordinate | null;
  photoUrl?: string;
  photoUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
  status?: string;
}

export interface EmployeeDailyRecordItem {
  date: string; // 1. Date
  dayOfWeek: string; // 2. Day
  attendanceStatus?: string; // 3. Attendance / Login Status
  attendanceLogin: string; // 4. Login Time
  attendanceLogout: string; // 5. Logout Time
  loginLocationName?: string;
  logoutLocationName?: string;
  activitySummary: string; // 6. Daily Activities
  activitiesCount: number; // 7. Activity Count
  activitiesList?: EmployeeDailyActivityDetail[];
  totalActivityDurationMinutes: number;
  totalActivityDurationFormatted?: string; // 8. Total Activity Duration
  workingPeriodMinutes: number;
  workingPeriodFormatted?: string; // 9. Working Period
  participantContacts: number; // 10. Total Participants
  maleParticipants: number; // 11. Male Participants
  femaleParticipants: number; // 12. Female Participants
  fieldActivityMinutes: number;
  fieldActivityTimeFormatted?: string; // 13. Field / Community Activity Time
  deskJobDurationMinutes: number;
  deskWorkTimeFormatted?: string; // 14. Desk Work Time
  leaveStatus?: string; // 15. Leave Status
  submissionStatus?: string; // 16. Submission Status
  activityCompletionStatus?: string; // Completed / In Progress / No Activities
  reviewStatus: string; // 17. Review Status
  reviewer?: string; // 18. Reviewer
  reviewRemarks?: string; // 19. Review Remarks
  gpsAvailability?: string; // 20. GPS Availability
  
  // Additional metadata & backward compatibility
  employeeId: string;
  employeeName: string;
  employeeUid: string;
  loginLocation: string;
  logoutLocation: string;
  loginGps: GpsCoordinate | null;
  logoutGps: GpsCoordinate | null;
  logoutType: LogoutType | null;
  firstActivityStart: string;
  lastActivityEnd: string;
  submissionTimestamp: string;
  reportStatus: string;
  finalizationLocation: string;
  finalizationGps: GpsCoordinate | null;
  isMissing: boolean;
  isWeeklyOff?: boolean;
  isHoliday?: boolean;
  holidayName?: string;
  reportId?: string;
}

export interface MonthlyReportsDataset {
  year: number;
  month: number;
  monthName: string;
  filters: {
    departmentId?: string;
    centerId?: string;
    employeeUid?: string;
    status?: string;
  };
  employeeSummaries: EmployeeMonthlySummaryItem[];
  dailyRecords: EmployeeDailyRecordItem[];
  allActivities: Array<{
    reportDate: string;
    employeeId: string;
    employeeName: string;
    departmentName?: string;
    centerName?: string;
    crpCode?: string;
    blockTaluka?: string;
    slotNumber: number;
    activityStatus?: string;
    activityName: string;
    activityOther?: string;
    activityType: string;
    village: string;
    wadi: string;
    farmerName?: string;
    groupDetails?: string;
    startTime: string;
    endTime: string;
    startTimeIso?: string;
    endTimeIso?: string;
    durationMinutes: number;
    participants: number;
    maleParticipants: number;
    femaleParticipants: number;
    observations: string;
    issues?: string;
    supportProvided: string;
    supportOther?: string;
    followUpRequired?: boolean;
    followUpDetails?: string;
    followUpDate?: string;
    followUp: string;
    startGps: string;
    startGpsCoords?: string;
    startGpsLocationName?: string;
    startAccuracy?: string;
    endGps: string;
    endGpsCoords?: string;
    endGpsLocationName?: string;
    endAccuracy?: string;
    photoEvidenceRefs?: string;
    photoUrls?: string[];
    photoObjectKeys?: string[];
    photoMediaIds?: string[];
    videoEvidenceRefs?: string;
    videoUrls?: string[];
    videoObjectKeys?: string[];
    videoMediaIds?: string[];
    reviewStatus?: string;
    reviewerName?: string;
    reviewComments?: string;
    correctionHistory?: string;
  }>;
  attendanceRecords: Array<{
    employeeId: string;
    employeeName: string;
    attendanceDate: string;
    loginTimestamp: string;
    logoutTimestamp: string;
    loginGps: string;
    logoutGps: string;
    loginAccuracy: string;
    logoutAccuracy: string;
    logoutType: string;
    attendanceStatus: string;
    workingDuration?: string;
  }>;
  leaveRecords: Array<{
    employeeId: string;
    employeeName: string;
    date: string;
    leaveType: string;
    reason: string;
    approvalStatus: string;
    approvedBy: string;
  }>;
  reviewHistory: Array<{
    employeeId: string;
    employeeName: string;
    reportDate: string;
    submittedTimestamp: string;
    reviewTimestamp: string;
    reviewer: string;
    reviewStatus: string;
    remarks: string;
    correctionHistory: string;
  }>;
}