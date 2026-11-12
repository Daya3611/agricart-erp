import { NextResponse } from 'next/server';
import { applyCorsHeaders, handleCorsPreflight } from '@/lib/api/cors';
import {
  deleteMediaById,
  getMediaRecordById,
  readMediaObjectBuffer,
  resolveMediaAccessUrl,
} from '@/lib/storage/media';
import {
  assertCanAccessMedia,
  assertCanDeleteMedia,
  requireStrictMediaUser,
} from '@/lib/storage/media-auth';

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

export async function GET(req: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  try {
    const user = await requireStrictMediaUser(req);
    const { mediaId } = await params;

    const record = await getMediaRecordById(mediaId);
    if (!record) {
      const res = NextResponse.json({ success: false, error: 'NOT_FOUND: Media record not found.' }, { status: 404 });
      applyCorsHeaders(res, req);
      return res;
    }

    await assertCanAccessMedia(user, record);

    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get('mode') || 'stream').toLowerCase();

    if (mode === 'json' || mode === 'metadata') {
      const signed = searchParams.get('signed') === 'true' || !record.isPublic;
      const resolvedUrl = await resolveMediaAccessUrl(record, { signed });
      const res = NextResponse.json({
        success: true,
        media: { ...record, url: resolvedUrl },
        url: resolvedUrl,
      });
      applyCorsHeaders(res, req);
      return res;
    }

    if (mode === 'redirect') {
      const targetUrl = await resolveMediaAccessUrl(record, { signed: !record.isPublic });
      return NextResponse.redirect(targetUrl, 302);
    }

    const fileObj = await readMediaObjectBuffer(record);
    if (!fileObj) {
      const res = NextResponse.json(
        { success: false, error: 'NOT_FOUND: Object data missing in R2 storage.' },
        { status: 404 }
      );
      applyCorsHeaders(res, req);
      return res;
    }

    const res = new Response(new Uint8Array(fileObj.buffer), {
      status: 200,
      headers: {
        'Content-Type': fileObj.mimeType || record.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(record.fileName || 'media')}"`,
        'Cache-Control': record.isPublic ? 'public, max-age=31536000, immutable' : 'private, max-age=3600',
      },
    });
    return res;
  } catch (err: any) {
    const message = err?.message || 'Failed to retrieve media';
    const status = message.startsWith('UNAUTHORIZED') ? 401 : message.startsWith('FORBIDDEN') ? 403 : 500;
    const res = NextResponse.json({ success: false, error: message }, { status });
    applyCorsHeaders(res, req);
    return res;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  try {
    const user = await requireStrictMediaUser(req);
    const { mediaId } = await params;

    const record = await getMediaRecordById(mediaId);
    if (!record) {
      const res = NextResponse.json({ success: false, error: 'NOT_FOUND: Media record not found.' }, { status: 404 });
      applyCorsHeaders(res, req);
      return res;
    }

    await assertCanDeleteMedia(user, record);

    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true' && (user.role === 'super_admin' || user.role === 'admin');
    const detach = searchParams.get('detach') !== 'false';

    await deleteMediaById(mediaId, user, { force, detachEntityReference: detach });

    const res = NextResponse.json({ success: true, deletedId: mediaId });
    applyCorsHeaders(res, req);
    return res;
  } catch (err: any) {
    const message = err?.message || 'Failed to delete media';
    const status = message.startsWith('UNAUTHORIZED')
      ? 401
      : message.startsWith('FORBIDDEN')
      ? 403
      : message.startsWith('NOT_FOUND')
      ? 404
      : message.startsWith('CONFLICT')
      ? 409
      : 500;
    const res = NextResponse.json({ success: false, error: message }, { status });
    applyCorsHeaders(res, req);
    return res;
  }
}

