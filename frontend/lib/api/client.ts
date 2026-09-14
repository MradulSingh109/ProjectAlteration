import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { ApiClientError } from "./errors";
import { ApiErrorResponse } from "./types";

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

// Request interceptor: infrastructure ready for future authentication
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // In future auth steps, bearer token will be retrieved and injected here:
    // const token = getAuthToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error: unknown) => {
    return Promise.reject(ApiClientError.fromUnknown(error));
  }
);

// Response interceptor: centralized error handling & normalization
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<ApiErrorResponse>) => {
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
