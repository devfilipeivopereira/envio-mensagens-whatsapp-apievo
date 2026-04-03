import { headers } from "next/headers";
import type { NextRequest } from "next/server";

import { verifySupabaseAccessToken } from "@/lib/supabase";

export async function requireApiUser(request?: NextRequest) {
  const authorization =
    request?.headers.get("authorization") ??
    (await headers()).get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Acesso negado. Faça login para continuar.");
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new Error("Token de acesso ausente.");
  }

  return verifySupabaseAccessToken(token);
}
