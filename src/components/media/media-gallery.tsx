'use client';

import React, { useState } from 'react';
import { Download, ExternalLink, Maximize2, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { MediaPreview } from './media-preview';

export interface MediaGalleryItem {
  id: string;
  url: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  caption?: string;
  uploadedAt?: string;
  isPrimary?: boolean;
  width?: number;
  height?: number;
}

export interface MediaGalleryProps {
  items: MediaGalleryItem[];
  onDelete?: (item: MediaGalleryItem) => Promise<void> | void;
  deletingId?: string | null;
  canDelete?: boolean;
  emptyMessage?: string;
  columns?: 2 | 3 | 4;
  className?: string;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaGallery({
  items,
  onDelete,
  deletingId,
  canDelete = false,
  emptyMessage = 'No media attachments yet.',
  columns = 3,
  className,
}: MediaGalleryProps) {
  const [selectedItem, setSelectedItem] = useState<MediaGalleryItem | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<MediaGalleryItem | null>(null);

  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  const gridCols =
    columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === 4
        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <>
      <div className={cn('grid gap-3', gridCols, className)}>
        {items.map((item) => {
          const isDeleting = deletingId === item.id;
          return (
            <div
              key={item.id}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs transition-all hover:border-emerald-300"
            >
              <div className="relative bg-slate-100">
                <MediaPreview
                  src={item.url}
                  alt={item.caption || item.fileName}
                  mimeType={item.mimeType}
                  fileName={item.fileName}
                  variant="card"
                  shape="square"
                  className="border-0"
                  onClick={() => setSelectedItem(item)}
                />

                {item.isPrimary && (
                  <Badge className="absolute left-2 top-2 bg-emerald-700 text-white border-0 text-[10px] gap-1 px-2 py-0.5">
                    <Star className="h-2.5 w-2.5 fill-current" /> Primary
                  </Badge>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  title="Preview full screen"
                  className="absolute right-2 top-2 rounded-lg bg-slate-900/70 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-900"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">{item.fileName}</p>
                  <p className="text-[10px] text-slate-400">
                    {[formatFileSize(item.size), item.width && item.height ? `${item.width}x${item.height}` : '']
                      .filter(Boolean)
                      .join(' · ') || 'Stored media'}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open media"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  {canDelete && onDelete && (
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setConfirmDeleteItem(item)}
                      title="Delete media"
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      <Dialog
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        title={selectedItem?.fileName || 'Media Preview'}
        description={selectedItem?.caption || undefined}
        maxWidth="max-w-3xl"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="flex items-center justify-center rounded-xl bg-slate-950/95 p-3 max-h-[65vh] overflow-hidden">
              {selectedItem.mimeType?.startsWith('video/') ? (
                <video
                  src={selectedItem.url}
                  controls
                  className="max-h-[60vh] w-full rounded-lg"
                />
              ) : selectedItem.mimeType === 'application/pdf' ? (
                <div className="flex flex-col items-center gap-3 py-10 text-white">
                  <p className="text-sm font-semibold">{selectedItem.fileName}</p>
                  <a
                    href={selectedItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Open PDF Document <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedItem.url}
                  alt={selectedItem.fileName}
                  className="max-h-[60vh] w-auto rounded-lg object-contain"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                {[
                  formatFileSize(selectedItem.size),
                  selectedItem.width && selectedItem.height
                    ? `${selectedItem.width} × ${selectedItem.height}px`
                    : '',
                  selectedItem.uploadedAt ? new Date(selectedItem.uploadedAt).toLocaleString() : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <a
                href={selectedItem.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline"
              >
                Open Original <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmDeleteItem)}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteItem(null);
        }}
        title="Delete Media File?"
        description="This will remove the file from Cloudflare R2 storage if it is no longer referenced by an active report."
        maxWidth="max-w-md"
      >
        {confirmDeleteItem && (
          <div className="space-y-4">
            <p className="rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-700 border border-slate-200">
              {confirmDeleteItem.fileName}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDeleteItem(null)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deletingId === confirmDeleteItem.id}
                onClick={async () => {
                  const target = confirmDeleteItem;
                  setConfirmDeleteItem(null);
                  await onDelete?.(target);
                }}
                className="rounded-xl"
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

