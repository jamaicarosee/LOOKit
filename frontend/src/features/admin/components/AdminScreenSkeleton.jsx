import React from 'react';
import DesktopTopNav from '../../dashboard/components/desktop/DesktopTopNav';
import MobileTopBar from '../../dashboard/components/MobileTopBar';
import MobileBottomSheet from '../../dashboard/components/MobileBottomSheet';
import SkeletonBlock from '../../loading/components/SkeletonBlock';
import { AdminTabsSkeleton, OverviewSkeleton } from './AdminSkeletons';

// Shown while the lazy admin chunk downloads. Same frame as AdminScreen: the real nav (it is
// already in the main bundle), a placeholder for the back button + title, the tab band and the Overview body.
export default function AdminScreenSkeleton({ isDesktop, onProfileClick }) {
  const header = (
    <>
      <SkeletonBlock className="w-10 h-10 shrink-0 rounded-full" />
      <SkeletonBlock className="h-6 w-24 rounded" />
    </>
  );

  if (isDesktop) {
    return (
      <div className="w-screen h-[100dvh] bg-white flex flex-col overflow-hidden">
        <DesktopTopNav activeNav="admin" setActiveNav={() => {}} onProfileClick={onProfileClick} />
        <div className="shrink-0 bg-white px-8 lg:px-16 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-4">{header}</div>
        </div>
        <section className="w-full bg-[#0B2545] py-3.5 px-8 shrink-0">
          <AdminTabsSkeleton desktop />
        </section>
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="max-w-6xl mx-auto px-8 lg:px-16 py-6">
            <OverviewSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-white flex flex-col overflow-hidden shadow-2xl">
      <MobileTopBar onProfileClick={onProfileClick} />
      <div className="flex items-center gap-3 px-5 pt-1 pb-3 shrink-0">{header}</div>
      <div className="bg-[#0B2545] px-4 py-2.5 shrink-0 shadow-sm">
        <AdminTabsSkeleton desktop={false} />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden bg-[#F8F9F9] px-5 py-5">
        <OverviewSkeleton />
      </div>
      <MobileBottomSheet activeNav="admin" onSelectNav={() => {}} />
    </div>
  );
}
