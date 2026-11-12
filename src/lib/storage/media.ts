import crypto from 'node:crypto';
import { adminDb, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { fetchCollection, fetchDocument, saveDocument, updateDocument, deleteDocument } from '@/lib/firebase/firestore';
import { logAuditAction } from '@/lib/services/audit-service';
import { UserProfile } from '@/types';
import {
  MediaEntityType,
  MediaRecord,
  MediaValidationOptions,
  buildR2ObjectKey,
  sanitizeEntityId,
  validateMediaUpload,
} from './media-types';
import {
  buildR2PublicUrl,
  deleteObjectFromR2,
  getObjectFromR2,
  getSignedR2DownloadUrl,
  isR2Configured,
  normalizeObjectKey,
  uploadObjectToR2,
} from './r2';

export interface UploadMediaParams {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  entityType: MediaEntityType;
  entityId: string;
  uploadedBy: UserProfile;
  centerId?: string;
  isPublic?: boolean;
  setAsPrimary?: boolean;
  caption?: string;
  validation?: MediaValidationOptions;
}

export interface UploadMediaResult {
  record: MediaRecord;
  resolvedUrl: string;
}

function defaultVisibilityForEntity(entityType: MediaEntityType): boolean {
  switch (entityType) {
    case 'product':
    case 'center':
    case 'user':
    case 'organization':
      return true;
    case 'farmer':
    case 'report':
    case 'activity':
    case 'leave':
    case 'document':
    default:
      return false;
  }
}

export function resolveMediaDisplayUrl(record: MediaRecord): string {
  if (record.isPublic) {
    if (record.objectKey && record.storageProvider === 'r2') {
      return buildR2PublicUrl(record.objectKey);
    }
    if (record.publicUrl) return record.publicUrl;
  }
  return `/api/v1/media/${encodeURIComponent(record.id)}`;
}

export async function resolveMediaAccessUrl(
  record: MediaRecord,
  options: { signed?: boolean; expiresInSeconds?: number } = {}
): Promise<string> {
  if (record.isPublic) {
    if (record.objectKey && (!record.storageProvider || record.storageProvider === 'r2')) {
      return buildR2PublicUrl(record.objectKey);
    }
    if (record.publicUrl) return record.publicUrl;
  }

  if (options.signed && record.objectKey && record.storageProvider === 'r2' && isR2Configured()) {
    return getSignedR2DownloadUrl(record.objectKey, options.expiresInSeconds ?? 900);
  }

  if (record.publicUrl && record.storageProvider !== 'r2') {
    return record.publicUrl;
  }

  return `/api/v1/media/${encodeURIComponent(record.id)}`;
}

async function syncPrimaryEntityReference(
  record: MediaRecord,
  previousPrimaryMediaId?: string
): Promise<void> {
  const now = new Date().toISOString();
  const displayUrl = resolveMediaDisplayUrl(record);

  if (record.entityType === 'user') {
    await updateDocument(ERP_COLLECTIONS.employees, record.entityId, {
      avatarUrl: displayUrl,
      avatarMediaId: record.id,
      avatarObjectKey: record.objectKey,
      updatedAt: now,
    });
  } else if (record.entityType === 'center') {
    const existing = (await fetchDocument(ERP_COLLECTIONS.centers, record.entityId)) as any;
    if (existing) {
      const mediaIds = Array.from(new Set([...(existing.mediaIds || []), record.id]));
      await updateDocument(ERP_COLLECTIONS.centers, record.entityId, {
        photoUrl: displayUrl,
        logoUrl: displayUrl,
        photoMediaId: record.id,
        photoObjectKey: record.objectKey,
        mediaIds,
        updatedAt: now,
      });
    }
  } else if (record.entityType === 'organization') {
    const settingsDoc = (await fetchDocument(ERP_COLLECTIONS.systemSettings, 'global')) as any;
    if (settingsDoc) {
      await updateDocument(ERP_COLLECTIONS.systemSettings, 'global', {
        companyLogoUrl: displayUrl,
        companyLogoKey: record.objectKey,
        companyLogoMediaId: record.id,
        'reportingConfig.organization.companyLogoUrl': displayUrl,
        'reportingConfig.organization.companyLogoKey': record.objectKey,
        'reportingConfig.organization.companyLogoMediaId': record.id,
        updatedAt: now,
      });
    }
  }

  // Unset previous primary flag in erp_media if replaced cleanly
  if (previousPrimaryMediaId && previousPrimaryMediaId !== record.id) {
    await updateDocument(ERP_COLLECTIONS.media, previousPrimaryMediaId, { isPrimary: false }).catch(() => {});
  }
}

export async function uploadMediaFile(params: UploadMediaParams): Promise<UploadMediaResult> {
  if (!isR2Configured()) {
    throw new Error(
      'R2_NOT_CONFIGURED: Cloudflare R2 credentials are not configured on the server. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_ENDPOINT.'
    );
  }

  const cleanEntityId = sanitizeEntityId(params.entityId);
  const validated = validateMediaUpload(
    {
      fileName: params.fileName,
      mimeType: params.mimeType,
      buffer: params.buffer,
    },
    params.validation
  );

  const objectKey = buildR2ObjectKey(params.entityType, cleanEntityId, validated.ext);
  const isPublic = params.isPublic ?? defaultVisibilityForEntity(params.entityType);

  const uploaded = await uploadObjectToR2({
    objectKey,
    body: params.buffer,
    contentType: validated.mimeType,
    cacheControl: isPublic ? 'public, max-age=31536000, immutable' : 'private, max-age=3600',
    metadata: {
      entitytype: params.entityType,
      entityid: cleanEntityId,
      uploadedby: params.uploadedBy.uid,
      centerid: params.centerId || '',
    },
  });

  const mediaId = `med_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const nowIso = new Date().toISOString();

  // Identify existing primary record so we can demote isPrimary cleanly when replacing
  let previousPrimaryId: string | undefined;
  if (params.setAsPrimary) {
    const existingList = await listMediaByEntity(params.entityType, cleanEntityId);
    previousPrimaryId = existingList.find((m) => m.isPrimary)?.id;
  }

  const record: MediaRecord = {
    id: mediaId,
    entityType: params.entityType,
    entityId: cleanEntityId,
    fileName: validated.safeFileName,
    objectKey: uploaded.objectKey,
    publicUrl: isPublic ? uploaded.publicUrl : undefined,
    mimeType: validated.mimeType,
    size: validated.size,
    ...(validated.width !== undefined ? { width: validated.width } : {}),
    ...(validated.height !== undefined ? { height: validated.height } : {}),
    uploadedBy: params.uploadedBy.uid,
    uploadedByName: params.uploadedBy.fullName,
    uploadedAt: nowIso,
    ...(params.centerId ? { centerId: params.centerId } : {}),
    isPublic,
    isPrimary: Boolean(params.setAsPrimary),
    ...(params.caption ? { caption: params.caption.trim().slice(0, 300) } : {}),
    storageProvider: 'r2',
  };

  await saveDocument(ERP_COLLECTIONS.media, mediaId, record);

  if (params.setAsPrimary) {
    await syncPrimaryEntityReference(record, previousPrimaryId);
  } else if (params.entityType === 'center') {
    const centerDoc = (await fetchDocument(ERP_COLLECTIONS.centers, cleanEntityId)) as any;
    if (centerDoc) {
      const mediaIds = Array.from(new Set([...(centerDoc.mediaIds || []), mediaId]));
      await updateDocument(ERP_COLLECTIONS.centers, cleanEntityId, { mediaIds, updatedAt: nowIso });
    }
  }

  await logAuditAction({
    actorUid: params.uploadedBy.uid,
    actorName: params.uploadedBy.fullName,
    actorRole: params.uploadedBy.role,
    action: 'upload_media',
    resourceType: 'media',
    resourceId: mediaId,
    details: `Uploaded ${validated.mimeType} (${validated.size} bytes) to R2 key ${uploaded.objectKey} for ${params.entityType}:${cleanEntityId}`,
    newValues: {
      entityType: params.entityType,
      entityId: cleanEntityId,
      objectKey: uploaded.objectKey,
      mimeType: validated.mimeType,
      size: validated.size,
      isPublic,
    },
  });

  const resolvedUrl = resolveMediaDisplayUrl(record);
  return { record, resolvedUrl };
}

export async function getMediaRecordById(mediaId: string): Promise<MediaRecord | null> {
  if (!mediaId) return null;
  const doc = (await fetchDocument(ERP_COLLECTIONS.media, mediaId)) as MediaRecord | null;
  return doc || null;
}

export async function getMediaRecordsBatch(mediaIds: string[]): Promise<Map<string, MediaRecord>> {
  const uniqueIds = Array.from(new Set(mediaIds.filter(Boolean)));
  const result = new Map<string, MediaRecord>();
  if (uniqueIds.length === 0) return result;

  if (hasValidAdminCredentials) {
    // Firestore getAll avoids N+1 round trips
    const refs = uniqueIds.map((id) => adminDb.collection(ERP_COLLECTIONS.media).doc(id));
    for (let i = 0; i < refs.length; i += 100) {
      const chunk = refs.slice(i, i + 100);
      const snaps = await adminDb.getAll(...chunk);
      for (const snap of snaps) {
        if (snap.exists) {
          result.set(snap.id, { id: snap.id, ...(snap.data() as Omit<MediaRecord, 'id'>) });
        }
      }
    }
    return result;
  }

  const docs = await Promise.all(uniqueIds.map((id) => getMediaRecordById(id)));
  for (const doc of docs) {
    if (doc) result.set(doc.id, doc);
  }
  return result;
}

export async function listMediaByEntity(
  entityType: MediaEntityType,
  entityId: string
): Promise<MediaRecord[]> {
  const cleanId = sanitizeEntityId(entityId);
  const rows = (await fetchCollection(ERP_COLLECTIONS.media, [
    { field: 'entityType', op: '==', value: entityType },
    { field: 'entityId', op: '==', value: cleanId },
  ])) as MediaRecord[];

  return rows.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
}

export async function readMediaObjectBuffer(record: MediaRecord): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (record.objectKey && (!record.storageProvider || record.storageProvider === 'r2') && isR2Configured()) {
    const obj = await getObjectFromR2(normalizeObjectKey(record.objectKey));
    if (obj) {
      return {
        buffer: obj.buffer,
        mimeType: obj.contentType || record.mimeType || 'application/octet-stream',
      };
    }
  }
  return null;
}

export async function isMediaActivelyReferenced(record: MediaRecord): Promise<string | null> {
  if (record.entityType === 'user') {
    const emp = (await fetchDocument(ERP_COLLECTIONS.employees, record.entityId)) as any;
    if (emp && (emp.avatarMediaId === record.id || (emp.avatarObjectKey && emp.avatarObjectKey === record.objectKey))) {
      return `Active profile avatar on employee ${emp.fullName || record.entityId}`;
    }
  } else if (record.entityType === 'center') {
    const center = (await fetchDocument(ERP_COLLECTIONS.centers, record.entityId)) as any;
    if (center && (center.photoMediaId === record.id || center.photoObjectKey === record.objectKey)) {
      return `Active primary photo on center ${center.name || record.entityId}`;
    }
  } else if (record.entityType === 'organization') {
    const settings = (await fetchDocument(ERP_COLLECTIONS.systemSettings, 'global')) as any;
    if (settings && settings.companyLogoMediaId === record.id) {
      return 'Active organization branding logo in System Settings';
    }
  } else if (record.entityType === 'report' || record.entityType === 'activity') {
    const report = (await fetchDocument(ERP_COLLECTIONS.fieldReports, record.entityId)) as any;
    if (report && ['submitted', 'under_review', 'approved'].includes(report.status)) {
      return `Attached to ${report.status.replace(/_/g, ' ')} field report ${record.entityId}`;
    }
  }
  return null;
}

export async function deleteMediaById(
  mediaId: string,
  actor: UserProfile,
  options: { force?: boolean; detachEntityReference?: boolean } = {}
): Promise<void> {
  const record = await getMediaRecordById(mediaId);
  if (!record) {
    throw new Error('NOT_FOUND: Media record does not exist.');
  }

  const refReason = await isMediaActivelyReferenced(record);
  if (refReason && !options.force && !options.detachEntityReference) {
    throw new Error(`CONFLICT: Cannot delete media while actively referenced (${refReason}). Replace it or detach first.`);
  }

  if (options.detachEntityReference) {
    const now = new Date().toISOString();
    if (record.entityType === 'user') {
      await updateDocument(ERP_COLLECTIONS.employees, record.entityId, {
        avatarUrl: '',
        avatarMediaId: '',
        avatarObjectKey: '',
        updatedAt: now,
      }).catch(() => {});
    } else if (record.entityType === 'center') {
      const center = (await fetchDocument(ERP_COLLECTIONS.centers, record.entityId)) as any;
      if (center) {
        const nextMediaIds = Array.isArray(center.mediaIds)
          ? center.mediaIds.filter((id: string) => id !== record.id)
          : [];
        const patch: Record<string, any> = { mediaIds: nextMediaIds, updatedAt: now };
        if (center.photoMediaId === record.id) {
          patch.photoUrl = '';
          patch.logoUrl = '';
          patch.photoMediaId = '';
          patch.photoObjectKey = '';
        }
        await updateDocument(ERP_COLLECTIONS.centers, record.entityId, patch).catch(() => {});
      }
    } else if (record.entityType === 'organization') {
      await updateDocument(ERP_COLLECTIONS.systemSettings, 'global', {
        companyLogoUrl: '/logo.png',
        companyLogoKey: '',
        companyLogoMediaId: '',
        'reportingConfig.organization.companyLogoUrl': '/logo.png',
        'reportingConfig.organization.companyLogoKey': '',
        'reportingConfig.organization.companyLogoMediaId': '',
        updatedAt: now,
      }).catch(() => {});
    }
  }

  if (record.objectKey && (!record.storageProvider || record.storageProvider === 'r2') && isR2Configured()) {
    await deleteObjectFromR2(record.objectKey);
  }

  await deleteDocument(ERP_COLLECTIONS.media, mediaId);

  await logAuditAction({
    actorUid: actor.uid,
    actorName: actor.fullName,
    actorRole: actor.role,
    action: 'delete_media',
    resourceType: 'media',
    resourceId: mediaId,
    details: `Deleted R2 object ${record.objectKey} (${record.entityType}:${record.entityId})`,
    previousValues: {
      objectKey: record.objectKey,
      entityType: record.entityType,
      entityId: record.entityId,
    },
  });
}

