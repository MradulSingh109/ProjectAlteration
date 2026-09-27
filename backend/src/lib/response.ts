import { NextResponse } from "next/server";
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

export function successResponse<T>(data: T, status: number = 200) {
  const body: ApiResponse<T> = {
    success: true,
    data,
  };
  return NextResponse.json(body, { status });
}

export function errorResponse(error: unknown) {
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

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";

  const body: ApiResponse = {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message,
    },
  };
  return NextResponse.json(body, { status: 500 });
}
