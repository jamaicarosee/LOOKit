import { apiClient } from '../../../services/apiClient';

// Turns an axios/FastAPI error into text for a Notice. FastAPI sends { detail: "..." }
// (or a list of { msg } for validation errors); the backend's safeguard messages
// (cannot deactivate yourself, last admin, ...) arrive this way.
export function errorMessage(err, fallback = 'Something went wrong.') {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const text = detail.map((d) => d?.msg).filter(Boolean).join(' ');
    if (text) return text;
  }
  return err?.message || fallback;
}

const COLUMN = { fullName: 'full_name', email: 'email', role: 'role', password: 'password' };

// Maps frontend camelCase state to backend snake_case JSON keys
function toRow(values) {
  const row = {};
  Object.entries(values).forEach(([key, value]) => {
    const column = COLUMN[key];
    if (!column) return;
    row[column] = typeof value === 'string' && key !== 'password' ? value.trim() : value;
  });
  return row;
}

// ------------------------------------------------------------------
// GET (Admin JWT Bearer Token)
// ------------------------------------------------------------------

export async function fetchUsers({ includeInactive = false, q = '' } = {}) {
  const params = {};
  if (includeInactive) params.include_inactive = true;
  if (q) params.q = q;
  const response = await apiClient.get('/api/users', { params });
  return response.data?.users || [];
}

// ------------------------------------------------------------------
// Admin Mutations
// ------------------------------------------------------------------

export async function addUser({ fullName, email, role, password }) {
  const response = await apiClient.post('/api/users', toRow({ fullName, email, role, password }));
  return response.data;
}

export async function updateUser(userId, values) {
  const response = await apiClient.put(`/api/users/${userId}`, toRow(values));
  return response.data;
}

// "Delete user" in the UI is a soft delete: the backend deactivates the account
export async function deactivateUser(userId) {
  const response = await apiClient.delete(`/api/users/${userId}`);
  return response.data;
}

export async function reactivateUser(userId) {
  const response = await apiClient.post(`/api/users/${userId}/reactivate`);
  return response.data;
}
