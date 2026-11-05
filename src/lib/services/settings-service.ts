import { fetchDocument, saveDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { SystemSettings, GlobalReportingConfig } from '@/types';
import { DEFAULT_SYSTEM_SETTINGS, DEFAULT_GLOBAL_REPORTING_CONFIG } from '@/lib/constants/reporting-defaults';

/**
 * Cached in-memory copy with short TTL (30 seconds) for fast repetitive queries
 */
let cachedSettings: SystemSettings | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30 * 1000;

export async function getSystemSettings(): Promise<SystemSettings> {
  const now = Date.now();
  if (cachedSettings && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedSettings;
  }

  try {
    const doc = (await fetchDocument(ERP_COLLECTIONS.systemSettings, 'global')) as SystemSettings | null;

    if (!doc) {
      cachedSettings = DEFAULT_SYSTEM_SETTINGS;
      lastFetchTime = now;
      return DEFAULT_SYSTEM_SETTINGS;
    }

    // Deep merge with defaults to protect against undefined fields
    const merged: SystemSettings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...doc,
      reportingSettings: {
        ...DEFAULT_SYSTEM_SETTINGS.reportingSettings,
        ...(doc.reportingSettings || {}),
      },
      reminderSettings: {
        ...DEFAULT_SYSTEM_SETTINGS.reminderSettings,
        ...(doc.reminderSettings || {}),
      },
      emailSettings: {
        ...DEFAULT_SYSTEM_SETTINGS.emailSettings,
        ...(doc.emailSettings || {}),
      },
      reportingConfig: {
        ...DEFAULT_GLOBAL_REPORTING_CONFIG,
        ...(doc.reportingConfig || {}),
        pdfSettings: {
          ...DEFAULT_GLOBAL_REPORTING_CONFIG.pdfSettings,
          ...(doc.reportingConfig?.pdfSettings || {}),
        },
        docxSettings: {
          ...DEFAULT_GLOBAL_REPORTING_CONFIG.docxSettings,
          ...(doc.reportingConfig?.docxSettings || {}),
        },
        excelSettings: {
          ...DEFAULT_GLOBAL_REPORTING_CONFIG.excelSettings,
          ...(doc.reportingConfig?.excelSettings || {}),
        },
        requiredActivityFields: {
          ...DEFAULT_GLOBAL_REPORTING_CONFIG.requiredActivityFields,
          ...(doc.reportingConfig?.requiredActivityFields || {}),
        },
        exportPermissions: {
          ...DEFAULT_GLOBAL_REPORTING_CONFIG.exportPermissions,
          ...(doc.reportingConfig?.exportPermissions || {}),
        },
        organization: {
          ...DEFAULT_GLOBAL_REPORTING_CONFIG.organization,
          ...(doc.reportingConfig?.organization || {}),
        },
      },
    };

    cachedSettings = merged;
    lastFetchTime = now;
    return merged;
  } catch (err) {
    console.warn('Failed to load system settings from Firestore, using default:', err);
    return DEFAULT_SYSTEM_SETTINGS;
  }
}

export async function getGlobalReportingSettings(): Promise<GlobalReportingConfig> {
  const systemSettings = await getSystemSettings();
  return systemSettings.reportingConfig || DEFAULT_GLOBAL_REPORTING_CONFIG;
}

export function invalidateSettingsCache(): void {
  cachedSettings = null;
  lastFetchTime = 0;
}

