import axios from "axios";

const baseURL = import.meta.env.VITE_FASTAPI_BASE_URL;

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Automatically attach Supabase Bearer JWT if available and not already set
apiClient.interceptors.request.use(
  async (config) => {
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

export default apiClient;