import { supabase } from '../../../services/supabaseClient';
import { apiClient } from '../../../services/apiClient';

import {
  reportLogin,
  reportLoginFailed,
  reportLogout,
} from '../../admin/data/auditService';

const KEEP_SIGNED_IN_KEY = 'lookit_keep_signed_in';
const SESSION_ACTIVE_KEY = 'lookit_browser_session_active';
const GOOGLE_OAUTH_PENDING_KEY = 'lookit_google_oauth_pending';
const EMAIL_CONFIRM_PENDING_KEY = 'lookit_email_confirm_pending';

const DEACTIVATED_MESSAGE =
  'This account has been deactivated. Please contact an administrator.';
const ACCOUNT_EXISTS_MESSAGE = 'Account already exists.';

function extractApiError(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const firstMsg = detail[0]?.msg;
    if (typeof firstMsg === 'string' && firstMsg.trim()) {
      return firstMsg.replace(/^Value error,\s*/i, '');
    }
  }
  return fallback;
}

// Get basic information from Google or Supabase Auth
export function getAuthUserProfile(user) {
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

// Merge the authenticated Google user with LOOKit backend profile
export function mergeAuthProfile(user, backendProfile) {
  if (!user) return null;

  const authProfile = getAuthUserProfile(user);

  return {
    ...authProfile,
    ...(backendProfile || {}),

    id: user.id,
    email: user.email || backendProfile?.email || '',

    full_name:
      backendProfile?.full_name ||
      authProfile.full_name,

    avatar_url:
      backendProfile?.avatar_url ||
      authProfile.avatar_url,

    // Role is controlled only by the LOOKit backend
    role: backendProfile?.role || 'user',
  };
}

async function clearSession() {
  localStorage.removeItem(KEEP_SIGNED_IN_KEY);
  sessionStorage.removeItem(SESSION_ACTIVE_KEY);
  sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (err) {
    console.warn(
      '[LOOKit Auth] Sign-out cleanup failed:',
      err
    );
  }
}

export function isGoogleOAuthPending() {
  return sessionStorage.getItem(GOOGLE_OAUTH_PENDING_KEY) === 'true';
}

export function clearGoogleOAuthPending() {
  sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
}

export function isEmailConfirmPending() {
  return localStorage.getItem(EMAIL_CONFIRM_PENDING_KEY) === 'true';
}

export function clearEmailConfirmPending() {
  localStorage.removeItem(EMAIL_CONFIRM_PENDING_KEY);
}

export async function checkAccountAvailability({ fullName, email }) {
  try {
    const response = await apiClient.post('/api/auth/check-availability', {
      full_name: fullName,
      email,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      extractApiError(
        error,
        'Unable to validate account availability. Please try again.'
      )
    );
  }
}

export async function validateGoogleLogin(
  accessToken,
  { _hasRetried = false } = {}
) {
  if (!accessToken) return;
  try {
    await apiClient.post(
      '/api/auth/validate-google',
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        _retry: true,
      }
    );
  } catch (error) {
    const status = error.response?.status;

    if (status === 401 && !_hasRetried) {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      const nextToken = data?.session?.access_token;

      if (!refreshError && nextToken && nextToken !== accessToken) {
        return validateGoogleLogin(nextToken, { _hasRetried: true });
      }
    }

    if (status === 409) {
      await clearSession();
      const detail = error.response?.data?.detail;
      throw new Error(
        typeof detail === 'string' ? detail : ACCOUNT_EXISTS_MESSAGE
      );
    }
    console.warn(
      '[LOOKit Auth] Google validation warning:',
      error.response?.data?.detail || error.message
    );
  }
}

async function fetchMe(accessToken) {
  const response = await apiClient.get('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    _retry: true,
  });

  const profile = response.data?.user ?? response.data;

  if (profile && !('role' in profile)) {
    console.warn(
      "[LOOKit Auth] /api/auth/me returned no 'role' field. The backend must include public.users.role, otherwise the Admin button never appears."
    );
  }

  return profile;
}

export async function verifyAndFetchProfile(
  accessToken,
  { throwOnDeactivated = false, _hasRetried = false } = {}
) {
  if (!accessToken) return null;

  try {
    return await fetchMe(accessToken);
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;

    if (status === 401 && !_hasRetried) {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      const nextToken = data?.session?.access_token;

      if (!refreshError && nextToken && nextToken !== accessToken) {
        return verifyAndFetchProfile(nextToken, {
          throwOnDeactivated,
          _hasRetried: true,
        });
      }
    }

    if (
      status === 403 &&
      /deactivated/i.test(typeof detail === 'string' ? detail : '')
    ) {
      await clearSession();

      if (throwOnDeactivated) {
        throw new Error(DEACTIVATED_MESSAGE);
      }

      return null;
    }

    console.warn(
      '[LOOKit Auth] Backend profile verification warning:',
      detail || error.message
    );

    return null;
  }
}

