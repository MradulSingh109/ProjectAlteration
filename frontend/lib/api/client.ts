import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { ApiClientError } from "./errors";
import { ApiErrorResponse } from "./types";
import { tokenStorage } from "@/lib/auth/token-storage";

const DEFAULT_BASE_URL = "http://localhost:5000/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || DEFAULT_BASE_URL;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor: inject Bearer token if present
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => {
    return Promise.reject(ApiClientError.fromUnknown(error));
  }
);

// Response interceptor: centralized error handling, normalization & 401 session clearance
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    // If backend reports 401 Unauthorized on a non-login route, clear stale token
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || "";
      if (!requestUrl.includes("/auth/login")) {
        tokenStorage.clearSession();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sih:session-expired"));
        }
      }
    }

    if (error.response?.data?.error) {
      const { code, message, details } = error.response.data.error;
      throw new ApiClientError(message, {
        code,
        statusCode: error.response.status,
        details,
      });
    }

    if (error.response) {
      throw new ApiClientError(
        error.message || `Request failed with status ${error.response.status}`,
        {
          code: `HTTP_${error.response.status}`,
          statusCode: error.response.status,
        }
      );
    }

    if (error.request) {
      throw new ApiClientError(
        "Network error: Unable to connect to the backend API server. Please verify your connection.",
        { code: "NETWORK_ERROR" }
      );
    }

    throw ApiClientError.fromUnknown(error);
  }
);

