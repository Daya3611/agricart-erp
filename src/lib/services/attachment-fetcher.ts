import {
  createReportMediaResolver,
  MediaFailureReason,
  ReportMediaResolver,
} from '@/lib/reports/media-resolver';
import { ReportAttachment } from '@/types';

export interface FetchedAttachmentData {
  id: string;
  reportDate: string;
  originalFilename: string;
  caption?: string;
  fileSize: number;
  uploadedAt: string;
  downloadUrl?: string;
  isVideo: boolean;
  isUnavailable: boolean;
  failureReason?: MediaFailureReason;
  buffer?: Buffer;
  format?: 'PNG' | 'JPEG' | 'WEBP';
  width?: number;
  height?: number;
  aspectRatio?: number;
  base64DataUrl?: string;
}

/**
 * Redacts credentials/signing parameters from a presigned URL so logs never leak signatures.
 */
function redactUrlForLog(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}${parsed.search ? '?[signed-params-redacted]' : ''}`;
  } catch {
    return rawUrl.split('?')[0];
  }
}

/**
 * Server-side authorized attachment fetcher powered by ReportMediaResolver.
 * Supports R2 object keys, presigned R2 URLs (respecting expiration), erp_media IDs,
 * Firebase Cloud Storage, local storage/uploads, inline data URLs, and legacy external URLs.
 */
export async function fetchAttachmentData(
  att: ReportAttachment,
  reportDate: string,
  resolver?: ReportMediaResolver
): Promise<FetchedAttachmentData> {
  const candidateUrl = (att.downloadUrl || att.storagePath || '').trim();
  const pathWithoutQuery = candidateUrl.split('?')[0].toLowerCase();
  const filenameLower = (att.originalFilename || '').toLowerCase();

  const isVideo =
    att.mimeType?.startsWith('video/') ||
    ['.mp4', '.mov', '.webm', '.avi', '.mkv'].some(
      (ext) => filenameLower.endsWith(ext) || pathWithoutQuery.endsWith(ext)
    );

  if (isVideo) {
    return {
      id: att.id,
      reportDate,
      originalFilename: att.originalFilename || 'video_attachment.mp4',
      caption: att.caption,
      fileSize: att.fileSize || 0,
      uploadedAt: att.uploadedAt || new Date().toISOString(),
      downloadUrl: att.downloadUrl || att.storagePath,
      isVideo: true,
      isUnavailable: false,
    };
  }

  const activeResolver = resolver || createReportMediaResolver();
  const { asset: resolved, failureReason } = await activeResolver.resolveImageAssetWithOutcome({
    url: att.downloadUrl || att.storagePath,
    storagePath: att.storagePath,
    mediaId: att.mediaId,
    objectKey: att.objectKey || att.r2ObjectKey,
  });

  if (!resolved || !resolved.pdfFormat) {
    const reason = failureReason || (!resolved ? 'unavailable' : 'invalid_format');
    console.warn(
      `[Export Diagnostics] Attachment fetch ${reason} for ${att.id} (${att.originalFilename}) url=${redactUrlForLog(candidateUrl)}`
    );
    return {
      id: att.id,
      reportDate,
      originalFilename: att.originalFilename || 'photo.jpg',
      caption: att.caption,
      fileSize: att.fileSize || 0,
      uploadedAt: att.uploadedAt || new Date().toISOString(),
      downloadUrl: att.downloadUrl || att.storagePath,
      isVideo: false,
      isUnavailable: true,
      failureReason: reason,
    };
  }

  return {
    id: att.id,
    reportDate,
    originalFilename: att.originalFilename || 'photo.jpg',
    caption: att.caption,
    fileSize: att.fileSize || resolved.buffer.length,
    uploadedAt: att.uploadedAt || new Date().toISOString(),
    downloadUrl: resolved.resolvedUrl || att.downloadUrl || att.storagePath,
    isVideo: false,
    isUnavailable: false,
    buffer: resolved.buffer,
    format: resolved.pdfFormat,
    width: resolved.width,
    height: resolved.height,
    aspectRatio: resolved.aspectRatio,
    base64DataUrl: resolved.base64DataUrl,
  };
}
