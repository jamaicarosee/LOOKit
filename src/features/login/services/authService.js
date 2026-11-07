import { supabase } from '../../../services/supabaseClient';
import { apiClient } from '../../../services/apiClient';
<<<<<<< HEAD

const KEEP_SIGNED_IN_KEY = 'lookit_keep_signed_in';
const SESSION_ACTIVE_KEY = 'lookit_browser_session_active';
=======
import { reportLogin, reportLoginFailed, reportLogout } from '../../admin/data/auditService';

const KEEP_SIGNED_IN_KEY = 'lookit_keep_signed_in';
const SESSION_ACTIVE_KEY = 'lookit_browser_session_active';
const DEACTIVATED_MESSAGE = 'This account has been deactivated. Please contact an administrator.';

// Signs out locally without reporting a logout (used when the backend refuses a deactivated account)
async function clearSession() {
  localStorage.removeItem(KEEP_SIGNED_IN_KEY);
  sessionStorage.removeItem(SESSION_ACTIVE_KEY);
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[LOOKit Auth] Sign-out after deactivation failed:', err);
  }
}
>>>>>>> d6a3a47 (updated user, overview, audit logs)

/**
 * Verifies the Supabase JWT access token against FastAPI GET /api/auth/me
 * and returns the user profile from public.users.
<<<<<<< HEAD
 */
export async function verifyAndFetchProfile(accessToken) {
=======
 * If the backend answers 403 "deactivated", the user is signed out and the call throws when
 * `throwOnDeactivated` is set (sign-in / session restore), otherwise it returns null.
 */
export async function verifyAndFetchProfile(accessToken, { throwOnDeactivated = false } = {}) {
>>>>>>> d6a3a47 (updated user, overview, audit logs)
  if (!accessToken) return null;

  try {
    const response = await apiClient.get('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // The backend may wrap the row as { user: {...} }; accept both shapes
    const profile = response.data?.user ?? response.data;

    if (profile && !('role' in profile)) {
      console.warn(
        "[LOOKit Auth] /api/auth/me returned no 'role' field. The backend must include public.users.role, otherwise the Admin button never appears."
      );
    }

    return profile;
  } catch (error) {
<<<<<<< HEAD
=======
    const detail = error.response?.data?.detail;
    if (error.response?.status === 403 && /deactivated/i.test(typeof detail === 'string' ? detail : '')) {
      await clearSession();
      if (throwOnDeactivated) throw new Error(DEACTIVATED_MESSAGE);
      return null;
    }

>>>>>>> d6a3a47 (updated user, overview, audit logs)
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
<<<<<<< HEAD
=======
    reportLoginFailed(normalizedEmail); // audit log, fire-and-forget
>>>>>>> d6a3a47 (updated user, overview, audit logs)
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
<<<<<<< HEAD
  const backendProfile = await verifyAndFetchProfile(data.session.access_token);
=======
  const backendProfile = await verifyAndFetchProfile(data.session.access_token, { throwOnDeactivated: true });

  reportLogin(data.session.access_token); // audit log, fire-and-forget
>>>>>>> d6a3a47 (updated user, overview, audit logs)

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
<<<<<<< HEAD
export async function signOutUser() {
=======
export async function signOutUser({ skipAudit = false } = {}) {
  if (!skipAudit) reportLogout(); // audit log, fire-and-forget; must start before signOut
>>>>>>> d6a3a47 (updated user, overview, audit logs)
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
<<<<<<< HEAD
    await signOutUser();
=======
    await signOutUser({ skipAudit: true });
>>>>>>> d6a3a47 (updated user, overview, audit logs)
    return { user: null, session: null, profile: null };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session) {
    return { user: null, session: null, profile: null };
  }

  sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
<<<<<<< HEAD
  const profile = await verifyAndFetchProfile(data.session.access_token);
=======
  let profile;
  try {
    profile = await verifyAndFetchProfile(data.session.access_token, { throwOnDeactivated: true });
  } catch (err) {
    // Deactivated account: already signed out by verifyAndFetchProfile
    console.warn('[LOOKit Auth]', err.message);
    return { user: null, session: null, profile: null };
  }
>>>>>>> d6a3a47 (updated user, overview, audit logs)

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