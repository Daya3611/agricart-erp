import { adminDb } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { AuditLog, UserRole } from '@/types';


export async function logAuditAction({
  actorUid,
  actorName,
  actorRole,
  action,
  resourceType,
  resourceId,
  details,
  previousValues,
  newValues,
  ipAddress,
}: {
  actorUid?: string;
  actorName?: string;
  actorRole?: UserRole;
  action: string;
  resourceType: AuditLog['resourceType'];
  resourceId?: string;
  details?: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
}) {
  try {
    const docRef = adminDb.collection(ERP_COLLECTIONS.auditLogs).doc();
    const now = new Date().toISOString();

    const rawEntry: Record<string, any> = {
      id: docRef.id,
      actorUid: actorUid || 'system',
      actorName: actorName || 'System User',
      actorRole: actorRole || 'staff',
      action: action || 'unknown_action',
      resourceType: resourceType || 'system',
      resourceId: resourceId || 'N/A',
      details: details || '',
      ipAddress: ipAddress || '127.0.0.1',
      createdAt: now,
    };

    if (previousValues !== undefined) rawEntry.previousValues = previousValues;
    if (newValues !== undefined) rawEntry.newValues = newValues;

    // Filter out any undefined values from rawEntry
    const auditEntry = Object.fromEntries(
      Object.entries(rawEntry).filter(([_, v]) => v !== undefined)
    );

    await docRef.set(auditEntry);
  } catch (err) {
    console.error('Failed to log audit action:', err);
  }
}

