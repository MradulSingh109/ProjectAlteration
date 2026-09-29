import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/infrastructure/database/prisma";
import { errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const { connected, latencyMs } = await checkDatabaseConnection();

    if (!connected) {
      return errorResponse(
        new AppError(
          "Database is currently unavailable",
          503,
          "DATABASE_UNAVAILABLE",
        ),
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch {
    return errorResponse(
      new AppError(
        "Database is currently unavailable",
        503,
        "DATABASE_UNAVAILABLE",
      ),
    );
  }
}
