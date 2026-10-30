import React, { useState } from 'react';
import DashboardMobileView from './features/dashboard/DashboardMobileView';
import DashboardDesktopView from './features/dashboard/DashboardDesktopView';
import NavigationFlow from './features/navigation/NavigationFlow';
import { useViewport } from './features/dashboard/hooks/useViewport';
import LoginModal from './features/login/components/LoginModal';

export default function App() {
  const { isDesktop } = useViewport(1024);

  const [screen, setScreen] = useState('dashboard');
  const [showLoginModal, setShowLoginModal] = useState(false);

  const openSearch = () => setScreen('navigation');
  const closeSearch = () => setScreen('dashboard');

  const openLogin = () => setShowLoginModal(true);
  const closeLogin = () => setShowLoginModal(false);

  if (screen === 'navigation') {
    return (
      <main
        className={`w-screen h-[100dvh] overflow-hidden ${
          isDesktop
            ? 'bg-[#F8F9F9]'
            : 'bg-slate-900 flex items-center justify-center'
        }`}
      >
        <NavigationFlow
          onBackToMap={closeSearch}
          onNavSelect={(id) => id === 'map' && closeSearch()}
        />
      </main>
    );
  }

  return (
    <>
      {isDesktop ? (
        <main className="w-screen h-[100dvh] bg-[#F8F9F9] overflow-hidden">
          <DashboardDesktopView
            onOpenSearch={openSearch}
            onLoginClick={openLogin}
          />
        </main>
      ) : (
        <main className="w-screen h-[100dvh] bg-slate-900 flex items-center justify-center overflow-hidden">
          <DashboardMobileView
            onOpenSearch={openSearch}
            onLoginClick={openLogin}
          />
        </main>
      )}

      {showLoginModal && (
        <LoginModal onClose={closeLogin} />
      )}
    </>
  );
}