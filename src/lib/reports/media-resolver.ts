import fs from 'node:fs/promises';
import path from 'node:path';
import { adminStorage } from '@/lib/firebase/admin';
import {
  extractR2ObjectKeyFromUrl,
  getObjectFromR2,
  getSignedR2DownloadUrl,
  isR2Configured,
  isR2Url,
  buildR2PublicUrl,
} from '@/lib/storage/r2';
import {
  getMediaRecordById,
  getMediaRecordsBatch,
  resolveMediaDisplayUrl,
} from '@/lib/storage/media';
import { MediaRecord, inspectImageBuffer } from '@/lib/storage/media-types';
import { Center, GlobalReportingConfig, SystemSettings, UserProfile } from '@/types';

export interface ResolvedReportMediaAsset {
  source: string;
  mediaId?: string;
  objectKey?: string;
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  pdfFormat?: 'PNG' | 'JPEG' | 'WEBP';
  width: number;
  height: number;
  aspectRatio: number;
  base64DataUrl: string;
  resolvedUrl?: string;
}

export type MediaFailureReason = 'expired' | 'invalid_format' | 'too_large' | 'unavailable';

export interface ResolvedReportMediaOutcome {
  asset: ResolvedReportMediaAsset | null;
  failureReason?: MediaFailureReason;
}

export interface MediaResolveInput {
  url?: string;
  mediaId?: string;
  objectKey?: string;
  storagePath?: string;
}

export const MAX_REPORT_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB safeguard per image

/**
 * Shared bounded-concurrency worker pool to keep parallel image downloads fast and memory-safe.
 */
export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/**
 * Inspects an S3/R2 presigned URL (preserving all query parameters) to check signing status & expiry.
 * Handles AWS Signature V4 (`X-Amz-Date` + `X-Amz-Expires`) and standard `Expires` Unix seconds.
 */
export function inspectPresignedUrl(rawUrl?: string): {
  isPresigned: boolean;
  isExpired: boolean;
  expiresAtMs?: number;
} {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return { isPresigned: false, isExpired: false };
  }

  try {
    const parsed = new URL(trimmed);
    const params = parsed.searchParams;
    const hasAmzParams =
      params.has('X-Amz-Signature') ||
      params.has('X-Amz-Algorithm') ||
      params.has('X-Amz-Credential') ||
      params.has('X-Amz-Expires');

    if (hasAmzParams) {
      const amzDate = params.get('X-Amz-Date'); // e.g. 20261112T120000Z
      const amzExpires = Number(params.get('X-Amz-Expires') || '0');
      if (amzDate && /^\d{8}T\d{6}Z$/.test(amzDate) && Number.isFinite(amzExpires) && amzExpires > 0) {
        const year = Number(amzDate.slice(0, 4));
        const month = Number(amzDate.slice(4, 6)) - 1;
        const day = Number(amzDate.slice(6, 8));
        const hour = Number(amzDate.slice(9, 11));
        const min = Number(amzDate.slice(11, 13));
        const sec = Number(amzDate.slice(13, 15));
        const signedAtMs = Date.UTC(year, month, day, hour, min, sec);
        const expiresAtMs = signedAtMs + amzExpires * 1000;
        return {
          isPresigned: true,
          isExpired: Date.now() >= expiresAtMs,
          expiresAtMs,
        };
      }
      return { isPresigned: true, isExpired: false };
    }

    const legacyExpires = params.get('Expires');
    if (legacyExpires && params.has('Signature') && /^\d+$/.test(legacyExpires)) {
      const expiresAtMs = Number(legacyExpires) * 1000;
      return {
        isPresigned: true,
        isExpired: Date.now() >= expiresAtMs,
        expiresAtMs,
      };
    }
  } catch {
    // Ignore malformed URL parse
  }

  return { isPresigned: false, isExpired: false };
}

