import React, { lazy, Suspense, useEffect, useState } from 'react';
import DashboardMobileView from './features/dashboard/DashboardMobileView';
import DashboardDesktopView from './features/dashboard/DashboardDesktopView';
import NavigationFlow from './features/navigation/NavigationFlow';
import { useViewport } from './features/dashboard/hooks/useViewport';
import LoginModal from './features/login/components/LoginModal';
import AboutPage from './features/about/AboutPage';
import { AboutNavProvider } from './features/about/AboutNavContext';
import AccountInfo from './features/account/AccountInfo';
import { AuthProvider, useAuth } from './features/login/context/AuthContext';
import StaffScreen from './features/staff/StaffScreen';
import { StaffNavProvider } from './features/staff/StaffNavContext';
import { AdminNavProvider } from './features/admin/AdminNavContext';

// Loaded on demand so normal users never download the admin dashboard
const AdminScreen = lazy(() => import('./features/admin/AdminScreen'));

function AppContent() {
  const { isDesktop } = useViewport(1024);
  const { user, profile, isAuthenticated, isAdmin, authLoading, logout } = useAuth();

  const [screen, setScreen] = useState('dashboard');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [pendingStaff, setPendingStaff] = useState(false); // guest clicked Staff, waiting for login
  const [navTarget, setNavTarget] = useState(null); // destination pre-filled in Directions (from Staff)
  const [navOrigin, setNavOrigin] = useState('dashboard'); // where Directions' back button returns to

  const openSearch = () => {
    setNavTarget(null);
    setNavOrigin('dashboard');
    setScreen('navigation');
  };
  const openAbout = () => setScreen('about');
  // Admin button is only shown to admins; this re-checks so a stale click can't open it
  const openAdmin = () => {
    if (authLoading || !isAdmin) return;
    setScreen('admin');
  };
  const closeSearch = () => setScreen('dashboard');
  const closeNavigation = () => setScreen(navOrigin);

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

  // Staff Directory: guests must log in first (same login modal as navigation)
  const openStaff = () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setPendingStaff(true);
      requireLogin();
      return;
    }
    setScreen('staff');
  };

  // Staff -> "Show path": open Directions with the office already filled in as the destination
  const openRouteTo = (location) => {
    setNavTarget(location);
    setNavOrigin('staff');
    setScreen('navigation');
  };

  // After the login modal closes: go to Staff if they logged in, otherwise forget the request
  useEffect(() => {
    if (!pendingStaff || showLoginModal) return;
    if (isAuthenticated) setScreen('staff');
    setPendingStaff(false);
  }, [pendingStaff, showLoginModal, isAuthenticated]);

  // Logged out while on the Staff page (e.g. session ended): back to the map
  useEffect(() => {
    if (screen === 'staff' && !authLoading && !isAuthenticated) setScreen('dashboard');
  }, [screen, authLoading, isAuthenticated]);

  // Not an admin (logged out, role removed, tampering): back to the map
  useEffect(() => {
    if (screen === 'admin' && !authLoading && !isAdmin) setScreen('dashboard');
  }, [screen, authLoading, isAdmin]);

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
    <StaffNavProvider onOpenStaff={openStaff}>
    <AdminNavProvider onOpenAdmin={openAdmin} isAdmin={isAdmin}>

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
            key={navTarget?.id || 'blank'}
            initialTo={navTarget}
            onBackToMap={closeNavigation}
            onNavSelect={(id) => {
              if (id === 'map') closeSearch();
            }}
            onProfileClick={openLogin}
            isAuthenticated={isAuthenticated}
            requireLogin={requireLogin}
          />
        </main>
      )}

      {screen === 'staff' && isAuthenticated && (
        <main className={mainClass}>
          <StaffScreen
            onBackToMap={closeSearch}
            onProfileClick={openLogin}
            onShowPath={openRouteTo}
          />
        </main>
      )}

      {screen === 'admin' && isAdmin && (
        <main className={mainClass}>
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                Loading admin dashboard…
              </div>
            }
          >
<<<<<<< HEAD
<<<<<<< HEAD
            <AdminScreen onBackToMap={closeSearch} />
=======
            <AdminScreen onBackToMap={closeSearch} onProfileClick={openLogin} />
>>>>>>> bc9a15c (admin dashboard improved interface)
=======
            <AdminScreen onBackToMap={closeSearch} onProfileClick={openLogin} />
>>>>>>> fb8d2b8 (updated admin dashboard)
          </Suspense>
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

    </AdminNavProvider>
    </StaffNavProvider>
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