import React from 'react';

// Shimmering placeholder. `tone` picks the base + sheen colors for the surface it sits on:
//   light  -> on white surfaces (search bar, header, nav card)
//   dark   -> on the navy surfaces (filter tabs, desktop top nav / ribbon)
//   canvas -> on the #F8F9F9 map canvas
const TONES = {
  light: { base: 'bg-[#E5EEF7]', sheen: 'via-white/70' },
  dark: { base: 'bg-white/10', sheen: 'via-white/15' },
  canvas: { base: 'bg-[#F8F9F9]', sheen: 'via-[#E5EEF7]/70' },
  // Small shapes drawn inside another skeleton block (icon / label placeholders)
  darkInner: { base: 'bg-white/20', sheen: 'via-white/25' },
  lightInner: { base: 'bg-[#C9D8E8]', sheen: 'via-white/60' },
};

export default function SkeletonBlock({ className = '', tone = 'light', children = null }) {
  const { base, sheen } = TONES[tone] || TONES.light;

  return (
    <div aria-hidden="true" className={`relative overflow-hidden ${base} ${className}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-r from-transparent ${sheen} to-transparent animate-shimmer motion-reduce:hidden`}
      />
      {children}
    </div>
  );
}
