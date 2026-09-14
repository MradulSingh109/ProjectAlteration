import { ApiErrorDetail } from "./types";

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: Record<string, unknown> | null;

  constructor(
    message: string,
    options?: {
      code?: string;
      statusCode?: number;
      details?: Record<string, unknown> | null;
    }
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = options?.code || "UNKNOWN_ERROR";
    this.statusCode = options?.statusCode;
    this.details = options?.details;

    // Restore prototype chain
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }

  static fromApiErrorDetail(
    errorDetail: ApiErrorDetail,
    statusCode?: number
  ): ApiClientError {
    return new ApiClientError(errorDetail.message, {
      code: errorDetail.code,
      statusCode,
      details: errorDetail.details,
    });
  }

  static fromUnknown(error: unknown): ApiClientError {
    if (error instanceof ApiClientError) {
      return error;
    }
    if (error instanceof Error) {
      return new ApiClientError(error.message, { code: "CLIENT_ERROR" });
    }
    return new ApiClientError("An unexpected error occurred", {
      code: "UNKNOWN_ERROR",
    });
  }
}
