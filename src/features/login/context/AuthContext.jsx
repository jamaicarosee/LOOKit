
import React, {
  createContext,
  useContext,
  useEffect,
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
} from '../services/authService';

const AuthContext = createContext(null);

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

    // Keep verified Supabase user identity
    id: user.id,
    email: user.email || backendProfile?.email || '',

    // Prefer existing LOOKit name, otherwise Google name
    full_name:
      backendProfile?.full_name ||
      googleProfile.full_name,

    // Prefer existing LOOKit picture, otherwise Google picture
    avatar_url:
      backendProfile?.avatar_url ||
      googleProfile.avatar_url,

    // Never assign admin privileges from Google metadata
    role: backendProfile?.role || 'user',
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let requestId = 0;

    const applySession = async (currentSession) => {
      const currentRequest = ++requestId;

      if (!currentSession?.user) {
        if (isMounted) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setAuthLoading(false);
        }
        return;
      }

      const currentUser = currentSession.user;

      if (isMounted) {
        setUser(currentUser);
        setSession(currentSession);

        // Display basic Google profile immediately
        setProfile((previous) =>
          mergeProfiles(
            currentUser,
            previous?.id === currentUser.id
              ? previous
              : null
          )
        );
      }

      // Fetch LOOKit backend profile
      try {
        const backendProfile = await verifyAndFetchProfile(
          currentSession.access_token
        );

        if (
          isMounted &&
          currentRequest === requestId
        ) {
          setProfile(
            mergeProfiles(currentUser, backendProfile)
          );
        }
      } catch (error) {
        console.error(
          '[LOOKit Auth] Profile fetch failed:',
          error
        );

        // Google basic profile remains available
        // even when backend profile fetching fails.
      } finally {
        if (
          isMounted &&
          currentRequest === requestId
        ) {
          setAuthLoading(false);
        }
      }
    };

    async function bootstrapSession() {
      try {
        const initialData = await initializeAuthSession();

        if (!isMounted) return;

        if (initialData?.session?.user) {
          const initialSession = initialData.session;

          setUser(initialSession.user);
          setSession(initialSession);

          setProfile(
            mergeProfiles(
              initialSession.user,
              initialData.profile
            )
          );
        } else {
          setUser(null);
          setSession(null);
          setProfile(null);
        }
      } catch (error) {
        console.error(
          '[LOOKit Auth] Failed to initialize session:',
          error
        );
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted) return;

        if (
          event === 'SIGNED_OUT' ||
          (event === 'INITIAL_SESSION' && !currentSession)
        ) {
          requestId++;

          setUser(null);
          setSession(null);
          setProfile(null);
          setAuthLoading(false);
          return;
        }

        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED' ||
          (event === 'INITIAL_SESSION' && currentSession)
        ) {
          // Run asynchronously outside the auth callback
          // to avoid blocking Supabase auth operations.
          setTimeout(() => {
            if (isMounted) {
              applySession(currentSession);
            }
          }, 0);
        }
      }
    );

    return () => {
      isMounted = false;
      requestId++;
      subscription?.unsubscribe();
    };
  }, []);

  // Email/password login
  const login = useCallback(
    async ({ email, password, keepSignedIn }) => {
      const result = await signInUser({
        email,
        password,
        keepSignedIn,
      });

      setUser(result.user);
      setSession(result.session);
      setProfile(
        mergeProfiles(result.user, result.profile)
      );

      return result;
    },
    []
  );

  // Manual registration
  const register = useCallback(
    async ({ fullName, email, password }) => {
      const result = await signUpUser({
        fullName,
        email,
        password,
      });

      if (result.session) {
        setUser(result.user);
        setSession(result.session);
        setProfile(
          mergeProfiles(result.user, result.profile)
        );
      }

      return result;
    },
    []
  );

  // Logout
  const logout = useCallback(async () => {
    await signOutUser();

    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  // Password change completed
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

    isAuthenticated: Boolean(user && session),

    isAdmin:
      !authLoading &&
      Boolean(user && session) &&
      profile?.role === 'admin',

    mustChangePassword:
      Boolean(profile?.must_change_password),

    completePasswordChange,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
}