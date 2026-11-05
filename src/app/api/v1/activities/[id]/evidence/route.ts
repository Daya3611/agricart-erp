import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { fetchDocument, updateDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { FieldActivityRecord } from '@/types';
import { adminStorage } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export { handleCorsPreflight as OPTIONS } from '@/lib/api/v1-helper';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireMobileAuth(req);
    const { id: activityId } = await params;

    const activity = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, activityId)) as FieldActivityRecord | null;
    if (!activity) {
      return apiError('Activity not found in database.', 404);
    }

    if (activity.staffUid !== user.uid && user.role !== 'admin' && user.role !== 'super_admin') {
      return apiError('FORBIDDEN: You cannot upload evidence for another employee\'s activity.', 403);
    }

    const contentType = req.headers.get('content-type') || '';
    let uploadedUrl = '';
    let caption = '';
    let isVideo = false;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      caption = (formData.get('caption') as string) || '';

      if (!file) {
        return apiError('No file provided in multipart upload.', 400);
      }

      isVideo = file.type.startsWith('video/');
      const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return apiError(`File size exceeds maximum allowed limit (${isVideo ? '100MB' : '10MB'}).`, 400);
      }

      const attachmentId = `evidence_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const storagePath = `activities/${user.uid}/${activityId}/${attachmentId}_${file.name}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Persist locally for dev / offline sync fallback
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const localPath = path.join(process.cwd(), 'storage', 'uploads', storagePath);
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, buffer);
      } catch (fsErr: any) {
        console.warn('Local file write warning:', fsErr.message);
      }

      uploadedUrl = `/api/uploads/view?path=${encodeURIComponent(storagePath)}`;

      // Save to Firebase Storage bucket if configured
      try {
        const bucket = adminStorage.bucket();
        const fileRef = bucket.file(storagePath);
        await fileRef.save(buffer, {
          metadata: {
            contentType: file.type,
            metadata: {
              uploadedByUid: user.uid,
              activityId,
              reportDate: activity.reportDate,
            },
          },
        });
        const [signedUrl] = await fileRef.getSignedUrl({
          action: 'read',
          expires: '03-01-2035',
        });
        if (signedUrl) uploadedUrl = signedUrl;
      } catch {
        // Fallback remains the secure view endpoint
      }
    } else {
      // JSON payload
      const body = await req.json();
      uploadedUrl = body.photoUrl || body.videoUrl || '';
      caption = body.caption || '';
      isVideo = Boolean(body.videoUrl && !body.photoUrl);

      if (!uploadedUrl) {
        return apiError('Missing photoUrl or videoUrl in payload.', 400);
      }
    }

    const nowIso = new Date().toISOString();
    const existingPhotos = Array.isArray(activity.photoEvidence) ? activity.photoEvidence : [];
    const existingVideos = Array.isArray(activity.videoEvidence) ? activity.videoEvidence : [];

    const updates: Partial<FieldActivityRecord> = {
      updatedAt: nowIso,
    };

    if (isVideo) {
      updates.videoUrl = uploadedUrl;
      updates.videoEvidence = [...new Set([...existingVideos, uploadedUrl])];
    } else {
      updates.photoUrl = uploadedUrl;
      updates.photoEvidence = [...new Set([...existingPhotos, uploadedUrl])];
    }

    await updateDocument(ERP_COLLECTIONS.fieldActivities, activityId, updates);

    return apiSuccess(
      {
        activityId,
        url: uploadedUrl,
        isVideo,
        caption,
        photoEvidence: updates.photoEvidence || existingPhotos,
        videoEvidence: updates.videoEvidence || existingVideos,
        updatedAt: nowIso,
      },
      'Evidence attached successfully'
    );
  } catch (err: any) {
    const status = err.message?.startsWith('UNAUTHORIZED') ? 401 : err.message?.startsWith('FORBIDDEN') ? 403 : 500;
    return apiError(err.message, status);
  }
}

