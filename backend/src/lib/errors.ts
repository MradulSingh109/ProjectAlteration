/**
 * Reusable Error foundation for NWIS Backend.
 * Supports consistent API error responses conforming to Clean Architecture.
 */

export type ErrorCode =
  | "INTERNAL_SERVER_ERROR"
  | "DATABASE_UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "INVALID_CREDENTIALS"
  | "EMAIL_ALREADY_EXISTS"
  | "CONFLICT"
  | "SESSION_EXPIRED"
  | "INVALID_TOKEN";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = "INTERNAL_SERVER_ERROR",
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, "BAD_REQUEST", details);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(message, 400, "VALIDATION_ERROR", details);
  }

  static unauthorized(
    message: string = "Authentication required",
    code: ErrorCode = "UNAUTHORIZED",
  ): AppError {
    return new AppError(message, 401, code);
  }

  static invalidCredentials(
    message: string = "Invalid email or password",
  ): AppError {
    return new AppError(message, 401, "INVALID_CREDENTIALS");
  }

  static forbidden(
    message: string = "You do not have permission to access this resource",
  ): AppError {
    return new AppError(message, 403, "FORBIDDEN");
  }

  static notFound(message: string = "Resource not found"): AppError {
    return new AppError(message, 404, "NOT_FOUND");
  }

  static conflict(message: string, code: ErrorCode = "CONFLICT"): AppError {
    return new AppError(message, 409, code);
  }

  static internal(
    message: string = "An unexpected internal server error occurred",
  ): AppError {
    return new AppError(message, 500, "INTERNAL_SERVER_ERROR");
  }
}