export function extractMediaIdFromUrl(rawUrl?: string): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/api\/v1\/media\/([a-zA-Z0-9_-]+)(?:\?|$|\/)/);
  if (!match?.[1]) return null;
  const candidate = match[1];
  if (candidate === 'upload' || candidate === 'by-key' || candidate === 'migrate') {
    return null;
  }
  return candidate;
}

export function extractStoragePath(rawInput?: string): string | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;

  // 1. /api/uploads/view?path=...
  if (trimmed.includes('/api/uploads/view')) {
    try {
      const parsed = new URL(trimmed, 'http://localhost');
      const paramPath = parsed.searchParams.get('path');
      if (paramPath) {
        return decodeURIComponent(paramPath).replace(/\.\./g, '').replace(/^\/+/, '');
      }
    } catch {
      const match = trimmed.match(/[?&]path=([^&]+)/);
      if (match?.[1]) {
        return decodeURIComponent(match[1]).replace(/\.\./g, '').replace(/^\/+/, '');
      }
    }
  }

  // 2. /api/v1/media/by-key?key=...
  if (trimmed.includes('/api/v1/media/by-key')) {
    try {
      const parsed = new URL(trimmed, 'http://localhost');
      const keyParam = parsed.searchParams.get('key');
      if (keyParam) {
        return decodeURIComponent(keyParam).replace(/\.\./g, '').replace(/^\/+/, '');
      }
    } catch {
      // ignore
    }
  }

  // 3. Cloudflare R2 CDN / custom domain URL
  const r2Key = extractR2ObjectKeyFromUrl(trimmed);
  if (r2Key) return r2Key;

  // 4. Google Cloud Storage URL: https://storage.googleapis.com/<bucket>/<objectPath>?...
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

  // 5. Firebase Storage REST URL
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

  // 6. Direct relative storage path (not starting with http or '/')
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) {
    return trimmed.replace(/\.\./g, '').replace(/^\/+/, '');
  }

  return null;
}

function decodeBase64ImageDataUrl(rawUrl: string): Buffer | null {
  const match = rawUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
  if (!match?.[1]) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}

async function fetchExternalImageBuffer(url: string): Promise<{
  buffer: Buffer | null;
  failureReason?: MediaFailureReason;
}> {
  if (!/^https?:\/\//i.test(url)) return { buffer: null, failureReason: 'unavailable' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    // Preserve full URL including all presigned X-Amz-* query parameters intact
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 410) {
        return { buffer: null, failureReason: 'expired' };
      }
      return { buffer: null, failureReason: 'unavailable' };
    }

    const contentLengthHeader = res.headers.get('content-length');
    if (contentLengthHeader) {
      const declaredBytes = Number(contentLengthHeader);
      if (Number.isFinite(declaredBytes) && declaredBytes > MAX_REPORT_IMAGE_BYTES) {
        return { buffer: null, failureReason: 'too_large' };
      }
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (
      contentType.includes('text/html') ||
      contentType.includes('application/json') ||
      contentType.includes('application/xml')
    ) {
      return { buffer: null, failureReason: 'invalid_format' };
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return { buffer: null, failureReason: 'unavailable' };
    }
    if (arrayBuffer.byteLength > MAX_REPORT_IMAGE_BYTES) {
      return { buffer: null, failureReason: 'too_large' };
    }

    const buf = Buffer.from(arrayBuffer);
    return { buffer: buf };
  } catch {
    return { buffer: null, failureReason: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeImageAsset(
  buffer: Buffer,
  meta: {
    source: string;
    mediaId?: string;
    objectKey?: string;
    resolvedUrl?: string;
  }
): ResolvedReportMediaAsset | null {
  if (!buffer || buffer.length === 0 || buffer.length > MAX_REPORT_IMAGE_BYTES) return null;
  const inspected = inspectImageBuffer(buffer);
  if (!inspected.detectedMime) return null;

  const mime = inspected.detectedMime as ResolvedReportMediaAsset['mimeType'];
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime)) {
    return null;
  }

  const width = inspected.width || 400;
  const height = inspected.height || 300;
  const pdfFormat: 'PNG' | 'JPEG' | 'WEBP' | undefined =
    mime === 'image/png'
      ? 'PNG'
      : mime === 'image/jpeg'
      ? 'JPEG'
      : mime === 'image/webp'
      ? 'WEBP'
      : undefined;

  return {
    source: meta.source,
    mediaId: meta.mediaId,
    objectKey: meta.objectKey,
    buffer,
    mimeType: mime,
    pdfFormat,
    width,
    height,
    aspectRatio: width / (height || 1),
    base64DataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
    resolvedUrl: meta.resolvedUrl,
  };
}

