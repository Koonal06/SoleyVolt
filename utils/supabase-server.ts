import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ?? "https://itaykvdfwqfoatqchyzs.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  throw new Error("Missing SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY for server usage.");
}

export const supabaseServer = createClient(supabaseUrl, supabaseKey);
