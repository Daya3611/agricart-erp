import crypto from 'node:crypto';

export type MediaEntityType =
  | 'product'
  | 'farmer'
  | 'center'
  | 'user'
  | 'report'
  | 'activity'
  | 'leave'
  | 'organization'
  | 'document';

export type MediaStorageProvider = 'r2' | 'firebase' | 'local' | 'external';

export interface MediaRecord {
  id: string;
  entityType: MediaEntityType;
  entityId: string;
  fileName: string;
  objectKey: string;
  publicUrl?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: string;
  centerId?: string;
  isPublic: boolean;
  isPrimary?: boolean;
  caption?: string;
  legacySourceUrl?: string;
  storageProvider?: MediaStorageProvider;
}

export interface MediaValidationOptions {
  allowDocuments?: boolean;
  allowVideos?: boolean;
  maxImageBytes?: number;
  maxDocumentBytes?: number;
  maxVideoBytes?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface ValidatedMediaFile {
  safeFileName: string;
  ext: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'document' | 'video';
  width?: number;
  height?: number;
}

export const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const DEFAULT_MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB
export const DEFAULT_MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

export const ALLOWED_IMAGE_MIME_TYPES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
};

export const ALLOWED_DOCUMENT_MIME_TYPES: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/csv': ['csv'],
  'text/plain': ['txt'],
};

export const ALLOWED_VIDEO_MIME_TYPES: Record<string, string[]> = {
  'video/mp4': ['mp4'],
  'video/quicktime': ['mov'],
  'video/webm': ['webm'],
};

export const BLOCKED_EXECUTABLE_EXTENSIONS = new Set([
  'exe',
  'msi',
  'bat',
  'cmd',
  'sh',
  'ps1',
  'vbs',
  'js',
  'mjs',
  'cjs',
  'ts',
  'php',
  'py',
  'rb',
  'pl',
  'jar',
  'dll',
  'so',
  'dylib',
  'apk',
  'html',
  'htm',
  'svg',
  'scr',
  'pif',
  'com',
]);

const ENTITY_ID_SANITIZE_RE = /[^a-zA-Z0-9_-]/g;

export function sanitizeEntityId(entityId: string): string {
  const cleaned = (entityId || '').trim().replace(ENTITY_ID_SANITIZE_RE, '_').replace(/_+/g, '_');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error('INVALID_ENTITY_ID: Entity identifier is missing or invalid.');
  }
  return cleaned.slice(0, 128);
}

export function sanitizeDisplayFileName(rawName: string): string {
  const base = (rawName || 'upload')
    .split(/[\\/]/)
    .pop()!
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
  return base.slice(0, 180) || 'upload';
}

export function normalizeExtension(rawName: string, mimeType?: string): string {
  const base = (rawName || '').split(/[\\/]/).pop() || '';
  const dotIdx = base.lastIndexOf('.');
  const ext = dotIdx > 0 ? base.slice(dotIdx + 1).toLowerCase().trim() : '';
  if (ext) return ext;

  const mimeLower = (mimeType || '').toLowerCase().split(';')[0].trim();
  const mapped =
    ALLOWED_IMAGE_MIME_TYPES[mimeLower]?.[0] ||
    ALLOWED_DOCUMENT_MIME_TYPES[mimeLower]?.[0] ||
    ALLOWED_VIDEO_MIME_TYPES[mimeLower]?.[0];
  return mapped || '';
}

/**
 * Generates an organized, canonical R2 object key using UUID filenames so raw user
 * filenames cannot manipulate paths or overwrite sibling objects.
 */