export class ReportMediaResolver {
  private mediaCache = new Map<string, MediaRecord | null>();
  private assetCache = new Map<string, ResolvedReportMediaOutcome>();

  /**
   * Preloads media metadata documents in a single batched Firestore query to prevent N+1 lookups.
   */
  async preloadMediaIds(rawIds: Array<string | undefined | null>): Promise<void> {
    const missingIds = [
      ...new Set(
        rawIds
          .filter((id): id is string => Boolean(id && id.trim()))
          .map((id) => id.trim())
          .filter((id) => !this.mediaCache.has(id))
      ),
    ];

    if (missingIds.length === 0) return;

    const fetched = await getMediaRecordsBatch(missingIds);
    for (const id of missingIds) {
      this.mediaCache.set(id, fetched.get(id) ?? null);
    }
  }

  private async getCachedMediaRecord(mediaId: string): Promise<MediaRecord | null> {
    if (this.mediaCache.has(mediaId)) {
      return this.mediaCache.get(mediaId) ?? null;
    }
    const record = await getMediaRecordById(mediaId);
    this.mediaCache.set(mediaId, record);
    return record;
  }

  /**
   * Resolves the best permanent display URL string without downloading binary content.
   */
  async resolveDisplayUrl(input: MediaResolveInput): Promise<string | undefined> {
    if (input.objectKey && isR2Configured()) {
      return buildR2PublicUrl(input.objectKey);
    }
    const candidateMediaId = input.mediaId || extractMediaIdFromUrl(input.url);
    if (candidateMediaId) {
      const record = await this.getCachedMediaRecord(candidateMediaId);
      if (record) {
        return resolveMediaDisplayUrl(record);
      }
    }
    return input.url?.trim() || undefined;
  }

  /**
   * Resolves a directly clickable external URL for Excel hyperlinks:
   * - Permanent public URL when the asset is public
   * - Freshly generated R2 signed download URL (default 7 days) when backed by a private R2 objectKey
   * - Extracts R2 objectKey from legacy expired presigned URLs and re-signs cleanly
   */
  async resolveExportUrl(input: MediaResolveInput, expiresInSeconds = 604800): Promise<string | undefined> {
    const rawUrl = (input.url || '').trim();
    const rawStoragePath = (input.storagePath || '').trim();
    const candidateMediaId = input.mediaId?.trim() || extractMediaIdFromUrl(rawUrl) || undefined;

    let effectiveObjectKey =
      input.objectKey?.trim() ||
      extractR2ObjectKeyFromUrl(rawUrl) ||
      extractR2ObjectKeyFromUrl(rawStoragePath) ||
      undefined;
    let isPublicAsset = false;
    let fallbackRecordUrl: string | undefined;

    if (candidateMediaId) {
      const record = await this.getCachedMediaRecord(candidateMediaId);
      if (record) {
        isPublicAsset = Boolean(record.isPublic);
        effectiveObjectKey = record.objectKey || effectiveObjectKey;
        if (record.isPublic && record.objectKey) {
          return buildR2PublicUrl(record.objectKey);
        }
        fallbackRecordUrl = resolveMediaDisplayUrl(record);
      }
    }

    if (effectiveObjectKey && isR2Configured()) {
      if (isPublicAsset) {
        return buildR2PublicUrl(effectiveObjectKey);
      }
      const presignedInfo = inspectPresignedUrl(rawUrl);
      if (!presignedInfo.isPresigned && rawUrl.startsWith(`${buildR2PublicUrl(effectiveObjectKey)}`)) {
        // Already a direct public R2 CDN link stored without signature
        return buildR2PublicUrl(effectiveObjectKey);
      }
      try {
        return await getSignedR2DownloadUrl(effectiveObjectKey, expiresInSeconds);
      } catch {
        // Fall through to display URL
      }
    }

    return fallbackRecordUrl || rawUrl || undefined;
  }

