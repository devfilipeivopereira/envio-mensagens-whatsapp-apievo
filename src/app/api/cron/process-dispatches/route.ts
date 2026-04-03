import { NextRequest, NextResponse } from "next/server";

import { ensureDefaultInstanceFromEnv } from "@/lib/instance-store";
import { processDueDispatchJobs } from "@/lib/send-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const authHeader = request.headers.get("authorization");

    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: "Acesso negado ao cron." },
        { status: 401 },
      );
    }
  }

  await ensureDefaultInstanceFromEnv();
  const result = await processDueDispatchJobs();
  return NextResponse.json(result);
}
