import Dexie, { type Table } from 'dexie';
import { FieldReport, FieldActivitySlot } from '@/types';

export interface OfflineReportDraft {
  id: string; // usually `field_rep_${staffUid}_${reportDate}`
  staffUid: string;
  reportDate: string;
  crpCode?: string;
  blockTaluka?: string;
  activities: FieldActivitySlot[];
  finalized: boolean;
  finalizationTimestamp?: string;
  finalizationGps?: any;
  finalizationLocationStatus?: any;
  syncStatus: 'draft' | 'saved_offline' | 'pending_sync' | 'syncing' | 'synced' | 'sync_failed';
  lastSyncAttempt?: string;
  syncError?: string;
  idempotencyKey: string;
  updatedAt: string;
}

export interface OfflineMediaItem {
  id: string;
  reportId: string;
  slotNumber: number;
  type: 'photo' | 'video';
  fileBlob: Blob;
  filename: string;
  mimeType: string;
  caption?: string;
  uploadedUrl?: string;
  uploaded: boolean;
  createdAt: string;
}

export interface OfflineAttendanceSession {
  id: string; // `att_${employeeUid}_${date}`
  employeeUid: string;
  employeeId: string;
  attendanceDate: string;
  action: 'login' | 'logout';
  sessionData: any;
  syncStatus: 'saved_offline' | 'pending_sync' | 'synced' | 'sync_failed';
  updatedAt: string;
}

export interface OfflineActivityItem {
  activityId: string; // e.g. act_...
  reportId?: string;
  staffUid: string;
  employeeId: string;
  employeeName: string;
  reportDate: string;
  slotNumber: number;
  activityStatus: 'IN_PROGRESS' | 'COMPLETED' | 'in_progress' | 'completed';
  activityData: any;
  syncStatus: 'saved_offline' | 'pending_sync' | 'synced' | 'sync_failed';
  updatedAt: string;
}

export class AgricartOfflineDatabase extends Dexie {
  fieldReportDrafts!: Table<OfflineReportDraft, string>;
  offlineMedia!: Table<OfflineMediaItem, string>;
  offlineAttendance!: Table<OfflineAttendanceSession, string>;
  offlineActivities!: Table<OfflineActivityItem, string>;

  constructor() {
    super('AgricartOfflineDB');
    this.version(1).stores({
      fieldReportDrafts: 'id, staffUid, reportDate, syncStatus, updatedAt',
      offlineMedia: 'id, reportId, slotNumber, uploaded, createdAt',
    });
    this.version(2).stores({
      fieldReportDrafts: 'id, staffUid, reportDate, syncStatus, updatedAt',
      offlineMedia: 'id, reportId, slotNumber, uploaded, createdAt',
      offlineAttendance: 'id, employeeUid, attendanceDate, syncStatus, updatedAt',
    });
    this.version(3).stores({
      fieldReportDrafts: 'id, staffUid, reportDate, syncStatus, updatedAt',
      offlineMedia: 'id, reportId, slotNumber, uploaded, createdAt',
      offlineAttendance: 'id, employeeUid, attendanceDate, syncStatus, updatedAt',
      offlineActivities: 'activityId, staffUid, reportDate, slotNumber, activityStatus, syncStatus, updatedAt',
    });
  }
}

let dbInstance: AgricartOfflineDatabase | null = null;

export function getOfflineDb(): AgricartOfflineDatabase {
  if (typeof window === 'undefined') {
    return new AgricartOfflineDatabase();
  }
  if (!dbInstance) {
    dbInstance = new AgricartOfflineDatabase();
  }
  return dbInstance;
}
