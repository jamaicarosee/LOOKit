import axios from "axios";
import { supabase } from "./supabaseClient";

const baseURL = (import.meta.env.VITE_FASTAPI_BASE_URL || "").trim();

if (!baseURL) {
  console.error("[LOOKit] Missing VITE_FASTAPI_BASE_URL environment variable.");
}

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

// Handle 401 token refresh, 403 account deactivation, and 429 rate limits cleanly
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const detail = error.response?.data?.detail;

    // 1. Retry once on 401 if a fresh session token can be obtained
    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const nextToken = await refreshAccessToken();

      if (nextToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;
        return apiClient(originalRequest);
      }
    }

    // 2. Force immediate local sign-out if the server reports a deactivated account
    if (
      status === 403 &&
      typeof detail === "string" &&
      detail.toLowerCase().includes("deactivated") &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(
        new CustomEvent("lookit:account-deactivated", { detail: { message: detail } })
      );
    }

    // 3. Attach friendly metadata for 429 Too Many Requests responses
    if (status === 429) {
      const retryHeader = Number(error.response?.headers?.["retry-after"]);
      const retrySeconds =
        Number.isFinite(retryHeader) && retryHeader > 0
          ? retryHeader
          : detail?.retry_after_seconds || 60;

      error.isRateLimited = true;
      error.retryAfterSeconds = retrySeconds;
      error.userMessage =
        typeof detail === "string"
          ? detail
          : detail?.message ||
            `Too many requests. Please wait ${retrySeconds} seconds and try again.`;
    }

    return Promise.reject(error);
  }
);

export default apiClient;