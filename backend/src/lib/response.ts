import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function successResponse<T>(
  data: T,
  status: number = 200,
  headers?: HeadersInit,
) {
  const body: ApiResponse<T> = {
    success: true,
    data,
  };
  return NextResponse.json(body, { status, headers });
}

export function errorResponse(error: unknown) {
  console.error("[API Error]", error);
  if (error instanceof AppError) {
    const body: ApiResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
    return NextResponse.json(body, { status: error.statusCode });
  }

  if (error instanceof ZodError) {
    const formatted = error.issues.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));
    const body: ApiResponse = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: formatted,
      },
    };
    return NextResponse.json(body, { status: 400 });
  }

  const isProd = process.env.NODE_ENV === "production";
  const message = isProd
    ? "An unexpected internal error occurred"
    : error instanceof Error
      ? error.message
      : "An unexpected error occurred";

  const body: ApiResponse = {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message,
    },
  };
  return NextResponse.json(body, { status: 500 });
}
