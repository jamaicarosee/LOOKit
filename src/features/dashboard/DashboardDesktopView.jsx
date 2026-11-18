<<<<<<< HEAD
import React, { useState } from 'react';
=======
import React, { useCallback, useState } from 'react';
>>>>>>> 73e09d3 (added skeletal loading and current location)
import { useDashboardState } from './hooks/useDashboardState';
import DesktopTopNav from './components/desktop/DesktopTopNav';
import DesktopSearchSection from './components/desktop/DesktopSearchSection';
import DesktopFilterRibbon from './components/desktop/DesktopFilterRibbon';
import DesktopCampusHeader from './components/desktop/DesktopCampusHeader';
import CampusMapPreview from './components/CampusMapPreview';
<<<<<<< HEAD

export default function DashboardDesktopView({ onOpenSearch, onLoginClick }) {  const {
=======
import useMinLoading from '../loading/hooks/useMinLoading';
import SkeletonFadeOverlay from '../loading/components/SkeletonFadeOverlay';
import {
  DesktopSearchSkeleton,
  DesktopRibbonSkeleton,
  DesktopMapSkeleton,
} from '../loading/components/DashboardSkeletonParts';

export default function DashboardDesktopView({ onOpenSearch, onLoginClick, onMapReady }) {  const {
>>>>>>> 73e09d3 (added skeletal loading and current location)
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    activeNav,
    setActiveNav,
  } = useDashboardState();

  const [isMapZoomed, setIsMapZoomed] = useState(false);

<<<<<<< HEAD
=======
  // Skeleton for the search bar, filter ribbon and map until the map has painted
  // (at least 600ms, so it never just flashes by when the map is already cached)
  const [mapReady, setMapReady] = useState(false);
  const handleMapReady = useCallback(() => {
    setMapReady(true);
    onMapReady?.();
  }, [onMapReady]);
  const loading = useMinLoading(!mapReady);

>>>>>>> 73e09d3 (added skeletal loading and current location)
  return (
    <div className="w-screen h-[100dvh] bg-[#F8F9F9] flex flex-col overflow-hidden">
      {/* 1. Deep Navy Top Header */}
      <DesktopTopNav
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        onProfileClick={onLoginClick}
      />

      {/* 2. White Wide Search Pill Section */}
<<<<<<< HEAD
      <DesktopSearchSection
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenSearch={onOpenSearch}
      />

      {/* 3. Full-Width Building Filter Ribbon */}
      <DesktopFilterRibbon
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
      />
=======
      {loading ? (
        <DesktopSearchSkeleton />
      ) : (
        <DesktopSearchSection
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenSearch={onOpenSearch}
        />
      )}

      {/* 3. Full-Width Building Filter Ribbon */}
      {loading ? (
        <DesktopRibbonSkeleton />
      ) : (
        <DesktopFilterRibbon
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
        />
      )}
>>>>>>> 73e09d3 (added skeletal loading and current location)

      {/* 4. Full-Height Map Workspace with Floating Animated Header */}
      <div className="relative flex-1 w-full overflow-hidden flex flex-col">
        <DesktopCampusHeader isHidden={isMapZoomed || activeFilter !== 'all'} />

        <CampusMapPreview
          activeFilter={activeFilter}
          isDesktop
          onZoomStateChange={setIsMapZoomed}
<<<<<<< HEAD
        />
=======
          onMapReady={handleMapReady}
        />

        <SkeletonFadeOverlay visible={loading} className="z-40">
          <DesktopMapSkeleton />
        </SkeletonFadeOverlay>
>>>>>>> 73e09d3 (added skeletal loading and current location)
      </div>
    </div>
  );
}