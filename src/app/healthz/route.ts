import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness Probe (/healthz)
 * Responds with HTTP 200 as long as the Next.js process is alive and handling requests.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
