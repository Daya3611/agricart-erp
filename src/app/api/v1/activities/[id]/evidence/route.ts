import { NextResponse } from 'next/server';
import { requireMobileAuth, apiSuccess, apiError } from '@/lib/api/v1-helper';
import { fetchDocument, updateDocument } from '@/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { EvidenceMetadataItem, FieldActivityRecord } from '@/types';
import { adminStorage } from '@/lib/firebase/admin';
import { isR2Configured } from '@/lib/storage/r2';
import { uploadMediaFile } from '@/lib/storage/media';
import { mergeEvidenceMetadata, mergeStringList } from '@/lib/utils/field-activity-calculations';

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
    let mediaId: string | undefined;
    let objectKey: string | undefined;
    let fileName = 'evidence';
    let mimeType = 'application/octet-stream';
    let caption = '';
    let isVideo = false;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      caption = (formData.get('caption') as string) || '';

      if (!file) {
        return apiError('No file provided in multipart upload.', 400);
      }

      fileName = file.name || fileName;
      mimeType = file.type || mimeType;
      isVideo = file.type.startsWith('video/');
      const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return apiError(`File size exceeds maximum allowed limit (${isVideo ? '100MB' : '10MB'}).`, 400);
      }

      const attachmentId = `evidence_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const storagePath = `activities/${user.uid}/${activityId}/${attachmentId}_${file.name}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (isR2Configured()) {
        const uploadResult = await uploadMediaFile({
          fileName: file.name,
          mimeType: file.type,
          buffer,
          entityType: 'activity',
          entityId: activityId,
          uploadedBy: user,
          centerId: activity.centerId || user.assignedCenterIds?.[0],
          caption,
          isPublic: false,
          validation: {
            allowDocuments: false,
            allowVideos: true,
            maxImageBytes: 10 * 1024 * 1024,
            maxVideoBytes: 100 * 1024 * 1024,
          },
        });
        uploadedUrl = uploadResult.resolvedUrl;
        mediaId = uploadResult.record.id;
        objectKey = uploadResult.record.objectKey;
      } else {
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

    const metadataItem: EvidenceMetadataItem = {
      objectKey,
      mediaId,
      mimeType: isVideo && mimeType === 'application/octet-stream' ? 'video/mp4' : mimeType === 'application/octet-stream' ? 'image/jpeg' : mimeType,
      fileName,
      uploadedAt: nowIso,
      uploadedBy: user.uid,
      url: uploadedUrl,
    };

    const updates: Partial<FieldActivityRecord> = {
      updatedAt: nowIso,
    };

    if (isVideo) {
      updates.videoUrl = uploadedUrl;
      updates.videoEvidence = [...new Set([...existingVideos, uploadedUrl])];
      updates.videoObjectKeys = mergeStringList(activity.videoObjectKeys, objectKey);
      updates.videoMediaIds = mergeStringList(activity.videoMediaIds, mediaId);
      updates.videoMetadata = mergeEvidenceMetadata(activity.videoMetadata, [metadataItem]);
    } else {
      updates.photoUrl = uploadedUrl;
      updates.photoEvidence = [...new Set([...existingPhotos, uploadedUrl])];
      updates.photoObjectKeys = mergeStringList(activity.photoObjectKeys, objectKey);
      updates.photoMediaIds = mergeStringList(activity.photoMediaIds, mediaId);
      updates.photoMetadata = mergeEvidenceMetadata(activity.photoMetadata, [metadataItem]);
    }

    await updateDocument(ERP_COLLECTIONS.fieldActivities, activityId, updates);

    return apiSuccess(
      {
        activityId,
        url: uploadedUrl,
        mediaId,
        objectKey,
        isVideo,
        caption,
        photoEvidence: updates.photoEvidence || existingPhotos,
        videoEvidence: updates.videoEvidence || existingVideos,
        updatedAt: nowIso,
      },
      'Evidence attached successfully'
    );
  } catch (err: any) {
    const message = err?.message || 'Evidence upload failed';
    const isClientError = message.includes('INVALID_') || message.includes('FILE_TOO_LARGE');
    const status = message.startsWith('UNAUTHORIZED')
      ? 401
      : message.startsWith('FORBIDDEN')
        ? 403
        : isClientError
          ? 400
          : 500;
    return apiError(message, status);
  }
}

