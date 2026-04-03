import { NextResponse } from "next/server";

import { getPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";
export const maxDuration = 15;

async function checkDatabase() {
  try {
    const pool = getPool();
    await pool.query("select 1 as ok");

    return {
      ok: true,
      message: "Banco conectado.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Banco indisponivel.",
    };
  }
}

export async function GET() {
  const database = await checkDatabase();

  return NextResponse.json({
    status: database.ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks: {
      supabaseAuth: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
          process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
      databaseUrl: Boolean(
        process.env.SUPABASE_DB_POOLER_URL || process.env.SUPABASE_DB_URL,
      ),
      evolutionDefaultInstance: Boolean(
        process.env.EVOLUTION_BASE_URL &&
          process.env.EVOLUTION_INSTANCE_NAME &&
          process.env.EVOLUTION_API_KEY,
      ),
      cronSecret: Boolean(process.env.CRON_SECRET),
      database,
    },
  });
}
