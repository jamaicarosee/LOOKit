import React from 'react';
import SkeletonBlock from './SkeletonBlock';
import { StaffCardSkeleton } from '../../admin/components/AdminSkeletons';

// Staff page placeholders: the search box, and the "Pasig Campus / Staff Directory" heading
// with a section heading and a grid of staff cards. Sizes copy StaffSearchBar and
// StaffDirectoryDesktop / StaffDirectoryMobile.
export function StaffSearchSkeleton({ isDesktop = false }) {
  if (isDesktop) {
    return (
      <section className="w-full bg-white py-4 px-8 shrink-0 z-20">
        <div className="max-w-6xl mx-auto">
          <SkeletonBlock className="w-full h-14 rounded-full" />
        </div>
      </section>
    );
  }
  return (
    <div className="px-5 py-2.5 bg-white shrink-0">
      <SkeletonBlock className="h-9 w-full rounded-full" />
    </div>
  );
}

export function StaffDirectorySkeleton({ isDesktop = false }) {
  const cards = isDesktop ? 8 : 5;

  return (
    <div
      role="status"
      aria-label="Loading staff directory"
      aria-busy="true"
      className="flex-1 min-h-0 w-full overflow-hidden bg-[#F8F9F9]"
    >
      <div className={isDesktop ? 'max-w-6xl mx-auto px-8 lg:px-16 py-8' : 'px-5 py-5'}>
        {/* "Pasig Campus" + "Staff Directory" */}
        <SkeletonBlock className={`${isDesktop ? 'h-6 w-44' : 'h-4 w-28'} rounded`} />
        <SkeletonBlock className={`mt-2 ${isDesktop ? 'h-8 w-72 mb-8' : 'h-6 w-48 mb-6'} rounded`} />

        {/* Section heading */}
        <div className="mb-4 border-l-4 border-[#D4A017] pl-3">
          <SkeletonBlock className={`${isDesktop ? 'h-4 w-56' : 'h-3 w-40'} rounded`} />
        </div>

        <div
          className={
            isDesktop
              ? 'grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5'
              : 'grid grid-cols-1 gap-3'
          }
        >
          {Array.from({ length: cards }, (_, i) => (
            <StaffCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