// Email and password login
export async function signInUser({
  email,
  password,
  keepSignedIn = true,
}) {
  const normalizedEmail = email.trim().toLowerCase();
  clearEmailConfirmPending();

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

  if (error) {
    reportLoginFailed(normalizedEmail);

    const rawMsg = error.message?.toLowerCase() || '';

    if (rawMsg.includes('invalid login credentials')) {
      throw new Error(
        'Invalid email or password. Please check your account credentials.'
      );
    }

    if (rawMsg.includes('email not confirmed')) {
      throw new Error(
        'Please verify your email address before logging in.'
      );
    }

    throw new Error(
      error.message || 'Unable to sign in. Please try again.'
    );
  }

  if (!data?.session || !data?.user) {
    throw new Error(
      'Account validation failed. No active session was returned.'
    );
  }

  localStorage.setItem(
    KEEP_SIGNED_IN_KEY,
    keepSignedIn ? 'true' : 'false'
  );

  sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

  const backendProfile = await verifyAndFetchProfile(
    data.session.access_token,
    { throwOnDeactivated: true }
  );

  reportLogin(data.session.access_token);

  return {
    user: data.user,
    session: data.session,
    profile: mergeAuthProfile(data.user, backendProfile),
  };
}

// Manual registration (never auto-logs in; requires email confirmation)
export async function signUpUser({
  fullName,
  email,
  password,
}) {
  const trimmedName = fullName.trim();
  const normalizedEmail = email.trim().toLowerCase();

  // Pre-check against public.users and Layer 1 email validation
  const availability = await checkAccountAvailability({
    fullName: trimmedName,
    email: normalizedEmail,
  });

  if (availability?.exists) {
    throw new Error(availability.message || ACCOUNT_EXISTS_MESSAGE);
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/?email_confirmed=true`,
      data: {
        full_name: trimmedName,
      },
    },
  });

  if (error) {
    const rawMsg = error.message?.toLowerCase() || '';

    if (rawMsg.includes('already registered')) {
      throw new Error(ACCOUNT_EXISTS_MESSAGE);
    }

    throw new Error(
      error.message || 'Unable to create account. Please try again.'
    );
  }

  if (
    data?.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    throw new Error(ACCOUNT_EXISTS_MESSAGE);
  }

  // Strictly prevent auto-login if Supabase returned a session
  if (data?.session) {
    await clearSession();
  }

  // Mark pending confirmation across tabs so ?code= callbacks never auto-login
  localStorage.setItem(EMAIL_CONFIRM_PENDING_KEY, 'true');

  return {
    user: data.user,
    session: null,
    profile: null,
    requiresEmailConfirmation: true,
  };
}

// Google OAuth login
export async function signInWithGoogle() {
  clearEmailConfirmPending();
  // Google OAuth always starts a persistent browser session.
  localStorage.setItem(KEEP_SIGNED_IN_KEY, 'true');
  sessionStorage.setItem(GOOGLE_OAUTH_PENDING_KEY, 'true');

  const { data, error } =
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'openid email profile',
      },
    });

  if (error) {
    clearGoogleOAuthPending();
    throw new Error(
      error.message || 'Unable to sign in with Google.'
    );
  }

  return data;
}

// Logout
export async function signOutUser({
  skipAudit = false,
} = {}) {
  if (!skipAudit) {
    reportLogout();
  }

  localStorage.removeItem(KEEP_SIGNED_IN_KEY);
  sessionStorage.removeItem(SESSION_ACTIVE_KEY);
  sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);

  const { error } = await supabase.auth.signOut({ scope: 'local' });

  if (error) {
    throw new Error(error.message);
  }
}

// Restore session after login or page refresh
export async function initializeAuthSession() {
  const keepSignedIn =
    localStorage.getItem(KEEP_SIGNED_IN_KEY);

  const isBrowserSessionActive =
    sessionStorage.getItem(SESSION_ACTIVE_KEY);

  if (
    keepSignedIn === 'false' &&
    !isBrowserSessionActive
  ) {
    await signOutUser({ skipAudit: true });

    return {
      user: null,
      session: null,
      profile: null,
    };
  }

  const { data, error } = await supabase.auth.getSession();

  if (error || !data?.session) {
    return {
      user: null,
      session: null,
      profile: null,
    };
  }

  sessionStorage.setItem(
    SESSION_ACTIVE_KEY,
    'true'
  );

  // Skip pre-validation /api/auth/me during a Google OAuth return so validate-google runs immediately
  if (isGoogleOAuthPending()) {
    return {
      user: data.session.user,
      session: data.session,
      profile: null,
    };
  }

  let backendProfile;

  try {
    backendProfile = await verifyAndFetchProfile(
      data.session.access_token,
      { throwOnDeactivated: true }
    );
  } catch (err) {
    console.warn('[LOOKit Auth]', err.message);

    return {
      user: null,
      session: null,
      profile: null,
    };
  }

  return {
    user: data.session.user,
    session: data.session,
    profile: mergeAuthProfile(
      data.session.user,
      backendProfile
    ),
  };
}

// Password recovery
export async function requestPasswordReset(email) {
  try {
    await apiClient.post('/api/auth/forgot-password', {
      email,
      redirect_to: window.location.origin,
    });
  } catch (error) {
    const detail = error.response?.data?.detail;

    throw new Error(
      typeof detail === 'string'
        ? detail
        : 'Unable to send reset link.'
    );
  }
}

// Submit new password
export async function submitNewPassword(newPassword) {
  try {
    await apiClient.post('/api/auth/change-password', {
      new_password: newPassword,
    });

    await signOutUser({ skipAudit: true });
  } catch (error) {
    throw new Error(
      extractApiError(error, 'Failed to reset password.')
    );
  }
}

export { supabase };