import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  publicUrl: string;
}

let cachedClient: S3Client | null = null;
let cachedConfigKey = '';

function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('R2_CLIENT_ERROR: Cloudflare R2 storage client must only run server-side.');
  }
}

export function getR2Config(): R2Config {
  assertServerOnly();
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucketName = (process.env.R2_BUCKET_NAME || 'agricart-erp-media').trim();
  const rawEndpoint = (process.env.R2_ENDPOINT || '').trim().replace(/\/+$/, '');
  const publicUrl = (process.env.R2_PUBLIC_URL || 'https://media.agricartfpc.in').trim().replace(/\/+$/, '');

  // Ensure S3 API endpoint always points to Cloudflare R2 S3 endpoint (*.r2.cloudflarestorage.com),
  // never to the custom public CDN domain (e.g. storage.agricartfpc.in) which only serves downloads.
  let endpoint = '';
  const isValidS3ApiEndpoint =
    Boolean(rawEndpoint) &&
    !rawEndpoint.includes('<ACCOUNT_ID>') &&
    rawEndpoint !== publicUrl &&
    (/\.r2\.cloudflarestorage\.com$/i.test(rawEndpoint.replace(/^https?:\/\//i, '').split('/')[0]) ||
      /^https?:\/\/localhost(?::\d+)?$/i.test(rawEndpoint));

  if (isValidS3ApiEndpoint) {
    endpoint = rawEndpoint.replace(new RegExp(`/${bucketName}$`, 'i'), '');
  } else if (accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  } else if (rawEndpoint && !rawEndpoint.includes('<ACCOUNT_ID>')) {
    endpoint = rawEndpoint;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint,
    publicUrl,
  };
}

export function isR2Configured(): boolean {
  if (typeof window !== 'undefined') return false;
  const cfg = getR2Config();
  return Boolean(cfg.accessKeyId && cfg.secretAccessKey && cfg.bucketName && cfg.endpoint);
}

export function getR2Client(): { client: S3Client; config: R2Config } {
  const config = getR2Config();
  if (!config.accessKeyId || !config.secretAccessKey || !config.endpoint || !config.bucketName) {
    throw new Error(
      'R2_NOT_CONFIGURED: Missing required Cloudflare R2 environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT).'
    );
  }

  const configKey = `${config.endpoint}|${config.accessKeyId}|${config.bucketName}`;
  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedConfigKey = configKey;
  }

  return { client: cachedClient, config };
}

export function normalizeObjectKey(rawKey: string): string {
  const cleaned = (rawKey || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\.\./g, '')
    .replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('..')) {
    throw new Error('INVALID_OBJECT_KEY: Object key is invalid.');
  }
  return cleaned;
}

