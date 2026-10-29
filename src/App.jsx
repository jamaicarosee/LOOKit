import React, { useState } from 'react';
import DashboardMobileView from './features/dashboard/DashboardMobileView';
import DashboardDesktopView from './features/dashboard/DashboardDesktopView';
import NavigationFlow from './features/navigation/NavigationFlow';
import { useViewport } from './features/dashboard/hooks/useViewport';

export default function App() {
  const { isDesktop } = useViewport(1024);
  // 'dashboard' -> tap the search bar -> 'navigation' (Search page, then Directions page)
  const [screen, setScreen] = useState('dashboard');
  const openSearch = () => setScreen('navigation');
  const closeSearch = () => setScreen('dashboard');

  // Search / Directions: full-width like the dashboard on desktop, phone column on small screens
  if (screen === 'navigation') {
    return (
      <main
        className={`w-screen h-[100dvh] overflow-hidden ${
          isDesktop ? 'bg-[#F8F9F9]' : 'bg-slate-900 flex items-center justify-center'
        }`}
      >
        <NavigationFlow
          onBackToMap={closeSearch}
          onNavSelect={(id) => id === 'map' && closeSearch()}
        />
      </main>
    );
  }

  if (isDesktop) {
    return (
      <main className="w-screen h-[100dvh] bg-[#F8F9F9] overflow-hidden">
        <DashboardDesktopView onOpenSearch={openSearch} />
      </main>
    );
  }

  return (
    <main className="w-screen h-[100dvh] bg-slate-900 flex items-center justify-center overflow-hidden">
      <DashboardMobileView onOpenSearch={openSearch} />
    </main>
  );
}
