import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  supabase,
  signInUser,
  signUpUser,
  signOutUser,
  initializeAuthSession,
  verifyAndFetchProfile,
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      try {
        const initialData = await initializeAuthSession();
        if (isMounted) {
          setUser(initialData.user);
          setSession(initialData.session);
          setProfile(initialData.profile);
        }
      } catch (err) {
        console.error('[LOOKit Auth] Failed to initialize session:', err);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    }

    bootstrapSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        if (event === 'SIGNED_OUT' || !currentSession) {
          setUser(null);
          setSession(null);
          setProfile(null);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setUser(currentSession.user);
          setSession(currentSession);

          const backendProfile = await verifyAndFetchProfile(
            currentSession.access_token
          );

          if (isMounted) {
            setProfile((prev) =>
              backendProfile ||
              (prev?.id === currentSession.user.id && prev) || {
                id: currentSession.user.id,
                email: currentSession.user.email,
                full_name: currentSession.user.user_metadata?.full_name || '',
              }
            );
          }
        }
      }
    );

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = useCallback(async ({ email, password, keepSignedIn }) => {
    const result = await signInUser({ email, password, keepSignedIn });
    setUser(result.user);
    setSession(result.session);
    setProfile(result.profile);
    return result;
  }, []);

  const register = useCallback(async ({ fullName, email, password }) => {
    const result = await signUpUser({ fullName, email, password });
    if (result.session) {
      setUser(result.user);
      setSession(result.session);
      setProfile(result.profile);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await signOutUser();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  // Updates the profile flag in local state once the password is changed
  const completePasswordChange = useCallback(() => {
    setProfile((prev) => (prev ? { ...prev, must_change_password: false } : prev));
  }, []);

  const value = {
    user,
    profile,
    session,
    authLoading,
    isAuthenticated: Boolean(user && session),
    isAdmin: !authLoading && Boolean(user && session) && profile?.role === 'admin',
    mustChangePassword: Boolean(profile?.must_change_password),
    completePasswordChange,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}