'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  UploadCloud,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { MediaPreview } from './media-preview';

export interface UploadedMediaItem {
  id: string;
  objectKey: string;
  url: string;
  publicUrl?: string;
  fileName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

interface UploadQueueItem {
  localId: string;
  file: File;
  previewUrl?: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  uploaded?: UploadedMediaItem;
}

export interface MediaUploadProps {
  entityType:
    | 'product'
    | 'farmer'
    | 'center'
    | 'user'
    | 'report'
    | 'activity'
    | 'leave'
    | 'organization'
    | 'document';
  entityId: string;
  centerId?: string;
  isPublic?: boolean;
  setAsPrimary?: boolean;
  allowDocuments?: boolean;
  allowVideos?: boolean;
  multiple?: boolean;
  maxFiles?: number;
  accept?: string;
  label?: string;
  description?: string;
  currentUrl?: string | null;
  compact?: boolean;
  disabled?: boolean;
  onUploadSingle?: (item: UploadedMediaItem) => void;
  onUploadComplete?: (items: UploadedMediaItem[]) => void;
  onError?: (message: string) => void;
  className?: string;
}

const BLOCKED_EXTENSIONS = new Set([
  'exe',
  'msi',
  'bat',
  'cmd',
  'sh',
  'ps1',
  'vbs',
  'js',
  'mjs',
  'cjs',
  'php',
  'py',
  'rb',
  'html',
  'htm',
  'svg',
]);

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaUpload({
  entityType,
  entityId,
  centerId,
  isPublic,
  setAsPrimary = false,
  allowDocuments = false,
  allowVideos = false,
  multiple = false,
  maxFiles = 5,
  accept,
  label = 'Upload Media',
  description,
  currentUrl,
  compact = false,
  disabled = false,
  onUploadSingle,
  onUploadComplete,
  onError,
  className,
}: MediaUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);

  useEffect(() => {
    return () => {
      queue.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
    // Cleanup on unmount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computedAccept =
    accept ||
    [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      ...(allowDocuments
        ? [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
          ]
        : []),
      ...(allowVideos ? ['video/mp4', 'video/quicktime', 'video/webm'] : []),
    ].join(',');

  const validateFileClient = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return `Executable or unsafe file type ".${ext}" is blocked.`;
    }
    const isVideo = file.type.startsWith('video/');
    const isDoc =
      file.type === 'application/pdf' ||
      file.type.includes('wordprocessingml') ||
      file.type.includes('spreadsheetml') ||
      file.type === 'text/csv' ||
      file.type === 'text/plain';
    const isImage = file.type.startsWith('image/');

    if (!isImage && !(allowDocuments && isDoc) && !(allowVideos && isVideo)) {
      return `Unsupported file type: ${file.type || file.name}`;
    }

    const maxBytes = isVideo ? 100 * 1024 * 1024 : isDoc ? 20 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return `File exceeds maximum size (${Math.round(maxBytes / (1024 * 1024))}MB).`;
    }
    return null;
  };

