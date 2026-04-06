import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let supabaseClient: SupabaseClient | null = null;

if (supabaseUrl && supabasePublishableKey) {
  supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
} else {
  console.warn("Supabase not configured. Define VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.");
}

export function getSupabaseClient() {
  return supabaseClient;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseClient);
}
