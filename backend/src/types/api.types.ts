export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  error: null;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: ApiErrorDetail;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthCheckData {
  status: string;
  service: string;
  environment: string;
  timestamp: string;
  uptime: number;
}