export function buildR2ObjectKey(entityType: MediaEntityType, entityId: string, ext: string): string {
  const safeId = sanitizeEntityId(entityId);
  const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanExt || BLOCKED_EXECUTABLE_EXTENSIONS.has(cleanExt)) {
    throw new Error('UNSUPPORTED_FILE_TYPE: Invalid or disallowed file extension.');
  }
  const uuid = crypto.randomUUID();

  switch (entityType) {
    case 'product':
      return `products/${safeId}/${uuid}.${cleanExt}`;
    case 'farmer':
      return `farmers/${safeId}/profile/${uuid}.${cleanExt}`;
    case 'center':
      return `centers/${safeId}/${uuid}.${cleanExt}`;
    case 'user':
      return `users/${safeId}/profile/${uuid}.${cleanExt}`;
    case 'report':
    case 'activity':
      return `reports/${safeId}/${uuid}.${cleanExt}`;
    case 'organization':
      return `organization/${safeId}/${uuid}.${cleanExt}`;
    case 'leave':
    case 'document':
    default:
      return `documents/${safeId}/${uuid}.${cleanExt}`;
  }
}

/**
 * Extracts image dimensions from PNG, JPEG, GIF, and WebP buffers without native dependencies.
 */
export function inspectImageBuffer(buffer: Buffer): {
  width?: number;
  height?: number;
  detectedMime?: string;
} {
  if (buffer.length < 12) return {};

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      detectedMime: 'image/png',
    };
  }

  // GIF: GIF87a / GIF89a
  if (buffer.subarray(0, 6).toString('ascii').startsWith('GIF8')) {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
      detectedMime: 'image/gif',
    };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 30 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    const chunkHeader = buffer.subarray(12, 16).toString('ascii');
    if (chunkHeader === 'VP8X') {
      const w = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const h = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      return { width: w, height: h, detectedMime: 'image/webp' };
    }
    if (chunkHeader === 'VP8 ' && buffer.length >= 30) {
      const w = buffer.readUInt16LE(26) & 0x3fff;
      const h = buffer.readUInt16LE(28) & 0x3fff;
      return { width: w, height: h, detectedMime: 'image/webp' };
    }
    if (chunkHeader === 'VP8L' && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      const w = (bits & 0x3fff) + 1;
      const h = ((bits >> 14) & 0x3fff) + 1;
      return { width: w, height: h, detectedMime: 'image/webp' };
    }
    return { detectedMime: 'image/webp' };
  }

  // JPEG: FF D8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xff) {
        offset++;
        continue;
      }
      if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2;
        continue;
      }
      if (marker >= 0xc0 && marker <= 0xc3) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height, detectedMime: 'image/jpeg' };
      }
      const len = buffer.readUInt16BE(offset + 2);
      if (len < 2) break;
      offset += 2 + len;
    }
    return { detectedMime: 'image/jpeg' };
  }

  return {};
}

