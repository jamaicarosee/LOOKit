import React from 'react';
import SkeletonBlock from './SkeletonBlock';
import { MobileNavTilesSkeleton } from './NavSkeletons';
import { MobileSearchSkeleton, MobileFiltersSkeleton, MobileMapSkeleton } from './DashboardSkeletonParts';

// Mirrors DashboardMobileView: MobileTopBar, SearchBar, BuildingFilterTabs,
// CampusMapPreview (+ floating HUD) and MobileBottomSheet. Wrapper classes and spacing are copied from those components.
export default function DashboardMobileSkeleton() {
  return (
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-white flex flex-col overflow-hidden shadow-2xl">
      {/* MobileTopBar */}
      <header className="flex items-center justify-between px-5 pt-3 pb-2 bg-white shrink-0">
        <SkeletonBlock className="h-8 w-28 rounded-md" />
        <SkeletonBlock className="w-9 h-9 rounded-full" />
      </header>

      <MobileSearchSkeleton />
      <MobileFiltersSkeleton />

      {/* CampusMapPreview */}
      <div className="relative flex-1 w-full h-full bg-[#F8F9F9] overflow-hidden">
        <MobileMapSkeleton />
      </div>

      {/* MobileBottomSheet */}
      <footer className="bg-white pt-4 pb-5 px-6 flex flex-col items-center justify-between border-t border-gray-100 shrink-0">
        <div className="text-center mb-4 flex flex-col items-center">
          <div className="h-7 flex items-center justify-center">
            <SkeletonBlock className="h-[18px] w-60 rounded" />
          </div>
          <div className="h-[16.5px] flex items-center justify-center">
            <SkeletonBlock className="h-2.5 w-24 rounded" />
          </div>
        </div>
        <MobileNavTilesSkeleton />
      </footer>
    </div>
  );
}
