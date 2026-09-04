export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_SERVER_ERROR',
    details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errorCode: string = 'BAD_REQUEST', details?: unknown): AppError {
    return new AppError(message, 400, errorCode, details);
  }

  static unauthorized(message: string = 'Unauthorized', errorCode: string = 'UNAUTHORIZED'): AppError {
    return new AppError(message, 401, errorCode);
  }

  static forbidden(message: string = 'Forbidden', errorCode: string = 'FORBIDDEN'): AppError {
    return new AppError(message, 403, errorCode);
  }

  static notFound(message: string = 'Resource not found', errorCode: string = 'NOT_FOUND'): AppError {
    return new AppError(message, 404, errorCode);
  }

  static conflict(message: string = 'Resource conflict', errorCode: string = 'CONFLICT', details?: unknown): AppError {
    return new AppError(message, 409, errorCode, details);
  }

  static internal(message: string = 'Internal server error', errorCode: string = 'INTERNAL_SERVER_ERROR'): AppError {
    return new AppError(message, 500, errorCode);
  }

  static ocrInvalidOutput(message: string, details?: unknown): AppError {
    return new AppError(message, 502, 'OCR_INVALID_OUTPUT', details);
  }

  static ocrInvalidText(message: string, details?: unknown): AppError {
    return new AppError(message, 502, 'OCR_INVALID_TEXT', details);
  }

  static ocrInvalidConfidence(message: string, details?: unknown): AppError {
    return new AppError(message, 502, 'OCR_INVALID_CONFIDENCE', details);
  }

  static ocrInvalidBoundingBoxes(message: string, details?: unknown): AppError {
    return new AppError(message, 502, 'OCR_INVALID_BOUNDING_BOXES', details);
  }
}
