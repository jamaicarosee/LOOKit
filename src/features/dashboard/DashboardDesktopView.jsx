import React, { useState } from 'react';
import { useDashboardState } from './hooks/useDashboardState';
import DesktopTopNav from './components/desktop/DesktopTopNav';
import DesktopSearchSection from './components/desktop/DesktopSearchSection';
import DesktopFilterRibbon from './components/desktop/DesktopFilterRibbon';
import DesktopCampusHeader from './components/desktop/DesktopCampusHeader';
import CampusMapPreview from './components/CampusMapPreview';

export default function DashboardDesktopView({ onOpenSearch, onLoginClick }) {  const {
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    activeNav,
    setActiveNav,
  } = useDashboardState();

  const [isMapZoomed, setIsMapZoomed] = useState(false);

  return (
    <div className="w-screen h-[100dvh] bg-[#F8F9F9] flex flex-col overflow-hidden">
      {/* 1. Deep Navy Top Header */}
      <DesktopTopNav
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        onProfileClick={onLoginClick}
      />

      {/* 2. White Wide Search Pill Section */}
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

      {/* 4. Full-Height Map Workspace with Floating Animated Header */}
      <div className="relative flex-1 w-full overflow-hidden flex flex-col">
        <DesktopCampusHeader isHidden={isMapZoomed || activeFilter !== 'all'} />

        <CampusMapPreview
          activeFilter={activeFilter}
          isDesktop
          onZoomStateChange={setIsMapZoomed}
        />
      </div>
    </div>
  );
}