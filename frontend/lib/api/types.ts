/**
 * Core API response envelopes matching the SIH26034 backend OpenAPI contract.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error: null;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: ApiErrorDetail;
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;