export function validateMediaUpload(
  input: {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  },
  options: MediaValidationOptions = {}
): ValidatedMediaFile {
  const safeFileName = sanitizeDisplayFileName(input.fileName);
  let rawMime = (input.mimeType || '').toLowerCase().split(';')[0].trim();
  if (rawMime === 'image/jpg' || rawMime === 'image/pjpeg') {
    rawMime = 'image/jpeg';
  }
  const size = input.buffer.length;

  if (size <= 0) {
    throw new Error('EMPTY_FILE: Uploaded file is empty.');
  }

  // Inspect actual image magic bytes early so extensionless or re-encoded mobile/WhatsApp images normalize safely
  const earlyImgMeta = inspectImageBuffer(input.buffer);
  if (!rawMime && earlyImgMeta.detectedMime) {
    rawMime = earlyImgMeta.detectedMime;
  }

  const ext = normalizeExtension(safeFileName, rawMime);

  if (!ext || BLOCKED_EXECUTABLE_EXTENSIONS.has(ext)) {
    throw new Error(`UNSAFE_FILE_TYPE: File extension ".${ext || 'unknown'}" is blocked for security reasons.`);
  }

  // Reject PE/ELF/Mach-O/shebang executable binaries regardless of extension
  if (
    (input.buffer[0] === 0x4d && input.buffer[1] === 0x5a) || // MZ (.exe/.dll)
    (input.buffer[0] === 0x7f && input.buffer.subarray(1, 4).toString('ascii') === 'ELF') ||
    input.buffer.subarray(0, 2).toString('ascii') === '#!'
  ) {
    throw new Error('UNSAFE_FILE_TYPE: Executable binaries and scripts are strictly prohibited.');
  }

  if (ALLOWED_IMAGE_MIME_TYPES[rawMime]) {
    const allowedExts = ALLOWED_IMAGE_MIME_TYPES[rawMime];
    if (!allowedExts.includes(ext)) {
      throw new Error(`INVALID_EXTENSION: Extension ".${ext}" does not match MIME type "${rawMime}".`);
    }
    const maxBytes = options.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES;
    if (size > maxBytes) {
      throw new Error(`FILE_TOO_LARGE: Image exceeds maximum size limit of ${Math.round(maxBytes / (1024 * 1024))}MB.`);
    }

    const imgMeta = earlyImgMeta;
    if (!imgMeta.detectedMime || imgMeta.detectedMime !== rawMime) {
      throw new Error(`INVALID_IMAGE: File contents do not match declared image type "${rawMime}".`);
    }

    if (imgMeta.width !== undefined && imgMeta.height !== undefined) {
      if (imgMeta.width <= 0 || imgMeta.height <= 0) {
        throw new Error('INVALID_IMAGE: Image has invalid zero dimensions.');
      }
      if (options.minWidth && imgMeta.width < options.minWidth) {
        throw new Error(`INVALID_DIMENSIONS: Image width must be at least ${options.minWidth}px.`);
      }
      if (options.minHeight && imgMeta.height < options.minHeight) {
        throw new Error(`INVALID_DIMENSIONS: Image height must be at least ${options.minHeight}px.`);
      }
      if (options.maxWidth && imgMeta.width > options.maxWidth) {
        throw new Error(`INVALID_DIMENSIONS: Image width exceeds maximum ${options.maxWidth}px.`);
      }
      if (options.maxHeight && imgMeta.height > options.maxHeight) {
        throw new Error(`INVALID_DIMENSIONS: Image height exceeds maximum ${options.maxHeight}px.`);
      }
    }

    return {
      safeFileName,
      ext,
      mimeType: rawMime,
      size,
      kind: 'image',
      width: imgMeta.width,
      height: imgMeta.height,
    };
  }

  if (options.allowDocuments && ALLOWED_DOCUMENT_MIME_TYPES[rawMime]) {
    const allowedExts = ALLOWED_DOCUMENT_MIME_TYPES[rawMime];
    if (!allowedExts.includes(ext)) {
      throw new Error(`INVALID_EXTENSION: Extension ".${ext}" does not match document MIME type "${rawMime}".`);
    }
    const maxBytes = options.maxDocumentBytes ?? DEFAULT_MAX_DOCUMENT_BYTES;
    if (size > maxBytes) {
      throw new Error(`FILE_TOO_LARGE: Document exceeds maximum size limit of ${Math.round(maxBytes / (1024 * 1024))}MB.`);
    }
    if (rawMime === 'application/pdf' && input.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('INVALID_DOCUMENT: File signature is not a valid PDF document.');
    }
    return {
      safeFileName,
      ext,
      mimeType: rawMime,
      size,
      kind: 'document',
    };
  }

  if (options.allowVideos && ALLOWED_VIDEO_MIME_TYPES[rawMime]) {
    const allowedExts = ALLOWED_VIDEO_MIME_TYPES[rawMime];
    if (!allowedExts.includes(ext)) {
      throw new Error(`INVALID_EXTENSION: Extension ".${ext}" does not match video MIME type "${rawMime}".`);
    }
    const maxBytes = options.maxVideoBytes ?? DEFAULT_MAX_VIDEO_BYTES;
    if (size > maxBytes) {
      throw new Error(`FILE_TOO_LARGE: Video exceeds maximum size limit of ${Math.round(maxBytes / (1024 * 1024))}MB.`);
    }
    return {
      safeFileName,
      ext,
      mimeType: rawMime,
      size,
      kind: 'video',
    };
  }

  throw new Error(`UNSUPPORTED_FILE_TYPE: MIME type "${rawMime || 'unknown'}" is not permitted for this upload.`);
}

