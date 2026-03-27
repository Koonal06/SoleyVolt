import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl!, supabasePublishableKey!)
  : null;
