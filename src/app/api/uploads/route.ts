import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { adminStorage, adminDb } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { isR2Configured } from '@/lib/storage/r2';
import { uploadMediaFile } from '@/lib/storage/media';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const sessionUser = await getServerSession();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const caption = (formData.get('caption') as string) || '';
    const reportId = (formData.get('reportId') as string) || `temp_${Date.now()}`;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate size limits
    const isVideo = file.type.startsWith('video/');
    const maxPhotoSize = 10 * 1024 * 1024; // 10MB
    const maxVideoSize = 100 * 1024 * 1024; // 100MB

    if (!isVideo && file.size > maxPhotoSize) {
      return NextResponse.json({ error: 'Photo size exceeds maximum 10MB limit.' }, { status: 400 });
    }
    if (isVideo && file.size > maxVideoSize) {
      return NextResponse.json({ error: 'Video size exceeds maximum 100MB limit.' }, { status: 400 });
    }

    const attachmentId = `att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let storagePath = `reports/${sessionUser.uid}/${reportId}/${attachmentId}_${file.name}`;
    let downloadUrl = `/api/uploads/view?path=${encodeURIComponent(storagePath)}`;
    let mediaId: string | undefined;
    let r2ObjectKey: string | undefined;
    let storageProvider: 'r2' | 'firebase' = 'firebase';

    // Prefer centralized Cloudflare R2 storage when configured
    if (isR2Configured()) {
      const uploadResult = await uploadMediaFile({
        fileName: file.name,
        mimeType: file.type,
        buffer,
        entityType: 'report',
        entityId: reportId,
        uploadedBy: sessionUser,
        centerId: sessionUser.assignedCenterIds?.[0],
        caption,
        isPublic: false,
        validation: {
          allowDocuments: true,
          allowVideos: true,
          maxImageBytes: maxPhotoSize,
          maxDocumentBytes: maxPhotoSize,
          maxVideoBytes: maxVideoSize,
        },
      });

      mediaId = uploadResult.record.id;
      r2ObjectKey = uploadResult.record.objectKey;
      storagePath = uploadResult.record.objectKey;
      downloadUrl = uploadResult.resolvedUrl;
      storageProvider = 'r2';
    } else {
      // Persist file locally in storage/uploads directory for offline/local development and fallback
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const localFilePath = path.join(process.cwd(), 'storage', 'uploads', storagePath);
        await fs.mkdir(path.dirname(localFilePath), { recursive: true });
        await fs.writeFile(localFilePath, buffer);
      } catch (fsErr: any) {
        console.warn('Local filesystem upload save warning:', fsErr.message);
      }

      try {
        const bucket = adminStorage.bucket();
        const fileRef = bucket.file(storagePath);

        await fileRef.save(buffer, {
          metadata: {
            contentType: file.type,
            metadata: {
              staffUid: sessionUser.uid,
              originalFilename: file.name,
              uploadedBy: sessionUser.fullName,
            },
          },
        });

        // Generate signed URL (expires in 7 days) if configured
        const [url] = await fileRef.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        if (url) {
          downloadUrl = url;
        }
      } catch (storageErr: any) {
        console.warn('Firebase Storage cloud save fallback, serving from /api/uploads/view:', storageErr.message);
      }
    }

    const nowIso = new Date().toISOString();
    const attachment = {
      id: attachmentId,
      reportId,
      staffUid: sessionUser.uid,
      employeeId: sessionUser.employeeId || '',
      storagePath,
      downloadUrl,
      ...(mediaId ? { mediaId } : {}),
      ...(r2ObjectKey ? { objectKey: r2ObjectKey, r2ObjectKey } : {}),
      storageProvider,
      originalFilename: file.name,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      caption,
      uploadedByUid: sessionUser.uid,
      uploadedBy: sessionUser.uid,
      uploadedAt: nowIso,
    };

    // Store file metadata and Storage object paths in erp_report_attachments
    await adminDb.collection(ERP_COLLECTIONS.reportAttachments).doc(attachmentId).set(attachment);

    return NextResponse.json({ success: true, attachment });
  } catch (err: any) {
    console.error('[api/uploads] Upload failed:', err);
    const message = err?.message || 'Upload failed';
    const isClientError =
      message.includes('INVALID_') ||
      message.includes('FILE_TOO_LARGE') ||
      message.includes('NO_FILE') ||
      message.includes('EMPTY_FILE') ||
      message.includes('UNSUPPORTED_FILE_TYPE') ||
      message.includes('UNSAFE_FILE_TYPE');
    return NextResponse.json({ success: false, error: message }, { status: isClientError ? 400 : 500 });
  }
}
