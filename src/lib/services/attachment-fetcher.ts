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
  downloadUrl?: string;
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
      // Skip fill bytes (0xFF)
      if (marker === 0xff) {
        offset++;
        continue;
      }
      // Standalone markers without payload length
      if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2;
        continue;
      }
      // SOF0 (0xC0) .. SOF3 (0xC3)
      if (marker >= 0xc0 && marker <= 0xc3) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height, format: 'JPEG' };
      }
      const len = buffer.readUInt16BE(offset + 2);
      if (len < 2) break;
      offset += 2 + len;
    }
    return { width: 800, height: 600, format: 'JPEG' };
  }
  return { width: 800, height: 600, format: 'UNKNOWN' };
}

/**
 * Attempts to resolve a relative Firebase/local storage object path from an attachment URL or raw storagePath.
 */
function extractStoragePath(rawInput: string): string | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;

  // Handle /api/uploads/view?path=... (relative or absolute URL)
  if (trimmed.includes('/api/uploads/view')) {
    try {
      const parsed = new URL(trimmed, 'http://localhost');
      const paramPath = parsed.searchParams.get('path');
      if (paramPath) {
        return decodeURIComponent(paramPath).replace(/\.\./g, '').replace(/^\/+/, '');
      }
    } catch {
      // Fallback regex if malformed URL
      const match = trimmed.match(/[?&]path=([^&]+)/);
      if (match?.[1]) {
        return decodeURIComponent(match[1]).replace(/\.\./g, '').replace(/^\/+/, '');
      }
    }
  }

  // Handle Google Cloud Storage URL: https://storage.googleapis.com/<bucket>/<objectPath>?...
  if (trimmed.startsWith('https://storage.googleapis.com/') || trimmed.startsWith('http://storage.googleapis.com/')) {
    try {
      const parsed = new URL(trimmed);
      const parts = parsed.pathname.replace(/^\/+/, '').split('/');
      if (parts.length >= 2) {
        return decodeURIComponent(parts.slice(1).join('/')).replace(/\.\./g, '').replace(/^\/+/, '');
      }
    } catch {
      // ignore
    }
  }

  // Handle Firebase Storage REST URL: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>
  if (trimmed.includes('firebasestorage.googleapis.com/v0/b/')) {
    try {
      const parsed = new URL(trimmed);
      const oIdx = parsed.pathname.indexOf('/o/');
      if (oIdx !== -1) {
        return decodeURIComponent(parsed.pathname.slice(oIdx + 3)).replace(/\.\./g, '').replace(/^\/+/, '');
      }
    } catch {
      // ignore
    }
  }

  // Not an HTTP URL => treat directly as relative storagePath
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) {
    return trimmed.replace(/\.\./g, '').replace(/^\/+/, '');
  }

  return null;
}

/**
 * Decodes an inline data:image/*;base64,... URL into a Buffer.
 */
function decodeBase64DataUrl(rawUrl: string): Buffer | null {
  const match = rawUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
  if (!match?.[1]) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}

/**
 * Fetches binary image bytes over HTTP(S) for external or non-expired URLs.
 */
async function fetchExternalUrlBuffer(url: string): Promise<Buffer | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server-side authorized attachment fetcher.
 * Retrieves binary image bytes from:
 * 1) Inline data URLs
 * 2) Firebase Cloud Storage (resolving /api/uploads/view?path=..., GCS URLs, or raw storagePath)
 * 3) Local filesystem storage fallback (storage/uploads/<path>)
 * 4) Direct HTTPS fetch for external URLs (Cloudinary, public URLs, active signed URLs)
 */
export async function fetchAttachmentData(
  att: ReportAttachment,
  reportDate: string
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

  let fileBuffer: Buffer | null = null;

  // 1. Check inline base64 data URL
  if (candidateUrl.startsWith('data:image/')) {
    fileBuffer = decodeBase64DataUrl(candidateUrl);
  }

  // 2. Resolve relative storage path & check Firebase Storage / local filesystem
  const sanitizedPath =
    extractStoragePath(att.storagePath || '') || extractStoragePath(att.downloadUrl || '');

  if (!fileBuffer && sanitizedPath) {
    // 2a. Try Firebase Cloud Storage
    try {
      const bucket = adminStorage.bucket();
      const fileRef = bucket.file(sanitizedPath);
      const [exists] = await fileRef.exists();
      if (exists) {
        const [downloaded] = await fileRef.download();
        fileBuffer = Buffer.from(downloaded);
      }
    } catch {
      // Cloud storage unavailable or bucket misconfigured — fall through
    }

    // 2b. Try Local Filesystem Storage Fallback
    if (!fileBuffer) {
      try {
        const localFilePath = path.join(process.cwd(), 'storage', 'uploads', sanitizedPath);
        fileBuffer = await fs.readFile(localFilePath);
      } catch {
        // Local file not found
      }
    }
  }

  // 3. Fallback to HTTP(S) fetch for external / active URLs (skip self-referential /api/uploads/view without host)
  if (!fileBuffer) {
    const httpUrl = /^https?:\/\//i.test(att.downloadUrl || '')
      ? att.downloadUrl!
      : /^https?:\/\//i.test(att.storagePath || '')
      ? att.storagePath!
      : '';
    if (httpUrl && !httpUrl.includes('/api/uploads/view')) {
      fileBuffer = await fetchExternalUrlBuffer(httpUrl);
    }
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    console.warn(
      `[Export Diagnostics] Attachment fetch unavailable for ${att.id} (${att.originalFilename}) path=${sanitizedPath || candidateUrl}`
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
    };
  }

  const { width, height, format: detectedFormat } = getImageDimensions(fileBuffer);
  if (detectedFormat === 'UNKNOWN') {
    return {
      id: att.id,
      reportDate,
      originalFilename: att.originalFilename || 'photo.jpg',
      caption: att.caption,
      fileSize: fileBuffer.length,
      uploadedAt: att.uploadedAt || new Date().toISOString(),
      downloadUrl: att.downloadUrl || att.storagePath,
      isVideo: false,
      isUnavailable: true,
    };
  }

  const format: 'PNG' | 'JPEG' = detectedFormat === 'PNG' ? 'PNG' : 'JPEG';
  const mimeType = format === 'PNG' ? 'image/png' : 'image/jpeg';
  const base64DataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  const aspectRatio = width / (height || 1);

  return {
    id: att.id,
    reportDate,
    originalFilename: att.originalFilename || 'photo.jpg',
    caption: att.caption,
    fileSize: att.fileSize || fileBuffer.length,
    uploadedAt: att.uploadedAt || new Date().toISOString(),
    downloadUrl: att.downloadUrl || att.storagePath,
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
