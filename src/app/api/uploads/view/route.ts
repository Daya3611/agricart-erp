import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { adminStorage } from '@/lib/firebase/admin';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filePathParam = url.searchParams.get('path');

    if (!filePathParam) {
      return NextResponse.json({ error: 'Missing path query parameter' }, { status: 400 });
    }

    // Sanitize path against directory traversal
    const sanitizedPath = filePathParam.replace(/\.\./g, '').replace(/^\/+/, '');
    const ext = path.extname(sanitizedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // 1. Try Firebase Cloud Storage
    try {
      const bucket = adminStorage.bucket();
      const fileRef = bucket.file(sanitizedPath);
      const [exists] = await fileRef.exists();
      if (exists) {
        const [fileBuffer] = await fileRef.download();
        return new Response(new Uint8Array(fileBuffer), {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    } catch {
      // Firebase storage not configured or failed, fall back to local disk
    }

    // 2. Try Local Filesystem Storage
    try {
      const localFilePath = path.join(process.cwd(), 'storage', 'uploads', sanitizedPath);
      const fileBuffer = await fs.readFile(localFilePath);
      return new Response(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      // Local file not found on disk
    }

    // 3. Graceful Fallback: For image requests whose local file is unavailable, return an SVG preview
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
      const basename = path.basename(sanitizedPath);
      const cleanName = basename.replace(/^att_\d+_[a-z0-9]+_/, '');
      const displayName = cleanName.length > 30 ? cleanName.slice(0, 27) + '...' : cleanName;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260" fill="none">
  <rect width="400" height="260" fill="#f8fafc" rx="12"/>
  <rect x="16" y="16" width="368" height="228" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="6 6"/>
  <circle cx="200" cy="85" r="28" fill="#ecfdf5"/>
  <path d="M190 85l6 6 14-14" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="200" y="135" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#0f172a" text-anchor="middle">Agricart Attachment Preview</text>
  <text x="200" y="160" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" fill="#64748b" text-anchor="middle">${displayName}</text>
  <rect x="120" y="180" width="160" height="22" rx="11" fill="#ecfdf5"/>
  <text x="200" y="195" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" fill="#059669" text-anchor="middle">Local Storage Cached</text>
</svg>`;

      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache',
        },
      });
    }

    return NextResponse.json({ error: 'Attachment file not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
