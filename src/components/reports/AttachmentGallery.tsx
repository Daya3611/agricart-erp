'use client';

import React, { useState } from 'react';
import { Image as ImageIcon, Video as VideoIcon, Eye, Download, X } from 'lucide-react';
import { ReportAttachment } from '@/types';
import { Dialog } from '@/components/ui/dialog';

interface AttachmentGalleryProps {
  attachments: ReportAttachment[];
}

export function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  const [selectedMedia, setSelectedMedia] = useState<ReportAttachment | null>(null);

  if (!attachments || attachments.length === 0) {
    return (
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-center text-xs text-slate-500 font-medium">
        No photo or video evidence attached to this report.
      </div>
    );
  }

  const isVideo = (mime: string) => mime.startsWith('video/');

  const getMediaSource = (att: ReportAttachment) => {
    if (att.downloadUrl) return att.downloadUrl;
    if (att.storagePath) {
      if (att.storagePath.startsWith('http://') || att.storagePath.startsWith('https://') || att.storagePath.startsWith('/')) {
        return att.storagePath;
      }
      return `/api/uploads/view?path=${encodeURIComponent(att.storagePath)}`;
    }
    return '/placeholder.png';
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {attachments.map((att, idx) => {
          const video = isVideo(att.mimeType);
          const src = getMediaSource(att);

          return (
            <div
              key={att.id || idx}
              onClick={() => setSelectedMedia(att)}
              className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer aspect-square flex flex-col justify-between hover:border-emerald-500 transition-all shadow-2xs"
            >
              {video ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white">
                  <VideoIcon className="h-8 w-8 text-emerald-400 mb-1 animate-pulse" />
                  <span className="text-[10px] font-bold tracking-wide uppercase bg-emerald-600/80 px-2 py-0.5 rounded-full">
                    Video
                  </span>
                </div>
              ) : (
                <img
                  src={src}
                  alt={att.caption || att.originalFilename || 'Work evidence'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    // Fallback visual if preview fails
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              )}

              {/* Hover overlay with preview icon */}
              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Eye className="h-6 w-6" />
              </div>

              {/* Caption Tag */}
              {att.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-slate-900/75 backdrop-blur-xs px-2 py-1 text-[10px] font-medium text-white truncate">
                  {att.caption}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox / Media Viewer Modal */}
      {selectedMedia && (
        <Dialog
          open={Boolean(selectedMedia)}
          onOpenChange={() => setSelectedMedia(null)}
          title={selectedMedia.originalFilename || 'Evidence Preview'}
          description={selectedMedia.caption || `Uploaded at ${new Date(selectedMedia.uploadedAt).toLocaleString('en-IN')}`}
          maxWidth="max-w-3xl"
        >
          <div className="flex flex-col items-center justify-center p-2 bg-slate-950 rounded-xl overflow-hidden">
            {isVideo(selectedMedia.mimeType) ? (
              <video
                controls
                autoPlay
                className="max-h-[60vh] w-full rounded-lg"
                src={getMediaSource(selectedMedia)}
              >
                Your browser does not support HTML5 video.
              </video>
            ) : (
              <img
                src={getMediaSource(selectedMedia)}
                alt={selectedMedia.caption || 'Evidence Photo'}
                className="max-h-[65vh] object-contain rounded-lg"
              />
            )}
          </div>
          {selectedMedia.caption && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-semibold text-emerald-900">
              📌 Caption: {selectedMedia.caption}
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
