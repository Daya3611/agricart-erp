import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { adminStorage, adminDb } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';

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
    const storagePath = `reports/${sessionUser.uid}/${reportId}/${attachmentId}_${file.name}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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

    let downloadUrl = `/api/uploads/view?path=${encodeURIComponent(storagePath)}`;

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

    const attachment = {
      id: attachmentId,
      reportId,
      staffUid: sessionUser.uid,
      employeeId: sessionUser.employeeId || '',
      storagePath,
      downloadUrl,
      originalFilename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      caption,
      uploadedByUid: sessionUser.uid,
      uploadedAt: new Date().toISOString(),
    };

    // Store file metadata and Storage object paths in erp_report_attachments
    await adminDb.collection(ERP_COLLECTIONS.reportAttachments).doc(attachmentId).set(attachment);

    return NextResponse.json({ success: true, attachment });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
