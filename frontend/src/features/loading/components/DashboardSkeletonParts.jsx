import React from 'react';
import SkeletonBlock from './SkeletonBlock';

// Building blocks of the Map (dashboard) page, shared by the launch skeleton and by the
// in-page skeleton that shows whenever the map screen is opened again.

// ---- Desktop ----
export function DesktopSearchSkeleton() {
  return (
    <section className="w-full bg-white py-4 px-8 shrink-0">
      <div className="max-w-6xl mx-auto">
        <SkeletonBlock className="w-full h-14 rounded-full" />
      </div>
    </section>
  );
}

export function DesktopRibbonSkeleton() {
  return (
    <section className="w-full bg-[#0B2545] py-3.5 px-8 shrink-0">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonBlock key={i} tone="dark" className="flex-1 h-9 rounded-xl" />
        ))}
      </div>
    </section>
  );
}

// Fills a `relative` container: map canvas, floating campus title and the HUD buttons
export function DesktopMapSkeleton() {
  return (
    <>
      <div className="absolute inset-0 bg-[#F8F9F9]" />

      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 w-full max-w-3xl px-8 flex flex-col items-center">
        <div className="h-10 flex items-center justify-center w-full">
          <SkeletonBlock className="h-8 w-[36rem] max-w-full rounded-md" />
        </div>
        <div className="h-7 mt-1 flex items-center justify-center">
          <SkeletonBlock className="h-4 w-40 rounded" />
        </div>
      </div>

      <div className="absolute z-30 flex flex-col top-6 right-8 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="w-9 h-9 rounded-md" />
        ))}
      </div>
    </>
  );
}

// ---- Phone ----
const FILTER_PILL_WIDTHS = ['w-12', 'w-[68px]', 'w-[58px]', 'w-[58px]', 'w-[68px]', 'w-[76px]'];

export function MobileSearchSkeleton() {
  return (
    <div className="px-5 py-2.5 bg-white shrink-0">
      <SkeletonBlock className="h-9 w-full rounded-full" />
    </div>
  );
}

export function MobileFiltersSkeleton() {
  return (
    <div className="bg-[#0B2545] px-4 py-2.5 shrink-0 shadow-sm">
      <div className="flex items-center gap-2 overflow-hidden">
        {FILTER_PILL_WIDTHS.map((width, i) => (
          <SkeletonBlock key={i} tone="dark" className={`h-[27px] ${width} rounded-full shrink-0`} />
        ))}
      </div>
    </div>
  );
}

// Fills a `relative` container: map canvas and the HUD buttons
export function MobileMapSkeleton() {
  return (
    <>
      <div className="absolute inset-0 bg-[#F8F9F9]" />
      <div className="absolute z-30 flex flex-col top-3 right-3 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="w-8 h-8 rounded-md" />
        ))}
      </div>
    </>
  );
}
