import fs from 'fs/promises';
import path from 'path';
import { adminStorage } from '@/lib/firebase/admin';
import { ReportAttachment } from '@/types';

export interface FetchedAttachmentData {
  id: string;
  reportDate: string;
  originalFilename: string;
  caption?: string;
  fileSize: number;
  uploadedAt: string;
  isVideo: boolean;
  isUnavailable: boolean;
  buffer?: Buffer;
  format?: 'PNG' | 'JPEG';
  width?: number;
  height?: number;
  aspectRatio?: number;
  base64DataUrl?: string;
}

/**
 * Extracts natural image dimensions from PNG or JPEG buffers.
 */
function getImageDimensions(buffer: Buffer): { width: number; height: number; format: 'PNG' | 'JPEG' | 'UNKNOWN' } {
  // PNG: signature 89 50 4E 47
  if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      format: 'PNG',
    };
  }
  // JPEG: starts with FF D8
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
      if (marker >= 0xc0 && marker <= 0xc3) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height, format: 'JPEG' };
      }
      const len = buffer.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  }
  return { width: 800, height: 600, format: 'UNKNOWN' };
}

/**
 * Server-side authorized attachment fetcher.
 * Retrieves binary image bytes directly from Firebase Cloud Storage or local disk fallback.
 */
export async function fetchAttachmentData(
  att: ReportAttachment,
  reportDate: string
): Promise<FetchedAttachmentData> {
  const isVideo =
    att.mimeType?.startsWith('video/') ||
    ['.mp4', '.mov', '.webm', '.avi', '.mkv'].some((ext) =>
      att.originalFilename?.toLowerCase().endsWith(ext)
    );

  if (isVideo) {
    console.log(`[Monthly Export Diagnostics] Attachment ${att.id} (${att.originalFilename}) identified as video.`);
    return {
      id: att.id,
      reportDate,
      originalFilename: att.originalFilename || 'video_attachment.mp4',
      caption: att.caption,
      fileSize: att.fileSize || 0,
      uploadedAt: att.uploadedAt || new Date().toISOString(),
      isVideo: true,
      isUnavailable: false,
    };
  }

  const rawPath = att.storagePath || '';
  const sanitizedPath = rawPath.replace(/\.\./g, '').replace(/^\/+/, '');

  if (!sanitizedPath) {
    console.warn(`[Monthly Export Diagnostics] Attachment ${att.id} has empty storagePath.`);
    return {
      id: att.id,
      reportDate,
      originalFilename: att.originalFilename || 'photo.jpg',
      caption: att.caption,
      fileSize: att.fileSize || 0,
      uploadedAt: att.uploadedAt || new Date().toISOString(),
      isVideo: false,
      isUnavailable: true,
    };
  }

  let fileBuffer: Buffer | null = null;

  // 1. Try Firebase Cloud Storage
  try {
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(sanitizedPath);
    const [exists] = await fileRef.exists();
    if (exists) {
      const [downloaded] = await fileRef.download();
      fileBuffer = Buffer.from(downloaded);
      console.log(
        `[Monthly Export Diagnostics] Successfully fetched ${att.id} from Firebase Storage (${fileBuffer.length} bytes).`
      );
    }
  } catch (cloudErr: any) {
    // Cloud storage threw (e.g. project disabled or offline)
  }

  // 2. Try Local Filesystem Storage Fallback
  if (!fileBuffer) {
    try {
      const localFilePath = path.join(process.cwd(), 'storage', 'uploads', sanitizedPath);
      fileBuffer = await fs.readFile(localFilePath);
      console.log(
        `[Monthly Export Diagnostics] Successfully fetched ${att.id} from local disk storage (${fileBuffer.length} bytes).`
      );
    } catch (localErr: any) {
      // Local file not found
    }
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    console.warn(
      `[Monthly Export Diagnostics] Attachment fetch FAILED for ${att.id} (${att.originalFilename}) at path: ${sanitizedPath}`
    );
    return {
      id: att.id,
      reportDate,
      originalFilename: att.originalFilename || 'photo.jpg',
      caption: att.caption,
      fileSize: att.fileSize || 0,
      uploadedAt: att.uploadedAt || new Date().toISOString(),
      isVideo: false,
      isUnavailable: true,
    };
  }

  const { width, height, format: detectedFormat } = getImageDimensions(fileBuffer);
  const format: 'PNG' | 'JPEG' = detectedFormat === 'PNG' ? 'PNG' : 'JPEG';
  const mimeType = format === 'PNG' ? 'image/png' : 'image/jpeg';
  const base64DataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  const aspectRatio = width / (height || 1);

  console.log(
    `[Monthly Export Diagnostics] Attachment ${att.id} processed: ${width}x${height} (${format}), aspect: ${aspectRatio.toFixed(2)}`
  );

  return {
    id: att.id,
    reportDate,
    originalFilename: att.originalFilename || 'photo.jpg',
    caption: att.caption,
    fileSize: att.fileSize || fileBuffer.length,
    uploadedAt: att.uploadedAt || new Date().toISOString(),
    isVideo: false,
    isUnavailable: false,
    buffer: fileBuffer,
    format,
    width,
    height,
    aspectRatio,
    base64DataUrl,
  };
}
