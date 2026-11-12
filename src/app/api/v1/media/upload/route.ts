import { NextResponse } from 'next/server';
import { applyCorsHeaders, handleCorsPreflight } from '@/lib/api/cors';
import { uploadMediaFile } from '@/lib/storage/media';
import {
  assertCanUploadMedia,
  parseMediaEntityType,
  requireStrictMediaUser,
} from '@/lib/storage/media-auth';
import { MediaValidationOptions } from '@/lib/storage/media-types';

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handleCorsPreflight(req);
}

function errorStatusFromMessage(message: string): number {
  if (message.startsWith('UNAUTHORIZED')) return 401;
  if (message.startsWith('FORBIDDEN')) return 403;
  if (message.startsWith('NOT_FOUND')) return 404;
  if (message.startsWith('R2_NOT_CONFIGURED')) return 503;
  if (
    message.startsWith('INVALID_') ||
    message.startsWith('UNSAFE_') ||
    message.startsWith('UNSUPPORTED_') ||
    message.startsWith('FILE_TOO_LARGE') ||
    message.startsWith('EMPTY_FILE')
  ) {
    return 400;
  }
  return 500;
}

export async function POST(req: Request) {
  try {
    const user = await requireStrictMediaUser(req);
    const formData = await req.formData();

    const file = formData.get('file') as File | null;
    if (!file || typeof file.arrayBuffer !== 'function') {
      const res = NextResponse.json({ success: false, error: 'Missing uploaded file.' }, { status: 400 });
      applyCorsHeaders(res, req);
      return res;
    }

    const entityType = parseMediaEntityType(formData.get('entityType') as string | null);
    const rawEntityId = ((formData.get('entityId') as string | null) || '').trim();
    const entityId =
      rawEntityId ||
      (entityType === 'user' ? user.uid : entityType === 'organization' ? 'global' : '');

    if (!entityId) {
      const res = NextResponse.json(
        { success: false, error: 'INVALID_ENTITY_ID: entityId is required.' },
        { status: 400 }
      );
      applyCorsHeaders(res, req);
      return res;
    }

    const centerId = ((formData.get('centerId') as string | null) || user.assignedCenterIds?.[0] || '').trim() || undefined;
    const isPublicRaw = formData.get('isPublic') as string | null;
    const isPublic = isPublicRaw === 'true' ? true : isPublicRaw === 'false' ? false : undefined;
    const setAsPrimary = (formData.get('setAsPrimary') as string | null) === 'true';
    const caption = ((formData.get('caption') as string | null) || '').trim() || undefined;

    await assertCanUploadMedia({
      user,
      entityType,
      entityId,
      centerId,
    });

    const allowDocuments =
      ['document', 'leave', 'report', 'center'].includes(entityType) ||
      (formData.get('allowDocuments') as string | null) === 'true';
    const allowVideos = ['report', 'activity'].includes(entityType);

    const validation: MediaValidationOptions = {
      allowDocuments,
      allowVideos,
      minWidth: entityType === 'organization' || entityType === 'user' ? 32 : undefined,
      minHeight: entityType === 'organization' || entityType === 'user' ? 32 : undefined,
    };

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { record, resolvedUrl } = await uploadMediaFile({
      fileName: file.name || 'upload',
      mimeType: file.type || 'application/octet-stream',
      buffer,
      entityType,
      entityId,
      uploadedBy: user,
      centerId,
      isPublic,
      setAsPrimary,
      caption,
      validation,
    });

    const res = NextResponse.json(
      {
        success: true,
        media: {
          ...record,
          url: resolvedUrl,
        },
        url: resolvedUrl,
        objectKey: record.objectKey,
      },
      { status: 201 }
    );
    applyCorsHeaders(res, req);
    return res;
  } catch (err: any) {
    const message = err?.message || 'Upload failed';
    const res = NextResponse.json({ success: false, error: message }, { status: errorStatusFromMessage(message) });
    applyCorsHeaders(res, req);
    return res;
  }
}

