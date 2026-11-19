
import { supabase } from '../../../services/supabaseClient';
import { apiClient } from '../../../services/apiClient';

import {
  reportLogin,
  reportLoginFailed,
  reportLogout,
} from '../../admin/data/auditService';

const KEEP_SIGNED_IN_KEY = 'lookit_keep_signed_in';
const SESSION_ACTIVE_KEY = 'lookit_browser_session_active';

const DEACTIVATED_MESSAGE =
  'This account has been deactivated. Please contact an administrator.';

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

  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn(
      '[LOOKit Auth] Sign-out after deactivation failed:',
      err
    );
  }
}

export async function verifyAndFetchProfile(
  accessToken,
  { throwOnDeactivated = false } = {}
) {
  if (!accessToken) return null;

  try {
    const response = await apiClient.get('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const profile = response.data?.user ?? response.data;

    if (profile && !('role' in profile)) {
      console.warn(
        "[LOOKit Auth] /api/auth/me returned no 'role' field. The backend must include public.users.role, otherwise the Admin button never appears."
      );
    }

    return profile;
  } catch (error) {
    const detail = error.response?.data?.detail;

    if (
      error.response?.status === 403 &&
      /deactivated/i.test(
        typeof detail === 'string' ? detail : ''
      )
    ) {
      await clearSession();

      if (throwOnDeactivated) {
        throw new Error(DEACTIVATED_MESSAGE);
      }

      return null;
    }

    console.warn(
      '[LOOKit Auth] Backend profile verification warning:',
      error.response?.data?.detail || error.message
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

// Manual registration
export async function signUpUser({
  fullName,
  email,
  password,
}) {
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
      throw new Error(
        'An account with this email already exists. Please log in instead.'
      );
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
    throw new Error(
      'An account with this email already exists. Please log in instead.'
    );
  }

  let backendProfile = null;

  if (data?.session?.access_token) {
    localStorage.setItem(KEEP_SIGNED_IN_KEY, 'true');
    sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');

    backendProfile = await verifyAndFetchProfile(
      data.session.access_token,
      { throwOnDeactivated: true }
    );
  }

  return {
    user: data.user,
    session: data.session,

    profile: mergeAuthProfile(data.user, backendProfile) || {
      id: data.user?.id,
      email: normalizedEmail,
      full_name: trimmedName,
      avatar_url: '',
      role: 'user',
    },

    requiresEmailConfirmation: !data.session,
  };
}

// Google OAuth login
export async function signInWithGoogle() {
  // Google OAuth always starts a persistent browser session.
  localStorage.setItem(KEEP_SIGNED_IN_KEY, 'true');

  const { data, error } =
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'openid email profile',
      },
    });

  if (error) {
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

  const { error } = await supabase.auth.signOut();

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
    const detail = error.response?.data?.detail;

    throw new Error(
      typeof detail === 'string'
        ? detail
        : 'Failed to reset password.'
    );
  }
}

export { supabase };