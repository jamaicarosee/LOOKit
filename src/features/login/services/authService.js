import { supabase } from '../../../services/supabaseClient';
import { apiClient } from '../../../services/apiClient';

const KEEP_SIGNED_IN_KEY = 'lookit_keep_signed_in';
const SESSION_ACTIVE_KEY = 'lookit_browser_session_active';

/**
 * Verifies the Supabase JWT access token against FastAPI GET /api/auth/me
 * and returns the user profile from public.users.
 */
export async function verifyAndFetchProfile(accessToken) {
  if (!accessToken) return null;

  try {
    const response = await apiClient.get('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.data && !('role' in response.data)) {
      console.warn(
        "[LOOKit Auth] /api/auth/me returned no 'role' field. The backend must include public.users.role, otherwise the Admin button never appears."
      );
    }

    return response.data;
  } catch (error) {
    console.warn(
      '[LOOKit Auth] Backend profile verification warning:',
      error.response?.data?.detail || error.message
    );
    return null;
  }
}

/**
 * Authenticates an existing user and validates their account.
 */
export async function signInUser({ email, password, keepSignedIn = true }) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    const rawMsg = error.message?.toLowerCase() || '';
    if (rawMsg.includes('invalid login credentials')) {
      throw new Error('Invalid email or password. Please check your account credentials.');
    }
    if (rawMsg.includes('email not confirmed')) {
      throw new Error('Please verify your email address before logging in.');
    }
    throw new Error(error.message || 'Unable to sign in. Please try again.');
  }

  if (!data?.session || !data?.user) {
    throw new Error('Account validation failed. No active session was returned.');
  }

  // Persist "Keep me signed in" preference
  localStorage.setItem(KEEP_SIGNED_IN_KEY, keepSignedIn ? 'true' : 'false');
  sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

  // Verify token and load profile from FastAPI (/api/auth/me)
  const backendProfile = await verifyAndFetchProfile(data.session.access_token);

  return {
    user: data.user,
    session: data.session,
    profile: backendProfile || {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name || '',
    },
  };
}

/**
 * Registers a new user in Supabase Auth and passes full_name to trigger public.users insertion.
 */
export async function signUpUser({ fullName, email, password }) {
  const trimmedName = fullName.trim();
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: trimmedName,
      },
    },
  });

  if (error) {
    const rawMsg = error.message?.toLowerCase() || '';
    if (rawMsg.includes('already registered')) {
      throw new Error('An account with this email already exists. Please log in instead.');
    }
    throw new Error(error.message || 'Unable to create account. Please try again.');
  }

  // Supabase returns an empty identities array if the email is already taken (when email enumeration protection is on)
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('An account with this email already exists. Please log in instead.');
  }

  let backendProfile = null;
  if (data?.session?.access_token) {
    localStorage.setItem(KEEP_SIGNED_IN_KEY, 'true');
    sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
    backendProfile = await verifyAndFetchProfile(data.session.access_token);
  }

  return {
    user: data.user,
    session: data.session,
    profile: backendProfile || {
      id: data.user?.id,
      email: data.user?.email || normalizedEmail,
      full_name: trimmedName,
    },
    requiresEmailConfirmation: !data.session,
  };
}

/**
 * Signs out the current user and clears persistence flags.
 */
export async function signOutUser() {
  localStorage.removeItem(KEEP_SIGNED_IN_KEY);
  sessionStorage.removeItem(SESSION_ACTIVE_KEY);
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/**
 * Checks if a non-persistent session should be cleared after browser restart,
 * otherwise restores the current session.
 */
export async function initializeAuthSession() {
  const keepSignedIn = localStorage.getItem(KEEP_SIGNED_IN_KEY);
  const isBrowserSessionActive = sessionStorage.getItem(SESSION_ACTIVE_KEY);

  // If user unchecked "Keep me signed in" and closed the browser tab/window
  if (keepSignedIn === 'false' && !isBrowserSessionActive) {
    await signOutUser();
    return { user: null, session: null, profile: null };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session) {
    return { user: null, session: null, profile: null };
  }

  sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
  const profile = await verifyAndFetchProfile(data.session.access_token);

  return {
    user: data.session.user,
    session: data.session,
    profile: profile || {
      id: data.session.user.id,
      email: data.session.user.email,
      full_name: data.session.user.user_metadata?.full_name || '',
    },
  };
}

export { supabase };