import React, { Component, lazy, Suspense, useEffect, useState } from 'react';
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
import { supabase } from './services/supabaseClient';
import ResetPassword from './features/login/components/ResetPassword';
import LaunchOverlay from './features/loading/LaunchOverlay';
import AdminScreenSkeleton from './features/admin/components/AdminScreenSkeleton';
import { useLaunchSequence } from './features/loading/hooks/useLaunchSequence';
import OfflineBanner from './features/offline/components/OfflineBanner';
import UpdateToast from './features/offline/components/UpdateToast';

// Loaded on demand so normal users never download the admin dashboard
const AdminScreen = lazy(() => import('./features/admin/AdminScreen'));

function AppContent() {
  const { isDesktop } = useViewport(1024);
  const {
    user,
    profile,
    isAuthenticated,
    isAdmin,
    authLoading,
    verifyingGoogle,
    authError,
    clearAuthError,
    authNotice,
    clearAuthNotice,
    loginEventCount,
    logout,
  } = useAuth();
  const { phase: launchPhase, markMapLoaded, replayLaunch, cancelLaunch } =
    useLaunchSequence({ holdSplash: verifyingGoogle });

  const [screen, setScreen] = useState('dashboard');
  const [previousScreen, setPreviousScreen] = useState('dashboard');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [pendingStaff, setPendingStaff] = useState(false);
  const [navTarget, setNavTarget] = useState(null);
  const [navOrigin, setNavOrigin] = useState('dashboard');
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  // Reset Password Modal states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetError, setResetError] = useState(false);

  const openSearch = () => {
    setNavTarget(null);
    setNavOrigin('dashboard');
    setScreen('navigation');
  };
  const selectDestination = (location) => {
    setNavTarget(location);
    setNavOrigin('dashboard');
    setScreen('navigation');
  };
  const openAbout = () => setScreen('about');
  const openAdmin = () => {
    if (authLoading || !isAdmin) return;
    setScreen('admin');
  };
  const closeSearch = () => setScreen('dashboard');
  const closeNavigation = () => setScreen(navOrigin);

  const openLogin = () => {
    if (isAuthenticated) {
      setPreviousScreen(screen);
      setScreen('account');
    } else {
      setLoginRequired(false);
      setShowLoginModal(true);
    }
  };

  const closeLogin = () => {
    setShowLoginModal(false);
    setLoginRequired(false);
    clearAuthError();
    clearAuthNotice();
  };

  const requireLogin = () => {
    if (!isAuthenticated) {
      setLoginRequired(true);
      setShowLoginModal(true);
      return false;
    }
    return true;
  };

  const openStaff = () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setPendingStaff(true);
      requireLogin();
      return;
    }
    setScreen('staff');
  };

  const openRouteTo = (location) => {
    setNavTarget(location);
    setNavOrigin('staff');
    setScreen('navigation');
  };

  // Immediately dismiss any launch overlay and show LoginModal on auth/validation errors
  useEffect(() => {
    if (authError) {
      cancelLaunch();
      setShowLoginModal(true);
    }
  }, [authError, cancelLaunch]);

  // Open LoginModal with verification notice after returning from email confirmation
  useEffect(() => {
    if (authNotice) {
      cancelLaunch();
      setShowLoginModal(true);
    }
  }, [authNotice, cancelLaunch]);

  // Replay LOOKit loading logo screen & refresh dashboard on every successful login
  useEffect(() => {
    if (loginEventCount === 0) return;
    setShowLoginModal(false);
    setLoginRequired(false);
    setScreen('dashboard');
    setDashboardRefreshKey((k) => k + 1);
    replayLaunch();
  }, [loginEventCount, replayLaunch]);

  // PASSWORD_RECOVERY event
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const type = params.get('type');

    if (token && type === 'recovery') {
      window.history.replaceState(null, '', window.location.pathname);

      supabase.auth.verifyOtp({ token_hash: token, type: 'recovery' })
        .then(async ({ error }) => {
          if (error) {
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
              setShowResetModal(true);
              setShowLoginModal(false);
            } else {
              setResetError(true);
              await supabase.auth.signOut();
            }
          } else {
            setShowResetModal(true);
            setShowLoginModal(false);
          }
        });
    }
  }, []);

  useEffect(() => {
    if (!pendingStaff || showLoginModal) return;
    if (isAuthenticated) setScreen('staff');
    setPendingStaff(false);
  }, [pendingStaff, showLoginModal, isAuthenticated]);

  useEffect(() => {
    if (screen === 'staff' && !authLoading && !isAuthenticated) setScreen('dashboard');
  }, [screen, authLoading, isAuthenticated]);

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
    <AdminNavProvider onOpenAdmin={openAdmin} isAdmin={isAdmin} authLoading={authLoading}>

      {screen === 'about' && (
        <main className={mainClass}>
          <AboutPage onBackToMap={closeSearch} onProfileClick={openLogin} />
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
          <Suspense fallback={<AdminScreenSkeleton isDesktop={isDesktop} onProfileClick={openLogin} />}>
            <AdminScreen onBackToMap={closeSearch} onProfileClick={openLogin} />
          </Suspense>
        </main>
      )}

      {screen === 'account' && isAuthenticated && (
        <main className={mainClass}>
          <AccountInfo
            user={user}
            profile={profile}
            onBackToMap={() => setScreen(previousScreen)}
            onLogout={handleLogout}
          />
        </main>
      )}

      {screen === 'dashboard' && (
        <>
          {isDesktop ? (
            <main className="w-screen h-[100dvh] bg-[#F8F9F9] overflow-hidden">
              <DashboardDesktopView
                key={dashboardRefreshKey}
                onOpenSearch={openSearch}
                onSelectDestination={selectDestination}
                onLoginClick={openLogin}
                onMapReady={markMapLoaded}
              />
            </main>
          ) : (
            <main className="w-screen h-[100dvh] bg-slate-900 flex items-center justify-center overflow-hidden">
              <DashboardMobileView
                key={dashboardRefreshKey}
                onOpenSearch={openSearch}
                onSelectDestination={selectDestination}
                onLoginClick={openLogin}
                onMapReady={markMapLoaded}
              />
            </main>
          )}
        </>
      )}

      {showLoginModal && (
        <LoginModal
          onClose={closeLogin}
          loginRequired={loginRequired}
          initialError={authError}
          initialNotice={authNotice}
        />
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <ResetPassword
          onClose={async () => {
            setShowResetModal(false);
            await supabase.auth.signOut(); // SECURITY: No ghost logins
          }}
          onBackToLogin={async () => {
            setShowResetModal(false);
            await supabase.auth.signOut(); // SECURITY: No ghost logins
            openLogin();
          }}
        />
      )}

      {/* Pop-up message */}
      {resetError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#102747]/60 px-3">
          <div className="w-full max-w-[400px] rounded-[20px] bg-white p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-red-100">
              <span className="text-[30px] font-bold text-red-600">!</span>
            </div>
            <h3 className="mb-2 text-[19px] font-bold text-[#102747]">Expired reset password</h3>
            <p className="mb-6 text-[14px] text-[#61738A]">This reset link has expired or is invalid. Please request a new one.</p>
            <button
              type="button"
              onClick={() => setResetError(false)}
              className="h-[50px] w-full rounded-[10px] bg-[#102747] text-[14px] font-bold text-white transition hover:bg-[#1B3A5E]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Launch splash -> skeleton -> map reveal */}
      <LaunchOverlay phase={launchPhase} isDesktop={isDesktop} isAdmin={isAdmin} />

      {/* Offline status indicator & Service Worker update prompt */}
      <OfflineBanner />
      <UpdateToast />

    </AdminNavProvider>
    </StaffNavProvider>
    </AboutNavProvider>
  );
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[LOOKit] Unhandled application error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[100dvh] w-screen items-center justify-center bg-[#F8F9F9] px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg">
            <h1 className="text-xl font-bold text-[#0B2545]">Something went wrong</h1>
            <p className="mt-2 text-sm text-[#61738A]">
              LOOKit ran into an unexpected error. Reload the page to continue.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 h-11 w-full rounded-xl bg-[#0B2545] text-sm font-bold text-white hover:bg-[#1B3A5E]"
            >
              Reload LOOKit
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AppErrorBoundary>
  );
}