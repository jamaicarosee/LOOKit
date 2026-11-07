import { apiClient } from '../../../services/apiClient';
import { supabase } from '../../../services/supabaseClient';

// ------------------------------------------------------------------
// GET /api/audit (Admin JWT Bearer Token)
// ------------------------------------------------------------------

export async function fetchAudit({ q, action, entityType, status, dateFrom, dateTo, limit = 25, offset = 0 } = {}) {
  const params = { limit, offset };
  if (q) params.q = q;
  if (action) params.action = action;
  if (entityType) params.entity_type = entityType;
  if (status) params.status = status;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  const response = await apiClient.get('/api/audit', { params });
  return { entries: response.data?.entries || [], total: response.data?.total ?? 0 };
}

// ------------------------------------------------------------------
// Login / logout reporting. Fire-and-forget: these never throw, are never awaited by
// the sign-in/sign-out flow, and a failure only writes a console warning.
// ------------------------------------------------------------------

function warn(what, err) {
  console.warn(`[LOOKit Admin] Could not report ${what} to the audit log:`, err?.response?.data?.detail || err?.message || err);
}

export async function reportLogin(accessToken) {
  try {
    await apiClient.post('/api/audit/login', null, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (err) {
    warn('login', err);
  }
}

// No auth: the person is not signed in
export async function reportLoginFailed(email) {
  try {
    await apiClient.post('/api/audit/login-failed', { email });
  } catch (err) {
    warn('failed login', err);
  }
}

// Call this BEFORE supabase.auth.signOut(): getSession() is started synchronously here,
// so it is queued ahead of signOut and still sees the token the request needs.
export async function reportLogout() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;
    await apiClient.post('/api/audit/logout', null, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    warn('logout', err);
  }
}
