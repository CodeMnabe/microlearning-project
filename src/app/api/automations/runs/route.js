import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const sb = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));
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
        user_row:user_id (
          id,
          name
        )
      `,
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
