import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient, getUserFromRequest } from "@/lib/supabase-server";
import { encodePayload } from "@/lib/secure-payload";

export async function POST(request) {
  const supabaseAdmin = getSupabaseServiceRoleClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { payload: encodePayload({ error: "Supabase service role key is not configured" }) },
      { status: 500 }
    );
  }

  const { user, error } = await getUserFromRequest(request);
  if (error || !user) {
    return NextResponse.json({ payload: encodePayload({ error: "Unauthorized" }) }, { status: 401 });
  }

  try {
    const userId = user.id;

    await supabaseAdmin.from("watchlists").delete().eq("user_id", userId);
    await supabaseAdmin.from("portfolios").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ payload: encodePayload({ success: true }) });
  } catch (err) {
    console.error("Failed to delete account", err);
    return NextResponse.json(
      { payload: encodePayload({ error: "Failed to delete account" }) },
      { status: 500 }
    );
  }
}
