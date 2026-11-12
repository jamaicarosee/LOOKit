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
import { supabase } from './services/supabaseClient'; 
import ResetPassword from './features/login/components/ResetPassword'; 

// Loaded on demand so normal users never download the admin dashboard
const AdminScreen = lazy(() => import('./features/admin/AdminScreen'));



function AppContent() {
  const { isDesktop } = useViewport(1024);
  const { user, profile, isAuthenticated, isAdmin, authLoading, logout } = useAuth();

  const [screen, setScreen] = useState('dashboard');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [pendingStaff, setPendingStaff] = useState(false);
  const [navTarget, setNavTarget] = useState(null);
  const [navOrigin, setNavOrigin] = useState('dashboard');
  
  // Bagong state para sa Reset Password Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetError, setResetError] = useState(false);

  const openSearch = () => {
    setNavTarget(null);
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

  //PASSWORD_RECOVERY event
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const type = params.get('type');

    if (token && type === 'recovery') {
  
      window.history.replaceState(null, '', window.location.pathname);

      // 2. Verify token
      supabase.auth.verifyOtp({ token_hash: token, type: 'recovery' })
        .then(async ({ error }) => {
          if (error) {
            // Check if there is active session
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
              // Can be back if the 5 mins session is not done
              setShowResetModal(true);
              setShowLoginModal(false);
            } else {
              // Expired or Invalid
              setResetError(true);
              await supabase.auth.signOut(); // Make sure no login happened
            }
          } else {
            // Success for first click
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
    <AdminNavProvider onOpenAdmin={openAdmin} isAdmin={isAdmin}>

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
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                Loading admin dashboard…
              </div>
            }
          >
            <AdminScreen onBackToMap={closeSearch} onProfileClick={openLogin} />
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
              <DashboardDesktopView onOpenSearch={openSearch} onLoginClick={openLogin} />
            </main>
          ) : (
            <main className="w-screen h-[100dvh] bg-slate-900 flex items-center justify-center overflow-hidden">
              <DashboardMobileView onOpenSearch={openSearch} onLoginClick={openLogin} />
            </main>
          )}
        </>
      )}

      {showLoginModal && (
        <LoginModal onClose={closeLogin} loginRequired={loginRequired} />
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

      {/* Pop-up message*/}
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