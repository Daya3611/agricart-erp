import fs from 'node:fs/promises';
import path from 'node:path';
import { adminStorage } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { fetchCollection, updateDocument } from '@/lib/firebase/firestore';
import { UserProfile } from '@/types';
import { MediaEntityType, MediaRecord } from './media-types';
import { uploadMediaFile } from './media';
import { isR2Configured } from './r2';

export interface LegacyMediaMigrationReport {
  success: boolean;
  scannedAttachments: number;
  migratedCount: number;
  skippedCount: number;
  errors: Array<{ id: string; reason: string }>;
}

async function loadLegacyBuffer(storagePath?: string, downloadUrl?: string): Promise<Buffer | null> {
  const cleanPath = (storagePath || '').replace(/\.\./g, '').replace(/^\/+/, '');
  if (cleanPath) {
    try {
      const fileRef = adminStorage.bucket().file(cleanPath);
      const [exists] = await fileRef.exists();
      if (exists) {
        const [bytes] = await fileRef.download();
        return Buffer.from(bytes);
      }
    } catch {
      // Fallback to local filesystem or HTTP
    }

    try {
      const localPath = path.join(process.cwd(), 'storage', 'uploads', cleanPath);
      return await fs.readFile(localPath);
    } catch {
      // Not on local disk
    }
  }

  if (downloadUrl && /^https?:\/\//i.test(downloadUrl) && !downloadUrl.includes('/api/uploads/view')) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(downloadUrl, { signal: controller.signal });
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch {
      // Ignore network fetch failure
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

/**
 * Safely copies legacy report attachments (Firebase Storage, Cloudinary, or local disk)
 * into Cloudflare R2 without deleting old source files, recording canonical `erp_media` entries.
 */
export async function migrateLegacyReportMediaToR2(actor: UserProfile, limit = 50): Promise<LegacyMediaMigrationReport> {
  if (!isR2Configured()) {
    throw new Error('R2_NOT_CONFIGURED: Configure Cloudflare R2 environment variables before migrating media.');
  }

  const attachments = (await fetchCollection(ERP_COLLECTIONS.reportAttachments)) as Array<{
    id: string;
    reportId: string;
    staffUid?: string;
    storagePath?: string;
    downloadUrl?: string;
    originalFilename?: string;
    mimeType?: string;
    r2ObjectKey?: string;
    mediaId?: string;
  }>;

  const report: LegacyMediaMigrationReport = {
    success: true,
    scannedAttachments: 0,
    migratedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  for (const att of attachments.slice(0, limit)) {
    report.scannedAttachments += 1;

    if (att.r2ObjectKey || att.mediaId) {
      report.skippedCount += 1;
      continue;
    }

    try {
      const buffer = await loadLegacyBuffer(att.storagePath, att.downloadUrl);
      if (!buffer || buffer.length === 0) {
        report.skippedCount += 1;
        continue;
      }

      const uploaded = await uploadMediaFile({
        fileName: att.originalFilename || `legacy_${att.id}.jpg`,
        mimeType: att.mimeType || 'image/jpeg',
        buffer,
        entityType: 'report' satisfies MediaEntityType,
        entityId: att.reportId || att.id,
        uploadedBy: actor,
        isPublic: false,
        validation: { allowDocuments: true, allowVideos: true },
      });

      const migratedRecord: Partial<MediaRecord> = {
        legacySourceUrl: att.downloadUrl || att.storagePath || '',
      };
      await updateDocument(ERP_COLLECTIONS.media, uploaded.record.id, migratedRecord);

      await updateDocument(ERP_COLLECTIONS.reportAttachments, att.id, {
        r2ObjectKey: uploaded.record.objectKey,
        mediaId: uploaded.record.id,
        downloadUrl: uploaded.resolvedUrl,
      });

      report.migratedCount += 1;
    } catch (err: any) {
      report.errors.push({ id: att.id, reason: err?.message || 'Unknown migration error' });
    }
  }

  return report;
}

