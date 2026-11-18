import React from 'react';
import SkeletonBlock from './SkeletonBlock';
import { DesktopNavTabsSkeleton } from './NavSkeletons';
import { DesktopSearchSkeleton, DesktopRibbonSkeleton, DesktopMapSkeleton } from './DashboardSkeletonParts';

// Mirrors DashboardDesktopView: DesktopTopNav, DesktopSearchSection, DesktopFilterRibbon,
// and the map workspace with the floating DesktopCampusHeader + HUD controls.
export default function DashboardDesktopSkeleton() {
  return (
    <div className="w-screen h-[100dvh] bg-[#F8F9F9] flex flex-col overflow-hidden">
      {/* DesktopTopNav */}
      <header className="w-full h-20 bg-[#0B2545] px-8 flex items-center justify-between shrink-0">
        <SkeletonBlock tone="dark" className="h-12 w-40 rounded-md" />
        <DesktopNavTabsSkeleton activeIndex={0} />
        <SkeletonBlock tone="dark" className="w-14 h-11 rounded-full" />
      </header>

      <DesktopSearchSkeleton />
      <DesktopRibbonSkeleton />

      {/* Map workspace */}
      <div className="relative flex-1 w-full overflow-hidden flex flex-col">
        <DesktopMapSkeleton />
      </div>
    </div>
  );
}
