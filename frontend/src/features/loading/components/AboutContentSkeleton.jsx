import React from 'react';
import SkeletonBlock from './SkeletonBlock';
import { KEY_FEATURES } from '../../about/aboutContent';

// About page placeholders: intro card, Key Features list, Other Information accordion rows
// and the footer. Spacing and the lg: sizes copy the real components.
export default function AboutContentSkeleton() {
  return (
    <div role="status" aria-label="Loading about page" aria-busy="true" className="space-y-5 lg:space-y-8">
      {/* AboutIntroCard */}
      <section className="rounded-2xl bg-[#E5EEF7] px-4 py-4 lg:px-8 lg:py-7">
        <div className="flex items-center gap-2 lg:gap-3">
          <SkeletonBlock tone="lightInner" className="w-4 h-4 lg:w-6 lg:h-6 rounded" />
          <SkeletonBlock tone="lightInner" className="h-4 lg:h-6 w-36 lg:w-48 rounded" />
        </div>
        <div className="mt-3 lg:mt-5 space-y-2 lg:space-y-3">
          <SkeletonBlock tone="lightInner" className="h-3 lg:h-4 w-full rounded" />
          <SkeletonBlock tone="lightInner" className="h-3 lg:h-4 w-full rounded" />
          <SkeletonBlock tone="lightInner" className="h-3 lg:h-4 w-11/12 rounded" />
          <SkeletonBlock tone="lightInner" className="h-3 lg:h-4 w-2/3 rounded" />
        </div>
      </section>

      {/* KeyFeatures */}
      <section>
        <SkeletonBlock className="h-4 lg:h-6 w-28 lg:w-40 rounded mb-2 lg:mb-4" />
        <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {KEY_FEATURES.map(({ id }) => (
            <li key={id} className="flex items-center gap-3 lg:gap-5 px-4 py-3 lg:px-7 lg:py-6">
              <SkeletonBlock className="w-4 h-4 lg:w-7 lg:h-7 shrink-0 rounded" />
              <div className="min-w-0 flex-1 space-y-1.5 lg:space-y-2">
                <SkeletonBlock className="h-3 lg:h-5 w-1/2 rounded" />
                <SkeletonBlock className="h-2.5 lg:h-3.5 w-3/4 rounded" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* OtherInformation */}
      <section>
        <SkeletonBlock className="h-4 lg:h-6 w-36 lg:w-52 rounded mb-2 lg:mb-4" />
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className={i < 2 ? 'border-b border-slate-200' : ''}>
              <div className="flex items-center gap-3 lg:gap-5 px-4 py-3.5 lg:px-7 lg:py-6">
                <SkeletonBlock className="w-4 h-4 lg:w-6 lg:h-6 shrink-0 rounded" />
                <SkeletonBlock className="h-3.5 lg:h-5 flex-1 max-w-[12rem] rounded" />
                <div className="flex-1" />
                <SkeletonBlock className="w-4 h-4 lg:w-6 lg:h-6 shrink-0 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AboutFooter */}
      <div className="flex flex-col items-center gap-1.5 pt-2 pb-1">
        <SkeletonBlock className="h-2.5 lg:h-3 w-64 max-w-full rounded" />
        <SkeletonBlock className="h-2.5 lg:h-3 w-44 rounded" />
      </div>
    </div>
  );
}