  /**
   * Resolves binary image data and metadata with direct R2 GetObjectCommand priority
   * over expired legacy R2 presigned URLs, while respecting expiration for external non-R2 signed links.
   */
  async resolveImageAssetWithOutcome(input: MediaResolveInput): Promise<ResolvedReportMediaOutcome> {
    const rawUrl = (input.url || '').trim();
    const rawStoragePath = (input.storagePath || '').trim();
    const detectedMediaId = input.mediaId?.trim() || extractMediaIdFromUrl(rawUrl) || undefined;

    const presignedInfo = inspectPresignedUrl(rawUrl);
    // Always extract R2 objectKey from URL/storagePath even if rawUrl contains an expired X-Amz-Signature
    const extractedObjectKey =
      input.objectKey?.trim() ||
      extractR2ObjectKeyFromUrl(rawUrl) ||
      extractR2ObjectKeyFromUrl(rawStoragePath) ||
      undefined;

    const cacheKey = [detectedMediaId || '', extractedObjectKey || '', rawStoragePath, rawUrl].join('|');
    if (this.assetCache.has(cacheKey)) {
      return this.assetCache.get(cacheKey)!;
    }

    const storeAndReturn = (
      asset: ResolvedReportMediaAsset | null,
      failureReason?: MediaFailureReason
    ): ResolvedReportMediaOutcome => {
      const outcome: ResolvedReportMediaOutcome = { asset, failureReason: asset ? undefined : failureReason };
      this.assetCache.set(cacheKey, outcome);
      return outcome;
    };

    const sourceLabel = rawUrl || extractedObjectKey || rawStoragePath || detectedMediaId || 'unknown';

    // 1. Inline data URL
    if (rawUrl.startsWith('data:image/')) {
      const decoded = decodeBase64ImageDataUrl(rawUrl);
      if (decoded) {
        const asset = normalizeImageAsset(decoded, {
          source: sourceLabel,
          mediaId: detectedMediaId,
          objectKey: extractedObjectKey,
          resolvedUrl: rawUrl,
        });
        return storeAndReturn(asset, asset ? undefined : 'invalid_format');
      }
    }

    // Resolve via erp_media record if mediaId present
    let effectiveMediaId = detectedMediaId;
    let effectiveObjectKey = extractedObjectKey;
    let fallbackExternalUrl = rawUrl;
    let resolvedUrl: string | undefined = rawUrl || undefined;

    if (effectiveMediaId) {
      const record = await this.getCachedMediaRecord(effectiveMediaId);
      if (record) {
        effectiveObjectKey = record.objectKey || effectiveObjectKey;
        resolvedUrl = resolveMediaDisplayUrl(record);
        if (record.publicUrl && /^https?:\/\//i.test(record.publicUrl)) {
          fallbackExternalUrl = record.publicUrl;
        }
      }
    }

    // 2. Priority: Direct Cloudflare R2 GetObjectCommand via stored or extracted objectKey
    //    Never depends on temporary X-Amz-Expires=900 signatures when R2 client + key exist!
    let r2ObjectNotFound = false;
    if (effectiveObjectKey && isR2Configured()) {
      try {
        const r2Obj = await getObjectFromR2(effectiveObjectKey);
        if (r2Obj?.buffer) {
          if (r2Obj.buffer.length > MAX_REPORT_IMAGE_BYTES) {
            return storeAndReturn(null, 'too_large');
          }
          const asset = normalizeImageAsset(r2Obj.buffer, {
            source: sourceLabel,
            mediaId: effectiveMediaId,
            objectKey: effectiveObjectKey,
            resolvedUrl: resolvedUrl || buildR2PublicUrl(effectiveObjectKey),
          });
          if (asset) return storeAndReturn(asset);
          return storeAndReturn(null, 'invalid_format');
        }
        r2ObjectNotFound = true;
      } catch {
        r2ObjectNotFound = true;
      }
    }

    // 3. Static asset under Next.js public/ (e.g., '/logo.png')
    if (rawUrl.startsWith('/') && !rawUrl.startsWith('/api/')) {
      try {
        const safeRel = rawUrl.replace(/\.\./g, '').replace(/^\/+/, '');
        const publicPath = path.join(process.cwd(), 'public', safeRel);
        const publicBuf = await fs.readFile(publicPath);
        const asset = normalizeImageAsset(publicBuf, {
          source: sourceLabel,
          resolvedUrl: rawUrl,
        });
        if (asset) return storeAndReturn(asset);
      } catch {
        // Not found in public/
      }
    }

    // 4. Relative storage path -> R2 -> Firebase Storage -> local storage/uploads
    const rawStoragePresigned = inspectPresignedUrl(rawStoragePath);
    const sanitizedPath = rawStoragePresigned.isPresigned
      ? null
      : effectiveObjectKey ||
        extractStoragePath(rawStoragePath) ||
        extractStoragePath(rawUrl) ||
        extractStoragePath(fallbackExternalUrl);

    if (sanitizedPath) {
      if (isR2Configured() && sanitizedPath !== effectiveObjectKey) {
        try {
          const r2Obj = await getObjectFromR2(sanitizedPath);
          if (r2Obj?.buffer) {
            const asset = normalizeImageAsset(r2Obj.buffer, {
              source: sourceLabel,
              mediaId: effectiveMediaId,
              objectKey: sanitizedPath,
              resolvedUrl: resolvedUrl || buildR2PublicUrl(sanitizedPath),
            });
            if (asset) return storeAndReturn(asset);
          }
        } catch {
          // fall through
        }
      }

      try {
        const bucket = adminStorage.bucket();
        const fileRef = bucket.file(sanitizedPath);
        const [exists] = await fileRef.exists();
        if (exists) {
          const [downloaded] = await fileRef.download();
          const asset = normalizeImageAsset(Buffer.from(downloaded), {
            source: sourceLabel,
            mediaId: effectiveMediaId,
            resolvedUrl,
          });
          if (asset) return storeAndReturn(asset);
        }
      } catch {
        // Firebase storage unavailable or file missing
      }

      try {
        const localFilePath = path.join(process.cwd(), 'storage', 'uploads', sanitizedPath);
        const localBuf = await fs.readFile(localFilePath);
        const asset = normalizeImageAsset(localBuf, {
          source: sourceLabel,
          mediaId: effectiveMediaId,
          resolvedUrl,
        });
        if (asset) return storeAndReturn(asset);
      } catch {
        // Local file missing
      }
    }

    // If direct R2 GetObjectCommand already ran for an R2 URL and reported missing/deleted object,
    // do not fall back to calling the known-expired R2 HTTP presigned URL — report unavailable cleanly.
    if (r2ObjectNotFound && (!rawUrl || isR2Url(rawUrl) || presignedInfo.isPresigned)) {
      return storeAndReturn(null, 'unavailable');
    }

    // 5. External HTTP(S) URL (Cloudinary, public CDN, Firebase signed URLs, external signed URLs)
    const httpCandidate = [fallbackExternalUrl, rawUrl, rawStoragePath].find(
      (candidate) =>
        candidate &&
        /^https?:\/\//i.test(candidate) &&
        !candidate.includes('/api/uploads/view') &&
        !candidate.includes('/api/v1/media/')
    );

    if (httpCandidate) {
      const httpPresigned = inspectPresignedUrl(httpCandidate);
      if (httpPresigned.isPresigned && httpPresigned.isExpired) {
        return storeAndReturn(null, 'expired');
      }
      const { buffer: httpBuf, failureReason } = await fetchExternalImageBuffer(httpCandidate);
      if (httpBuf) {
        const asset = normalizeImageAsset(httpBuf, {
          source: sourceLabel,
          mediaId: effectiveMediaId,
          objectKey: effectiveObjectKey,
          resolvedUrl: resolvedUrl || httpCandidate,
        });
        if (asset) return storeAndReturn(asset);
        return storeAndReturn(null, 'invalid_format');
      }
      return storeAndReturn(null, failureReason || 'unavailable');
    }

    return storeAndReturn(null, presignedInfo.isPresigned && presignedInfo.isExpired ? 'expired' : 'unavailable');
  }

