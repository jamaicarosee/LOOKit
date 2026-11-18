import React, { useEffect, useState } from 'react';

// Skeleton layer that sits on top of live content (the map). While `visible` it is opaque;
// when `visible` turns false it fades out and then unmounts, so the shimmer stops animating.
export const OVERLAY_FADE_MS = 500;

export default function SkeletonFadeOverlay({ visible, className = '', children }) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return undefined;
    }
    const t = setTimeout(() => setMounted(false), OVERLAY_FADE_MS);
    return () => clearTimeout(t);
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden={!visible}
      style={{ transitionDuration: `${OVERLAY_FADE_MS}ms` }}
      className={`absolute inset-0 transition-opacity ease-out ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      } ${className}`}
    >
      {children}
    </div>
  );
}
