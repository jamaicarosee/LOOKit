import React from 'react';
import { useDashboardState } from './hooks/useDashboardState';
import MobileTopBar from './components/MobileTopBar';
import SearchBar from './components/SearchBar';
import BuildingFilterTabs from './components/BuildingFilterTabs';
import CampusMapPreview from './components/CampusMapPreview';
import MobileBottomSheet from './components/MobileBottomSheet';

export default function DashboardMobileView({ onOpenSearch, onLoginClick }) {  const {
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    activeNav,
    setActiveNav,
  } = useDashboardState();

  return (
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-white flex flex-col overflow-hidden shadow-2xl">
      {/* Header with Logo & Profile */}
      <MobileTopBar onProfileClick={onLoginClick} />

      {/* Search Input */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} onOpenSearch={onOpenSearch} />

      {/* Dark Navy Building Filter Tabs */}
      <BuildingFilterTabs
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
      />

      {/* 4. Live Vector Mapbox Canvas */}
      <CampusMapPreview activeFilter={activeFilter} />

      {/* 5. Campus Title & Navigation Dock */}
      <MobileBottomSheet activeNav={activeNav} onSelectNav={setActiveNav} />
    </div>
  );
}