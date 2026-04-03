import { NextRequest, NextResponse } from "next/server";

import { ensureDefaultInstanceFromEnv } from "@/lib/instance-store";
import { processDueDispatchJobs } from "@/lib/send-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";
export const maxDuration = 60;

function isCronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const headerSecret = request.headers.get("x-cron-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");

  return (
    bearerSecret === secret ||
    headerSecret === secret ||
    querySecret === secret
  );
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      {
        error:
          "Acesso negado ao cron. Use Authorization Bearer, x-cron-secret ou ?secret=.",
      },
      { status: 401 },
    );
  }

  await ensureDefaultInstanceFromEnv();
  const result = await processDueDispatchJobs();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  return GET(request);
}