export function buildR2PublicUrl(objectKey: string): string {
  const normalizedKey = normalizeObjectKey(objectKey);
  const { publicUrl } = getR2Config();
  if (!publicUrl) {
    return `/api/v1/media/by-key?key=${encodeURIComponent(normalizedKey)}`;
  }
  const encodedPath = normalizedKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${publicUrl}/${encodedPath}`;
}

export function extractR2ObjectKeyFromUrl(rawUrl: string): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;

  const { publicUrl, bucketName, endpoint } = getR2Config();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const hostLower = parsed.hostname.toLowerCase();
  const decodedPath = decodeURIComponent(parsed.pathname);

  // 1. Custom public CDN / domain (e.g. https://storage.agricartfpc.in/<key>)
  if (publicUrl) {
    try {
      const pubParsed = new URL(publicUrl);
      if (parsed.origin.toLowerCase() === pubParsed.origin.toLowerCase()) {
        const basePath = decodeURIComponent(pubParsed.pathname).replace(/\/+$/, '');
        if (!basePath || basePath === '/') {
          return normalizeObjectKey(decodedPath);
        }
        if (decodedPath.startsWith(`${basePath}/`)) {
          return normalizeObjectKey(decodedPath.slice(basePath.length + 1));
        }
      }
    } catch {
      if (trimmed.startsWith(`${publicUrl}/`)) {
        return normalizeObjectKey(decodedPath);
      }
    }
  }

  // 2. Configured S3/R2 API endpoint (path-style or virtual-hosted presigned URLs)
  if (endpoint) {
    try {
      const epParsed = new URL(endpoint);
      const epHostLower = epParsed.hostname.toLowerCase();
      if (hostLower === epHostLower) {
        if (decodedPath.startsWith(`/${bucketName}/`)) {
          return normalizeObjectKey(decodedPath.slice(bucketName.length + 2));
        }
        return normalizeObjectKey(decodedPath);
      }
      if (hostLower === `${bucketName.toLowerCase()}.${epHostLower}`) {
        return normalizeObjectKey(decodedPath);
      }
    } catch {
      if (trimmed.startsWith(`${endpoint}/${bucketName}/`)) {
        const withoutBucket = decodedPath.replace(new RegExp(`^/${bucketName}/`), '');
        return normalizeObjectKey(withoutBucket);
      }
    }
  }

  // 3. Any Cloudflare R2 S3 API URL (*.r2.cloudflarestorage.com) - handles legacy/expired presigned URLs
  //    whether path-style (/<bucket>/<key>?X-Amz-...) or virtual-hosted (<bucket>.<acct>.r2.cloudflarestorage.com/<key>?X-Amz-...)
  if (hostLower.endsWith('.r2.cloudflarestorage.com')) {
    const bucketLower = bucketName.toLowerCase();
    if (hostLower.startsWith(`${bucketLower}.`)) {
      return normalizeObjectKey(decodedPath);
    }
    if (decodedPath.startsWith(`/${bucketName}/`)) {
      return normalizeObjectKey(decodedPath.slice(bucketName.length + 2));
    }
    const slashParts = decodedPath.replace(/^\/+/, '').split('/');
    if (slashParts.length > 1) {
      // Fallback: strip leading bucket segment on path-style .r2.cloudflarestorage.com URLs
      return normalizeObjectKey(slashParts.slice(1).join('/'));
    }
    return normalizeObjectKey(decodedPath);
  }

  // 4. Public r2.dev CDN host pattern
  if (hostLower.endsWith('.r2.dev') || hostLower === 'r2.dev') {
    return normalizeObjectKey(decodedPath);
  }

  return null;
}

export function isR2Url(rawUrl: string): boolean {
  return extractR2ObjectKeyFromUrl(rawUrl) !== null;
}

export async function uploadObjectToR2(params: {
  objectKey: string;
  body: Buffer | Uint8Array;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}): Promise<{ objectKey: string; publicUrl: string; etag?: string }> {
  const { client, config } = getR2Client();
  const objectKey = normalizeObjectKey(params.objectKey);

  const sanitizedMeta: Record<string, string> = {};
  if (params.metadata) {
    for (const [k, v] of Object.entries(params.metadata)) {
      if (v !== undefined && v !== null) {
        sanitizedMeta[k.toLowerCase().replace(/[^a-z0-9_-]/g, '')] = String(v).slice(0, 512);
      }
    }
  }

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
    Body: params.body,
    ContentType: params.contentType,
    CacheControl: params.cacheControl || 'public, max-age=31536000, immutable',
    Metadata: sanitizedMeta,
  });

  const result = await client.send(command);
  return {
    objectKey,
    publicUrl: buildR2PublicUrl(objectKey),
    etag: result.ETag?.replace(/"/g, ''),
  };
}

export async function getObjectFromR2(
  objectKey: string
): Promise<{ buffer: Buffer; contentType?: string; contentLength?: number } | null> {
  const { client, config } = getR2Client();
  const key = normalizeObjectKey(objectKey);

  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return {
      buffer: Buffer.from(bytes),
      contentType: res.ContentType,
      contentLength: res.ContentLength,
    };
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey') {
      return null;
    }
    throw err;
  }
}

export async function headObjectInR2(objectKey: string): Promise<boolean> {
  const { client, config } = getR2Client();
  const key = normalizeObjectKey(objectKey);

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    );
    return true;
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
      return false;
    }
    throw err;
  }
}

export async function deleteObjectFromR2(objectKey: string): Promise<void> {
  const { client, config } = getR2Client();
  const key = normalizeObjectKey(objectKey);
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    })
  );
}

export async function getSignedR2DownloadUrl(objectKey: string, expiresInSeconds = 900): Promise<string> {
  const { client, config } = getR2Client();
  const key = normalizeObjectKey(objectKey);
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
    { expiresIn: Math.min(Math.max(expiresInSeconds, 60), 604800) }
  );
}

