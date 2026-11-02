
import React, { useState } from 'react';
import DashboardMobileView from './features/dashboard/DashboardMobileView';
import DashboardDesktopView from './features/dashboard/DashboardDesktopView';
import NavigationFlow from './features/navigation/NavigationFlow';
import { useViewport } from './features/dashboard/hooks/useViewport';
import LoginModal from './features/login/components/LoginModal';
import AboutPage from './features/about/AboutPage';
import { AboutNavProvider } from './features/about/AboutNavContext';
import AccountInfo from './features/account/AccountInfo';

export default function App() {
  const { isDesktop } = useViewport(1024);

  const [screen, setScreen] = useState('dashboard');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Authentication will be connected to the backend later.
  const [user, setUser] = useState(null);

  const openSearch = () => setScreen('navigation');
  const openAbout = () => setScreen('about');
  const closeSearch = () => setScreen('dashboard');

  const openLogin = () => {
    if (user) {
      setScreen('account');
    } else {
      setShowLoginModal(true);
    }
  };

  const closeLogin = () => setShowLoginModal(false);

  const handleLogout = () => {
    setUser(null);
    setScreen('dashboard');
    setShowLoginModal(false);
  };

  const mainClass = `w-screen h-[100dvh] overflow-hidden ${
    isDesktop
      ? 'bg-[#F8F9F9]'
      : 'bg-slate-900 flex items-center justify-center'
  }`;

  return (
    <AboutNavProvider onOpenAbout={openAbout}>

      {screen === 'about' && (
        <main className={mainClass}>
          <AboutPage
            onBackToMap={closeSearch}
            onProfileClick={openLogin}
          />
        </main>
      )}

      {screen === 'navigation' && (
        <main className={mainClass}>
          <NavigationFlow
            onBackToMap={closeSearch}
            onNavSelect={(id) => {
              if (id === 'map') closeSearch();
            }}
          />
        </main>
      )}

      {screen === 'account' && (
        <main className={mainClass}>
          <AccountInfo
            user={user}
            onBackToMap={closeSearch}
            onLogout={handleLogout}
          />
        </main>
      )}

      {screen === 'dashboard' && (
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
        </>
      )}

      {showLoginModal && (
        <LoginModal onClose={closeLogin} />
      )}

    </AboutNavProvider>
  );
}