import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  handleApiError,
  requireOwnedOrg,
} from "@/lib/auth/guards";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = Number(searchParams.get("orgId"));
    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    const limit = Math.min(
      500,
      Math.max(1, Number(searchParams.get("limit") || 100)),
    );

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("automation_run")
      .select(
        `
        *,
        user_row:user!automation_run_user_id_fkey (
          id,
          name,
          email
        ),
        scheduled_broadcast:scheduled_broadcast!automation_run_scheduled_broadcast_id_fkey (
          id,
          status,
          channel,
          scheduled_for,
          payload,
          recipient_count,
          created_at
        )
      `,
      )
      .eq("organization_id", orgAuth.orgId)
      .not("scheduled_broadcast_id", "is", null)
      .order("scheduled_for", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ items: data || [] });
  } catch (error) {
  return handleApiError(error, "Failed to load automation runs");
}
}
