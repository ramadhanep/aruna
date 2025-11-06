import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let serviceClient = null;

export function getSupabaseServiceRoleClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "Supabase service role client requested but required environment variables are missing."
    );
    return null;
  }

  if (serviceClient) {
    return serviceClient;
  }

  serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serviceClient;
}

export async function getUserFromRequest(request) {
  const client = getSupabaseServiceRoleClient();
  if (!client) {
    return { user: null, error: new Error("Supabase service role client unavailable") };
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { user: null, error: new Error("Missing bearer token") };
  }

  const { data, error } = await client.auth.getUser(token);
  if (error) {
    return { user: null, error };
  }

  return { user: data?.user ?? null, error: null };
}
