import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function getOrgById(orgId) {
  const { data, error } = await supabaseAdmin
    .from("organization")
    .select("id, waba_id,waba_namespace, channel_id")
    .eq("id", orgId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function POST(req) {
  try {
    const {
      orgId,
      name,
      language = "pt",
      category = "MARKETING",
      components,
    } = await req.json();

    if (!orgId || !name || !components?.length) {
      return NextResponse.json(
        { error: "org, name and components are required" },
        { status: 400 }
      );
    }

    const org = await getOrgById(orgId);

    const mb = await fetch(
      "https://integrations.messagebird.com/v2/platforms/whatsapp/templates",
      {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${process.env.BIRD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          language,
          category,
          wabaId: org.waba_id,
          components,
        }),
      }
    );
    const mbData = await mb.json();
    if (!mb.ok)
      return new Response(JSON.stringify({ error: mbData }), {
        status: mb.status,
      });
    const upsert = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}` /
        rest /
        v1 /
        whatsapp_templates,
      {
        method: "POST",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Access ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          org_id: orgId,
          name,
          language,
          category,
          status: mbData.status ?? "NEW",
          components,
          provider_template_id: mbData.id ?? null,
          waba_id: org.waba_id,
          namespace: org.wa_namespace || null,
        }),
      }
    );
    const [tpl] = await upsert.json();
    return new Response(JSON.stringify({ ok: true, template: tpl }), {
      status: 201,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
