import { NextResponse } from 'next/server';
import { applyCorsHeaders, handleCorsPreflight } from '@/lib/api/cors';
import { listMediaByEntity, resolveMediaAccessUrl } from '@/lib/storage/media';
import { parseMediaEntityType, requireStrictMediaUser } from '@/lib/storage/media-auth';
import { sanitizeEntityId } from '@/lib/storage/media-types';

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

export async function GET(req: Request) {
  try {
    const user = await requireStrictMediaUser(req);
    const { searchParams } = new URL(req.url);

    const entityType = parseMediaEntityType(searchParams.get('entityType'));
    const entityId = sanitizeEntityId(searchParams.get('entityId') || '');

    if (user.role === 'staff' && entityType === 'user' && entityId !== user.uid) {
      const res = NextResponse.json(
        { success: false, error: 'FORBIDDEN: Staff can only view their own profile media.' },
        { status: 403 }
      );
      applyCorsHeaders(res, req);
      return res;
    }

    const items = await listMediaByEntity(entityType, entityId);
    const enriched = await Promise.all(
      items.map(async (item) => ({
        ...item,
        url: await resolveMediaAccessUrl(item, { signed: !item.isPublic }),
      }))
    );

    const res = NextResponse.json({ success: true, media: enriched, count: enriched.length });
    applyCorsHeaders(res, req);
    return res;
  } catch (err: any) {
    const message = err?.message || 'Failed to list media';
    const status = message.startsWith('UNAUTHORIZED')
      ? 401
      : message.startsWith('FORBIDDEN')
      ? 403
      : message.startsWith('INVALID_')
      ? 400
      : 500;
    const res = NextResponse.json({ success: false, error: message }, { status });
    applyCorsHeaders(res, req);
    return res;
  }
}

