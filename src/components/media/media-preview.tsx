'use client';

import React, { useEffect, useState } from 'react';
import { Building2, FileText, Film, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface MediaPreviewProps {
  src?: string | null;
  alt?: string;
  mimeType?: string;
  fileName?: string;
  fallbackText?: string;
  variant?: 'avatar' | 'thumbnail' | 'logo' | 'banner' | 'card';
  shape?: 'circle' | 'rounded' | 'square';
  className?: string;
  imgClassName?: string;
  width?: number;
  height?: number;
  onClick?: () => void;
}

const VIDEO_EXTS = ['.mp4', '.mov', '.webm', '.avi', '.mkv'];
const DOC_EXTS = ['.pdf', '.docx', '.xlsx', '.csv', '.txt'];

function getKindFromMeta(src?: string | null, mimeType?: string, fileName?: string): 'video' | 'document' | 'image' {
  const mime = (mimeType || '').toLowerCase();
  const target = (fileName || src || '').toLowerCase().split('?')[0];

  if (mime.startsWith('video/') || VIDEO_EXTS.some((ext) => target.endsWith(ext))) {
    return 'video';
  }
  if (
    mime === 'application/pdf' ||
    mime.includes('wordprocessingml') ||
    mime.includes('spreadsheetml') ||
    mime === 'text/csv' ||
    mime === 'text/plain' ||
    DOC_EXTS.some((ext) => target.endsWith(ext))
  ) {
    return 'document';
  }
  return 'image';
}

export function MediaPreview({
  src,
  alt = 'Media preview',
  mimeType,
  fileName,
  fallbackText,
  variant = 'thumbnail',
  shape = 'rounded',
  className,
  imgClassName,
  width,
  height,
  onClick,
}: MediaPreviewProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const shapeClass =
    shape === 'circle' ? 'rounded-full' : shape === 'square' ? 'rounded-none' : 'rounded-xl';

  const variantDefaults: Record<NonNullable<MediaPreviewProps['variant']>, string> = {
    avatar: 'h-10 w-10 bg-emerald-700 text-white',
    thumbnail: 'h-20 w-24 bg-slate-100 border border-slate-200/80',
    logo: 'h-12 w-12 bg-white border border-slate-200/80 p-1',
    banner: 'h-40 w-full bg-slate-100 border border-slate-200/80',
    card: 'aspect-[4/3] w-full bg-slate-100 border border-slate-200/80',
  };

  const kind = getKindFromMeta(src, mimeType, fileName);
  const cleanSrc = src?.trim() || '';

  const renderFallback = () => {
    if (variant === 'avatar') {
      const initials = (fallbackText || alt || 'U')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      return (
        <span className="text-xs font-bold tracking-wide select-none">{initials}</span>
      );
    }

    if (variant === 'logo') {
      return <Building2 className="h-5 w-5 text-emerald-700/70" />;
    }

    if (kind === 'video') {
      return (
        <div className="flex flex-col items-center justify-center gap-1 p-2 text-center">
          <Film className="h-5 w-5 text-emerald-700" />
          <span className="text-[10px] font-semibold text-slate-600 line-clamp-1 max-w-full">
            {fileName || 'Video'}
          </span>
        </div>
      );
    }

    if (kind === 'document') {
      const extLabel = (fileName || cleanSrc).split('.').pop()?.split('?')[0]?.toUpperCase() || 'DOC';
      return (
        <div className="flex flex-col items-center justify-center gap-1 p-2 text-center">
          <FileText className="h-5 w-5 text-emerald-700" />
          <span className="text-[10px] font-bold text-slate-600 uppercase">{extLabel}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  };

  const showImage = Boolean(cleanSrc) && !hasError && kind === 'image';

  const ContainerTag = onClick ? 'button' : 'div';

  return (
    <ContainerTag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden shrink-0',
        variantDefaults[variant],
        shapeClass,
        onClick && 'cursor-pointer hover:ring-2 hover:ring-emerald-600/40 transition-all',
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cleanSrc}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          onError={() => setHasError(true)}
          className={cn(
            'h-full w-full',
            variant === 'logo' ? 'object-contain' : 'object-cover',
            imgClassName
          )}
        />
      ) : kind === 'video' && cleanSrc ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-900 text-white p-2">
          <Film className="h-5 w-5 text-emerald-400" />
          <span className="text-[10px] font-semibold tracking-wide uppercase">Video</span>
        </div>
      ) : (
        renderFallback()
      )}
    </ContainerTag>
  );
}

