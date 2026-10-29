import React from 'react';
import { useDashboardState } from './hooks/useDashboardState';
import MobileTopBar from './components/MobileTopBar';
import SearchBar from './components/SearchBar';
import BuildingFilterTabs from './components/BuildingFilterTabs';
import CampusMapPreview from './components/CampusMapPreview';
import MobileBottomSheet from './components/MobileBottomSheet';

<<<<<<< HEAD
export default function DashboardMobileView() {
=======
export default function DashboardMobileView({ onOpenSearch }) {
>>>>>>> 26db5f2 (added search and directions page)
  const {
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
      <MobileTopBar onProfileClick={() => console.log('Profile toggled')} />

      {/* Search Input */}
<<<<<<< HEAD
      <SearchBar value={searchQuery} onChange={setSearchQuery} />
=======
      <SearchBar value={searchQuery} onChange={setSearchQuery} onOpenSearch={onOpenSearch} />
>>>>>>> 26db5f2 (added search and directions page)

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