import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { AuthenticatedUser } from "@/lib/types";
import { requiredEnv } from "@/lib/utils";

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabasePublishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

export function createBrowserSupabaseClient() {
  return createClient(supabaseUrl, supabasePublishableKey);
}

export function createSupabaseAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function verifySupabaseAccessToken(accessToken: string) {
  const supabase = createSupabaseAdminClient();
  const result = await supabase.auth.getUser(accessToken);

  if (result.error || !result.data.user?.email) {
    throw new Error("Sessao invalida. Faça login novamente.");
  }

  const user: AuthenticatedUser = {
    id: result.data.user.id,
    email: result.data.user.email,
  };

  return user;
}
