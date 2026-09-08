import React, { useState } from 'react';

/**
 * Utility to parse and classify media URLs (Instagram, YouTube, Vimeo, direct MP4, etc.)
 */
export function parseMediaUrl(url, declaredMediaType) {
  if (!url) return { type: 'unknown', url: '' };

  const trimmed = url.trim();
  const cleanUrl = trimmed.split('?')[0].toLowerCase();

  // 1. Document / PDF (Strict check)
  if (declaredMediaType === 'document' || cleanUrl.endsWith('.pdf')) {
    return {
      type: 'document',
      embedUrl: trimmed,
      originalUrl: trimmed,
    };
  }

  // 2. Photographs / Images (Strict check)
  const isImageExt =
    cleanUrl.endsWith('.jpg') ||
    cleanUrl.endsWith('.jpeg') ||
    cleanUrl.endsWith('.png') ||
    cleanUrl.endsWith('.webp') ||
    cleanUrl.endsWith('.gif') ||
    cleanUrl.endsWith('.svg') ||
    cleanUrl.endsWith('.avif') ||
    cleanUrl.endsWith('.bmp');

  if (declaredMediaType === 'image' || isImageExt) {
    return {
      type: 'image',
      embedUrl: trimmed,
      originalUrl: trimmed,
    };
  }

  // 3. Instagram Post or Reel
  const igMatch = trimmed.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  if (igMatch && igMatch[1]) {
    return {
      type: 'instagram',
      id: igMatch[1],
      embedUrl: `https://www.instagram.com/reel/${igMatch[1]}/embed/`,
      originalUrl: trimmed,
    };
  }

  // 4. YouTube Video or Shorts
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      id: ytMatch[1],
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=0&rel=0`,
      originalUrl: trimmed,
    };
  }

  // 5. Vimeo Video
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      type: 'vimeo',
      id: vimeoMatch[3],
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}`,
      originalUrl: trimmed,
    };
  }

  // 6. Direct video file extensions or local video uploads
  const isVideoExt =
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.webm') ||
    cleanUrl.endsWith('.mov') ||
    cleanUrl.endsWith('.ogg') ||
    cleanUrl.endsWith('.m4v') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:video');

  if (isVideoExt || declaredMediaType === 'video') {
    return {
      type: 'direct_video',
      embedUrl: trimmed,
      originalUrl: trimmed,
    };
  }

  // Default fallback to image
  return {
    type: 'image',
    embedUrl: trimmed,
    originalUrl: trimmed,
  };
}

