import axios from "axios";
import { supabase } from "./supabaseClient";

const baseURL = import.meta.env.VITE_FASTAPI_BASE_URL;

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 28000,
});

let refreshInFlight = null;

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = supabase.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error) return null;
        return data?.session?.access_token || null;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Automatically attach Supabase Bearer JWT if available and not already set
apiClient.interceptors.request.use(
  async (config) => {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Retry once on 401 if a fresh session token can be obtained
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const nextToken = await refreshAccessToken();

      if (nextToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;