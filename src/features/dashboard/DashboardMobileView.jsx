import React, { useCallback, useState } from 'react';
import { useDashboardState } from './hooks/useDashboardState';
import MobileTopBar from './components/MobileTopBar';
import SearchBar from './components/SearchBar';
import BuildingFilterTabs from './components/BuildingFilterTabs';
import CampusMapPreview from './components/CampusMapPreview';
import MobileBottomSheet from './components/MobileBottomSheet';
import useMinLoading from '../loading/hooks/useMinLoading';
import SkeletonFadeOverlay from '../loading/components/SkeletonFadeOverlay';
import {
  MobileSearchSkeleton,
  MobileFiltersSkeleton,
  MobileMapSkeleton,
} from '../loading/components/DashboardSkeletonParts';

export default function DashboardMobileView({
  onOpenSearch,
  onSelectDestination,
  onLoginClick,
  onMapReady,
}) {
  const {
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    activeNav,
    setActiveNav,
  } = useDashboardState();

  // Skeleton for the search bar, filters and map until the map has painted (min 600ms)
  const [mapReady, setMapReady] = useState(false);
  const handleMapReady = useCallback(() => {
    setMapReady(true);
    onMapReady?.();
  }, [onMapReady]);
  const loading = useMinLoading(!mapReady);

  return (
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-white flex flex-col overflow-hidden shadow-2xl">
      {/* Header with Logo & Profile */}
      <MobileTopBar onProfileClick={onLoginClick} />

      {/* Search Input */}
      {loading ? (
        <MobileSearchSkeleton />
      ) : (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onOpenSearch={onOpenSearch}
          onSelectDestination={onSelectDestination}
        />
      )}

      {/* Dark Navy Building Filter Tabs */}
      {loading ? (
        <MobileFiltersSkeleton />
      ) : (
        <BuildingFilterTabs
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
        />
      )}

      {/* 4. Live Vector Mapbox Canvas */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <CampusMapPreview activeFilter={activeFilter} onMapReady={handleMapReady} />
        <SkeletonFadeOverlay visible={loading} className="z-40">
          <MobileMapSkeleton />
        </SkeletonFadeOverlay>
      </div>

      {/* 5. Campus Title & Navigation Dock */}
      <MobileBottomSheet activeNav={activeNav} onSelectNav={setActiveNav} />
    </div>
  );
}