export default function PortfolioMediaViewer({
  mediaUrl,
  thumbnailUrl = null,
  mediaType = 'image',
  title = 'Work Sample',
  className = 'w-full h-full object-cover',
  isThumbnail = false,
}) {
  const [videoError, setVideoError] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [dynamicThumb, setDynamicThumb] = useState(thumbnailUrl || null);

  // Normalize /uploads to absolute backend origin if needed
  const finalUrl = mediaUrl?.startsWith('/uploads')
    ? `http://127.0.0.1:5000${mediaUrl}`
    : mediaUrl;

  const parsed = parseMediaUrl(finalUrl, mediaType);

  // Auto-fetch thumbnail for Instagram if not already supplied
  React.useEffect(() => {
    if (thumbnailUrl) {
      setDynamicThumb(thumbnailUrl);
      return;
    }

    if (parsed.type === 'instagram' && parsed.originalUrl) {
      let isMounted = true;
      fetch(`http://127.0.0.1:5000/api/v1/portfolios/media-preview?url=${encodeURIComponent(parsed.originalUrl)}`)
        .then((res) => res.json())
        .then((json) => {
          if (isMounted && json?.success && json?.data?.thumbnailUrl) {
            setDynamicThumb(json.data.thumbnailUrl);
          }
        })
        .catch(() => {
          // Fallback gracefully to aesthetic gradient
        });

      return () => {
        isMounted = false;
      };
    }
  }, [parsed.originalUrl, thumbnailUrl, parsed.type]);

  const handleOpenExternal = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (parsed.originalUrl) {
      window.open(parsed.originalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // === 1. INSTAGRAM REEL / POST (Clean Preview Card, No Profile Iframe) ===
  if (parsed.type === 'instagram') {
    return (
      <div
        onClick={handleOpenExternal}
        className="w-full h-full relative bg-slate-950 flex items-center justify-center overflow-hidden group cursor-pointer select-none"
        title="Click to view on Instagram"
      >
        {dynamicThumb && !imgError ? (
          <img
            src={dynamicThumb}
            alt={title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-lg mb-2">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-200 line-clamp-1">{title}</span>
            <span className="text-[10px] text-pink-400 font-medium mt-0.5">Instagram Reel</span>
          </div>
        )}

        {/* Ambient Dark Gradient Layer */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none" />

        {/* Top-Left Category Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold border border-white/10 shadow-xs pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-500"></span>
          <span>Instagram Reel</span>
        </div>

        {/* Centered Sleek Play Button Overlay */}
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/25 backdrop-blur-md border border-white/40 shadow-2xl flex items-center justify-center group-hover:bg-white/35 group-hover:scale-110 transition-all duration-300">
            <svg className="w-6 h-6 text-white ml-0.5 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Bottom Banner with Redirect CTA */}
        <div className="absolute bottom-2.5 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
          <span className="text-white text-xs font-semibold drop-shadow-md truncate max-w-[65%]">
            {title}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-[10px] font-semibold flex items-center gap-1 border border-white/20 shadow-xs transition-colors">
            <span>Watch</span> ↗
          </span>
        </div>
      </div>
    );
  }

  // === 2. YOUTUBE VIDEO / SHORTS (Clean Preview Card) ===
  if (parsed.type === 'youtube') {
    const ytThumb = `https://img.youtube.com/vi/${parsed.id}/hqdefault.jpg`;
    return (
      <div
        onClick={handleOpenExternal}
        className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden group cursor-pointer select-none"
        title="Click to watch on YouTube"
      >
        <img
          src={ytThumb}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none" />

        {/* Top-Left Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold border border-white/10 shadow-xs pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-red-600"></span>
          <span>YouTube</span>
        </div>

        {/* Centered Play Button */}
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-600/90 backdrop-blur-md border border-red-400/50 shadow-2xl flex items-center justify-center group-hover:bg-red-600 group-hover:scale-110 transition-all duration-300">
            <svg className="w-6 h-6 text-white ml-0.5 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="absolute bottom-2.5 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
          <span className="text-white text-xs font-semibold drop-shadow-md truncate max-w-[65%]">
            {title}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-red-600/80 backdrop-blur-md text-white text-[10px] font-semibold flex items-center gap-1 border border-white/20 shadow-xs">
            <span>Watch</span> ↗
          </span>
        </div>
      </div>
    );
  }

  // === 3. VIMEO VIDEO (Clean Preview Card) ===
  if (parsed.type === 'vimeo') {
    const vimeoThumb = `https://vumbnail.com/${parsed.id}.jpg`;
    return (
      <div
        onClick={handleOpenExternal}
        className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden group cursor-pointer select-none"
        title="Click to watch on Vimeo"
      >
        <img
          src={vimeoThumb}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none" />

        {/* Top-Left Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold border border-white/10 shadow-xs pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>Vimeo</span>
        </div>

        {/* Centered Play Button */}
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-600/90 backdrop-blur-md border border-blue-400/50 shadow-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:scale-110 transition-all duration-300">
            <svg className="w-6 h-6 text-white ml-0.5 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="absolute bottom-2.5 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
          <span className="text-white text-xs font-semibold drop-shadow-md truncate max-w-[65%]">
            {title}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-blue-600/80 backdrop-blur-md text-white text-[10px] font-semibold flex items-center gap-1 border border-white/20 shadow-xs">
            <span>Watch</span> ↗
          </span>
        </div>
      </div>
    );
  }

  // === 4. DIRECT VIDEO STREAM (MP4, WEBM, LOCAL UPLOADS) ===
  if (mediaType === 'video' || parsed.type === 'direct_video') {
    if (videoError) {
      return (
        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-4 text-center text-white">
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-2">
            🎬
          </div>
          <span className="text-xs font-semibold text-slate-200 line-clamp-1">{title}</span>
          <span className="text-[10px] text-slate-400 mt-0.5">Online Video Stream</span>
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Play Video ↗
          </a>
        </div>
      );
    }

    return (
      <video
        src={finalUrl}
        controls
        playsInline
        className={className}
        onError={() => setVideoError(true)}
      />
    );
  }

  // === 5. PDF DOCUMENT LOOKBOOK ===
  if (mediaType === 'document' || parsed.type === 'document') {
    return (
      <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
        <span className="text-3xl mb-1">📄</span>
        <span className="text-xs font-bold text-slate-800 line-clamp-1">{title}</span>
        <a
          href={finalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Open PDF Lookbook &rarr;
        </a>
      </div>
    );
  }

  // === 6. PHOTOGRAPH / IMAGE ===
  return (
    <img
      src={
        imgError
          ? 'https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=800&auto=format&fit=crop&q=60'
          : finalUrl
      }
      alt={title}
      className={className}
      onError={() => setImgError(true)}
    />
  );
}
