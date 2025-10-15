import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toE164 } from "@/lib/whatsapp/toE164";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function getOrgById(orgId) {
  const { data, error } = await supabaseAdmin
    .from("organization")
    .select("id, waba_id, waba_namespace, channel_id")
    .eq("id", orgId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function parseKeyValueParams(values = [], urlVar) {
  const out = [];
  for (const raw of values) {
    const s = String(raw).trim();
    if (!s) continue;
    const eq = s.indexOf("=");
    if (eq === -1) continue;
    const key = s.slice(0, eq).trim();
    const value = s.slice(eq + 1).trim();
    if (!key || !value) continue;
    out.push({ type: "string", key, value });
  }
  if (urlVar && !out.some((p) => p.key === "url")) {
    out.push({ type: "string", key: "url", value: String(urlVar) });
  }
  return out;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      orgId,
      to,
      projectId,
      // templateId, // <-- not used in Channels API
      templateName,
      languageCode = "pt-PT",
      params = [],
      urlVar,
    } = body;

    if (!orgId || !to || !projectId) {
      return NextResponse.json(
        { error: "orgId, to, projectId are required" },
        { status: 400 }
      );
    }

    const org = await getOrgById(orgId);
    if (!org?.channel_id) {
      return NextResponse.json(
        { error: "Missing org.channel_id" },
        { status: 400 }
      );
    }

    const kvParameters = parseKeyValueParams(params, urlVar);

    // FIX 1: make sure phone is a string, not a Promise
    const e164 = await toE164(to);

    const WORKSPACE_ID = process.env.WORKSPACE_ID;
    const endpoint = `https://api.bird.com/workspaces/${WORKSPACE_ID}/channels/${org.channel_id}/messages`;

    const payload = {
      receiver: {
        contacts: [{ identifierKey: "phonenumber", identifierValue: e164 }],
      },
      // FIX 2: no "id" property here
      template: {
        projectId,
        version: "latest",
        locale: languageCode,
        parameters: kvParameters,
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.BIRD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Bird 4xx/5xx:", res.status, JSON.stringify(data, null, 2));
    }

    return NextResponse.json(
      { ok: res.ok, status: res.status, data },
      { status: res.status }
    );
  } catch (e) {
    console.error("send-template error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