  const uploadSingleQueueItem = (item: UploadQueueItem) => {
    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    if (centerId) formData.append('centerId', centerId);
    if (typeof isPublic === 'boolean') formData.append('isPublic', String(isPublic));
    if (setAsPrimary) formData.append('setAsPrimary', 'true');
    if (allowDocuments) formData.append('allowDocuments', 'true');
    if (allowVideos) formData.append('allowVideos', 'true');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1/media/upload', true);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
        setQueue((prev) =>
          prev.map((q) => (q.localId === item.localId ? { ...q, progress: pct } : q))
        );
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && parsed.success && parsed.data?.media) {
          const media = parsed.data.media;
          const uploaded: UploadedMediaItem = {
            id: media.id,
            objectKey: media.objectKey,
            url: parsed.data.url || media.publicUrl || `/api/v1/media/${media.id}`,
            publicUrl: media.publicUrl,
            fileName: media.fileName || item.file.name,
            mimeType: media.mimeType || item.file.type,
            size: media.size || item.file.size,
            width: media.width,
            height: media.height,
          };

          setQueue((prev) => {
            const next = prev.map((q) =>
              q.localId === item.localId
                ? { ...q, status: 'done' as const, progress: 100, uploaded, error: undefined }
                : q
            );
            const completed = next
              .filter((q) => q.status === 'done' && q.uploaded)
              .map((q) => q.uploaded as UploadedMediaItem);
            onUploadSingle?.(uploaded);
            if (!next.some((q) => q.status === 'uploading') && completed.length > 0) {
              onUploadComplete?.(completed);
            }
            return next;
          });
        } else {
          const msg = parsed?.error || `Upload failed (${xhr.status})`;
          setQueue((prev) =>
            prev.map((q) =>
              q.localId === item.localId ? { ...q, status: 'error', error: msg } : q
            )
          );
          onError?.(msg);
        }
      } catch {
        const msg = `Unexpected upload response (${xhr.status})`;
        setQueue((prev) =>
          prev.map((q) =>
            q.localId === item.localId ? { ...q, status: 'error', error: msg } : q
          )
        );
        onError?.(msg);
      }
    };

    xhr.onerror = () => {
      const msg = 'Network error while uploading file.';
      setQueue((prev) =>
        prev.map((q) =>
          q.localId === item.localId ? { ...q, status: 'error', error: msg } : q
        )
      );
      onError?.(msg);
    };

    xhr.send(formData);
  };

  const handleFilesSelected = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0 || disabled) return;

    const selected = Array.from(filesList).slice(0, multiple ? maxFiles : 1);
    const createdItems: UploadQueueItem[] = selected.map((file, idx) => {
      const errMsg = validateFileClient(file);
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      return {
        localId: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl,
        progress: errMsg ? 0 : 5,
        status: errMsg ? 'error' : 'uploading',
        error: errMsg || undefined,
      };
    });

    if (!multiple) {
      queue.forEach((old) => {
        if (old.previewUrl) URL.revokeObjectURL(old.previewUrl);
      });
      setQueue(createdItems);
    } else {
      setQueue((prev) => [...prev, ...createdItems].slice(0, maxFiles));
    }

    createdItems.forEach((item) => {
      if (item.status === 'uploading') {
        uploadSingleQueueItem(item);
      } else if (item.error) {
        onError?.(item.error);
      }
    });

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const removeQueueItem = (localId: string) => {
    setQueue((prev) => {
      const target = prev.find((q) => q.localId === localId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((q) => q.localId !== localId);
    });
  };

  const retryQueueItem = (item: UploadQueueItem) => {
    const errMsg = validateFileClient(item.file);
    if (errMsg) {
      setQueue((prev) =>
        prev.map((q) => (q.localId === item.localId ? { ...q, status: 'error', error: errMsg } : q))
      );
      return;
    }
    const resetItem: UploadQueueItem = {
      ...item,
      status: 'uploading',
      progress: 5,
      error: undefined,
    };
    setQueue((prev) => prev.map((q) => (q.localId === item.localId ? resetItem : q)));
    uploadSingleQueueItem(resetItem);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFilesSelected(e.dataTransfer.files);
        }}
        className={cn(
          'relative rounded-2xl border-2 border-dashed transition-colors',
          compact ? 'p-3' : 'p-5',
          isDragging
            ? 'border-emerald-600 bg-emerald-50/70'
            : 'border-slate-200 bg-slate-50/60 hover:border-emerald-400',
          disabled && 'opacity-60 pointer-events-none'
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={computedAccept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {currentUrl && queue.length === 0 ? (
              <MediaPreview
                src={currentUrl}
                alt={label}
                variant={entityType === 'organization' ? 'logo' : 'thumbnail'}
                className="h-12 w-12 shrink-0"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <UploadCloud className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {description ||
                  `Drag & drop or choose file (JPEG, PNG, WebP${allowDocuments ? ', PDF, DOCX, XLSX' : ''}${allowVideos ? ', MP4, WebM' : ''})`}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-xl border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 font-semibold"
          >
            Choose File{multiple ? 's' : ''}
          </Button>
        </div>
      </div>

      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((item) => (
            <div
              key={item.localId}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs"
            >
              <MediaPreview
                src={item.uploaded?.url || item.previewUrl}
                alt={item.file.name}
                mimeType={item.file.type}
                fileName={item.file.name}
                variant="thumbnail"
                className="h-11 w-11 rounded-lg"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-slate-800">{item.file.name}</p>
                  <span className="text-[10px] font-medium text-slate-400 shrink-0">
                    {formatBytes(item.file.size)}
                  </span>
                </div>

                {item.status === 'uploading' && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <p className="flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading to R2... {item.progress}%
                    </p>
                  </div>
                )}

                {item.status === 'done' && (
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Uploaded cleanly
                  </p>
                )}

                {item.status === 'error' && (
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.error || 'Upload failed'}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {item.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => retryQueueItem(item)}
                    title="Retry upload"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeQueueItem(item.localId)}
                  title="Remove"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

