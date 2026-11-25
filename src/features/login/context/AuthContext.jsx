import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';

import {
  supabase,
  signInUser,
  signUpUser,
  signOutUser,
  initializeAuthSession,
  verifyAndFetchProfile,
  isGoogleOAuthPending,
  clearGoogleOAuthPending,
  isEmailConfirmPending,
  clearEmailConfirmPending,
  validateGoogleLogin,
} from '../services/authService';

const AuthContext = createContext(null);

const OAUTH_QUERY_KEYS = [
  'code',
  'state',
  'error',
  'error_code',
  'error_description',
  'email_confirmed',
];
const OAUTH_HASH_PATTERN =
  /(?:access_token|refresh_token|provider_token|token_type|expires_in|error|error_description)=|(?:^#|&)type=signup(?:&|$)/i;

function isEmailConfirmationReturn() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash || '';

  if (params.get('type') === 'recovery') return false;

  if (
    params.get('email_confirmed') === 'true' ||
    /(?:^#|&)type=signup(?:&|$)/i.test(hash)
  ) {
    return true;
  }

  const hasAuthCallback =
    params.has('code') || /(?:^#|&)access_token=/i.test(hash);

  // Supabase PKCE email confirmation lands on /?code=... without Google OAuth pending
  if (hasAuthCallback && (!isGoogleOAuthPending() || isEmailConfirmPending())) {
    return true;
  }

  return false;
}

function hasOAuthCallbackInUrl() {
  if (typeof window === 'undefined') return false;
  if (isEmailConfirmationReturn()) return false;
  const hash = window.location.hash || '';
  const params = new URLSearchParams(window.location.search);
  return (
    OAUTH_HASH_PATTERN.test(hash) ||
    params.has('code') ||
    params.has('error')
  );
}

function hasOAuthErrorInUrl() {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const params = new URLSearchParams(window.location.search);
  return params.has('error') || /(?:^#|&)error=/i.test(hash);
}

function cleanOAuthUrl() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const hadQuery =
    OAUTH_QUERY_KEYS.some((key) => url.searchParams.has(key)) ||
    url.searchParams.get('type') === 'signup';
  const hadHash = OAUTH_HASH_PATTERN.test(url.hash);

  if (!hadQuery && !hadHash) return;

  OAUTH_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));

  // Preserve ?type=recovery for password resets, only strip signup type
  if (url.searchParams.get('type') === 'signup') {
    url.searchParams.delete('type');
  }

  const nextHash = hadHash ? '' : url.hash;
  const nextSearch = url.searchParams.toString();
  const cleanPath = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`;

  window.history.replaceState(null, '', cleanPath);
}

// Module-level singleton so React StrictMode double-mounts share one confirmation cleanup
// and delayed SIGNED_IN events from the PKCE exchange can never auto-login the user.
let emailConfirmPromise = null;

function handleEmailConfirmationReturn() {
  if (emailConfirmPromise) {
    return emailConfirmPromise;
  }
  if (!isEmailConfirmationReturn()) {
    return null;
  }

  emailConfirmPromise = (async () => {
    try {
      // Wait for Supabase's detectSessionInUrl PKCE exchange to finish confirming the account
      await supabase.auth.getSession();
    } catch (err) {
      console.warn('[LOOKit Auth] Email confirmation exchange warning:', err);
    }

    try {
      // Immediately clear the local session so the user stays logged out
      await signOutUser({ skipAudit: true });
    } catch (err) {
      console.warn('[LOOKit Auth] Post-confirmation sign-out warning:', err);
    }

    clearEmailConfirmPending();
    clearGoogleOAuthPending();
    cleanOAuthUrl();
    return true;
  })();

  return emailConfirmPromise;
}

// Extract basic Google account information
function getGoogleProfile(user) {
  if (!user) return null;

  const metadata = user.user_metadata || {};

  return {
    id: user.id,
    email: user.email || '',
    full_name:
      metadata.full_name ||
      metadata.name ||
      metadata.display_name ||
      '',
    avatar_url:
      metadata.avatar_url ||
      metadata.picture ||
      '',
  };
}

// Combine LOOKit backend profile and Google profile
function mergeProfiles(user, backendProfile) {
  if (!user) return null;

  const googleProfile = getGoogleProfile(user);

  return {
    ...googleProfile,
    ...(backendProfile || {}),

    id: user.id,
    email: user.email || backendProfile?.email || '',

    full_name:
      backendProfile?.full_name ||
      googleProfile.full_name,

    avatar_url:
      backendProfile?.avatar_url ||
      googleProfile.avatar_url,

    // Never assign admin privileges from Google metadata
    role: backendProfile?.role || 'user',
  };
}

async function resolveFreshSession(fallbackSession) {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data?.session?.access_token) {
      return data.session;
    }
  } catch {
    // Fall back to provided session
  }
  return fallbackSession;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [verifyingGoogle, setVerifyingGoogle] = useState(
    () => isGoogleOAuthPending() || hasOAuthCallbackInUrl()
  );
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [loginEventCount, setLoginEventCount] = useState(0);

  // Prevents bootstrapSession and onAuthStateChange from racing during OAuth / sign-up
  const bootstrappedRef = useRef(false);
  const googleValidationRef = useRef(null);
  const isSigningUpRef = useRef(false);

  const clearAuthError = useCallback(() => setAuthError(''), []);
  const clearAuthNotice = useCallback(() => setAuthNotice(''), []);

  useEffect(() => {
    let isMounted = true;
    let requestId = 0;

    const validatePendingGoogleIfNeeded = async (currentSession) => {
      if (!currentSession?.access_token) {
        return { allowed: true, wasGoogleLogin: false };
      }

      if (googleValidationRef.current) {
        return googleValidationRef.current;
      }

      if (!isGoogleOAuthPending()) {
        if (isMounted) setVerifyingGoogle(false);
        return { allowed: true, wasGoogleLogin: false };
      }

      clearGoogleOAuthPending();

      const checkPromise = (async () => {
        try {
          const freshSession = await resolveFreshSession(currentSession);
          await validateGoogleLogin(freshSession.access_token);
          if (isMounted) setVerifyingGoogle(false);
          return { allowed: true, wasGoogleLogin: true };
        } catch (err) {
          if (isMounted) {
            setUser(null);
            setSession(null);
            setProfile(null);
            setVerifyingGoogle(false);
            setAuthError(err.message || 'Account already exists.');
            setAuthLoading(false);
          }
          return { allowed: false, wasGoogleLogin: true };
        }
      })();

      googleValidationRef.current = checkPromise;
      return checkPromise;
    };

    const applySession = async (currentSession) => {
      if (emailConfirmPromise || isSigningUpRef.current) return;

      const currentRequest = ++requestId;

      if (!currentSession?.user) {
        if (isMounted) {
          setUser(null);
          setSession(null);
          setProfile(null);
          if (!hasOAuthCallbackInUrl()) {
            setVerifyingGoogle(false);
          }
          setAuthLoading(false);
        }
        return;
      }

      const activeSession = await resolveFreshSession(currentSession);
      const activeUser = activeSession?.user || currentSession.user;

      cleanOAuthUrl();

      const { allowed } = await validatePendingGoogleIfNeeded(activeSession);
      if (!allowed || !isMounted || currentRequest !== requestId) return;

      if (isMounted) {
        setUser(activeUser);
        setSession(activeSession);

        setProfile((previous) =>
          mergeProfiles(
            activeUser,
            previous?.id === activeUser.id ? previous : null
          )
        );
      }

      try {
        const backendProfile = await verifyAndFetchProfile(
          activeSession.access_token
        );

        if (isMounted && currentRequest === requestId) {
          setProfile((previous) =>
            mergeProfiles(
              activeUser,
              backendProfile ?? (previous?.id === activeUser.id ? previous : null)
            )
          );
        }
      } catch (error) {
        console.error('[LOOKit Auth] Profile fetch failed:', error);
      } finally {
        if (isMounted && currentRequest === requestId) {
          setAuthLoading(false);
        }
      }
    };

    async function bootstrapSession() {
      try {
        const confirmPromise = handleEmailConfirmationReturn();
        if (confirmPromise) {
          await confirmPromise;

          if (isMounted) {
            setUser(null);
            setSession(null);
            setProfile(null);
            setVerifyingGoogle(false);
            setAuthNotice('Email verified! You may now log in.');
            setAuthLoading(false);
          }
          return;
        }

        const initialData = await initializeAuthSession();

        if (!isMounted) return;

        if (initialData?.session?.user) {
          cleanOAuthUrl();

          const initialSession = await resolveFreshSession(initialData.session);
          const { allowed, wasGoogleLogin } =
            await validatePendingGoogleIfNeeded(initialSession);
          if (!allowed || !isMounted) return;

          setUser(initialSession.user);
          setSession(initialSession);

          setProfile((previous) =>
            mergeProfiles(
              initialSession.user,
              initialData.profile ??
                (previous?.id === initialSession.user.id ? previous : null)
            )
          );

          if (wasGoogleLogin) {
            verifyAndFetchProfile(initialSession.access_token)
              .then((backendProfile) => {
                if (isMounted && backendProfile) {
                  setProfile(mergeProfiles(initialSession.user, backendProfile));
                }
              })
              .catch((err) => {
                console.error(
                  '[LOOKit Auth] Post-Google profile fetch failed:',
                  err
                );
              });
          }
        } else if (hasOAuthErrorInUrl() || !hasOAuthCallbackInUrl()) {
          cleanOAuthUrl();
          clearGoogleOAuthPending();
          googleValidationRef.current = null;
          setVerifyingGoogle(false);
          setUser(null);
          setSession(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('[LOOKit Auth] Failed to initialize session:', error);
        if (isMounted) setVerifyingGoogle(false);
      } finally {
        bootstrappedRef.current = true;
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return;

      // Suppress transient SIGNED_IN events during sign-up or email confirmation cleanup
      if (emailConfirmPromise || isSigningUpRef.current) {
        return;
      }

      if (
        event === 'SIGNED_OUT' ||
        (event === 'INITIAL_SESSION' && !currentSession)
      ) {
        if (event === 'INITIAL_SESSION' && hasOAuthCallbackInUrl()) {
          return;
        }
        requestId++;
        googleValidationRef.current = null;

        setUser(null);
        setSession(null);
        setProfile(null);
        setVerifyingGoogle(false);
        setAuthLoading(false);
        return;
      }

      if (event === 'INITIAL_SESSION' && !bootstrappedRef.current) {
        return;
      }

      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        (event === 'INITIAL_SESSION' && currentSession)
      ) {
        setTimeout(() => {
          if (isMounted) {
            applySession(currentSession);
          }
        }, 0);
      }
    });

    return () => {
      isMounted = false;
      requestId++;
      subscription?.unsubscribe();
    };
  }, []);

  const login = useCallback(async ({ email, password, keepSignedIn }) => {
    emailConfirmPromise = null;
    setAuthError('');
    setAuthNotice('');
    const result = await signInUser({
      email,
      password,
      keepSignedIn,
    });

    setUser(result.user);
    setSession(result.session);
    setProfile(mergeProfiles(result.user, result.profile));
    setLoginEventCount((c) => c + 1);

    return result;
  }, []);

  // Manual registration (never logs the user in automatically)
  const register = useCallback(
    async ({ fullName, email, password }) => {
      emailConfirmPromise = null;
      setAuthError('');
      setAuthNotice('');
      isSigningUpRef.current = true;
      try {
        return await signUpUser({
          fullName,
          email,
          password,
        });
      } finally {
        isSigningUpRef.current = false;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    emailConfirmPromise = null;
    googleValidationRef.current = null;
    setVerifyingGoogle(false);
    await signOutUser();

    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const completePasswordChange = useCallback(() => {
    setProfile((previous) =>
      previous
        ? {
            ...previous,
            must_change_password: false,
          }
        : previous
    );
  }, []);

  const value = {
    user,
    profile,
    session,
    authLoading,
    verifyingGoogle,
    authError,
    clearAuthError,
    authNotice,
    clearAuthNotice,
    loginEventCount,

    isAuthenticated: Boolean(user && session),

    isAdmin:
      !authLoading &&
      Boolean(user && session) &&
      profile?.role === 'admin',

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