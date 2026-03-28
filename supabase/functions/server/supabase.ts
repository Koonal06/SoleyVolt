import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

function requireEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const supabaseUrl = requireEnv("SUPABASE_URL");
const supabaseAnonKey =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_KEY");
const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseAnonKey) {
  throw new Error(
    "Missing SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY for authenticated server requests.",
  );
}

export function createAdminClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createUserClient(authorization?: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: authorization
      ? {
          headers: {
            Authorization: authorization,
          },
        }
      : undefined,
  });
}

export async function requireUser(authorization?: string) {
  if (!authorization) {
    throw new Response(JSON.stringify({ error: "Missing Authorization header." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Response(JSON.stringify({ error: "Missing bearer token." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = createUserClient(`Bearer ${token}`);
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) {
    throw new Response(JSON.stringify({ error: "Invalid or expired token." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return { client, user };
}
