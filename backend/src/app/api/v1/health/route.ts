import { NextResponse } from "next/server";
import { config } from "@/config/env";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: config.app.name,
      version: config.app.version,
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