  /**
   * Resolves binary image data and metadata from R2, Firestore media records, Firebase Storage,
   * public static assets, local disk, inline data URLs, or external HTTP URLs (Cloudinary/legacy).
   */
  async resolveImageAsset(input: MediaResolveInput): Promise<ResolvedReportMediaAsset | null> {
    const { asset } = await this.resolveImageAssetWithOutcome(input);
    return asset;
  }

  async resolveOrganizationLogo(
    reportingConfig?: GlobalReportingConfig,
    systemSettings?: Partial<SystemSettings> | null
  ): Promise<ResolvedReportMediaAsset | null> {
    const candidates: MediaResolveInput[] = [];

    if (
      systemSettings?.companyLogoMediaId ||
      systemSettings?.companyLogoKey ||
      systemSettings?.companyLogoUrl
    ) {
      candidates.push({
        mediaId: systemSettings.companyLogoMediaId,
        objectKey: systemSettings.companyLogoKey,
        url: systemSettings.companyLogoUrl,
      });
    }

    if (
      reportingConfig?.organization?.companyLogoMediaId ||
      reportingConfig?.organization?.companyLogoKey ||
      reportingConfig?.organization?.companyLogoUrl
    ) {
      candidates.push({
        mediaId: reportingConfig.organization.companyLogoMediaId,
        objectKey: reportingConfig.organization.companyLogoKey,
        url: reportingConfig.organization.companyLogoUrl,
      });
    }

    // Default static Agricart logo fallback
    candidates.push({ url: '/logo.png' });

    for (const candidate of candidates) {
      const asset = await this.resolveImageAsset(candidate);
      if (asset) return asset;
    }
    return null;
  }

  async resolveEmployeeAvatar(
    employee?: Partial<UserProfile> | null
  ): Promise<ResolvedReportMediaAsset | null> {
    if (!employee) return null;
    if (!employee.avatarMediaId && !employee.avatarObjectKey && !employee.avatarUrl) {
      return null;
    }
    return this.resolveImageAsset({
      mediaId: employee.avatarMediaId,
      objectKey: employee.avatarObjectKey,
      url: employee.avatarUrl,
    });
  }

  async resolveCenterPhoto(center?: Partial<Center> | null): Promise<ResolvedReportMediaAsset | null> {
    if (!center) return null;
    const url = center.photoUrl || center.logoUrl;
    if (!center.photoMediaId && !center.photoObjectKey && !url) {
      return null;
    }
    return this.resolveImageAsset({
      mediaId: center.photoMediaId,
      objectKey: center.photoObjectKey,
      url,
    });
  }
}

export function createReportMediaResolver(): ReportMediaResolver {
  return new ReportMediaResolver();
}

