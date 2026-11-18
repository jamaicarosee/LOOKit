import React from 'react';
import MobileTopBar from '../dashboard/components/MobileTopBar';
import DesktopTopNav from '../dashboard/components/desktop/DesktopTopNav';
import SearchBottomNav from '../search/components/SearchBottomNav';

// Page frame shared by Search and Directions.
// Desktop: same full-width frame as the dashboard (navy top nav + full-width workspace).
// Phone / tablet: the original phone column (top bar, scrolling content, bottom dock).
export default function ScreenShell({ isDesktop, onNavSelect, onProfileClick, children }) {
  if (isDesktop) {
    return (
      <div className="w-screen h-[100dvh] bg-[#F8F9F9] flex flex-col overflow-hidden">
        <DesktopTopNav activeNav="map" setActiveNav={onNavSelect} onProfileClick={onProfileClick} />
        {children}
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] max-w-md mx-auto bg-white flex flex-col overflow-hidden shadow-2xl">
      <MobileTopBar onProfileClick={onProfileClick} />
      {children}
      <SearchBottomNav onSelectNav={onNavSelect} />
    </div>
  );
}
