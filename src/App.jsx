import React, { useState } from 'react';
import DashboardMobileView from './features/dashboard/DashboardMobileView';
import DashboardDesktopView from './features/dashboard/DashboardDesktopView';
import NavigationFlow from './features/navigation/NavigationFlow';
import { useViewport } from './features/dashboard/hooks/useViewport';
import LoginModal from './features/login/components/LoginModal';
import AboutPage from './features/about/AboutPage';
import { AboutNavProvider } from './features/about/AboutNavContext';
import AccountInfo from './features/account/AccountInfo';
import { AuthProvider, useAuth } from './features/login/context/AuthContext';

function AppContent() {
  const { isDesktop } = useViewport(1024);
  const { user, profile, isAuthenticated, logout } = useAuth();

  const [screen, setScreen] = useState('dashboard');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);

  const openSearch = () => setScreen('navigation');
  const openAbout = () => setScreen('about');
  const closeSearch = () => setScreen('dashboard');

  const openLogin = () => {
    if (isAuthenticated) {
      setScreen('account');
    } else {
      setLoginRequired(false);
      setShowLoginModal(true);
    }
  };

  const closeLogin = () => {
    setShowLoginModal(false);
    setLoginRequired(false);
  };

  // Guest must log in before navigation.
  const requireLogin = () => {
    if (!isAuthenticated) {
      setLoginRequired(true);
      setShowLoginModal(true);
      return false;
    }

    return true;
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('[LOOKit Auth] Logout error:', err);
    } finally {
      setScreen('dashboard');
      setShowLoginModal(false);
      setLoginRequired(false);
    }
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
            onProfileClick={openLogin}
            isAuthenticated={isAuthenticated}
            requireLogin={requireLogin}
          />
        </main>
      )}

      {screen === 'account' && isAuthenticated && (
        <main className={mainClass}>
          <AccountInfo
            user={user}
            profile={profile}
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
        <LoginModal
          onClose={closeLogin}
          loginRequired={loginRequired}
        />
      )}

    </AboutNavProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}