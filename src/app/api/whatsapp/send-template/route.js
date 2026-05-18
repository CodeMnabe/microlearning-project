import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toE164 } from "@/lib/whatsapp/E164";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function getOrgById(orgId) {
  const { data, error } = await supabaseAdmin
    .from("organization")
    .select(
      "id, waba_id, waba_namespace, channel_id, default_phone_country_code",
    )
    .eq("id", orgId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function getUserById(userId) {
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("user")
    .select(
      "id, phone_number, phone_country_code, phone_national, whatsapp_bsuid, bird_contact_id",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

function cleanText(value) {
  if (value === undefined || value === null) return null;

  const str = String(value).trim();
  return str.length ? str : null;
}

function getUserPhone(user) {
  if (!user) return null;

  if (cleanText(user.phone_number)) return cleanText(user.phone_number);

  if (cleanText(user.phone_country_code) && cleanText(user.phone_national)) {
    return `${cleanText(user.phone_country_code)}${String(
      user.phone_national,
    ).replace(/\D/g, "")}`;
  }

  return null;
}

async function buildWhatsappContact({
  to,
  whatsappBsuid,
  birdContactId,
  userId,
  defaultCountryCode,
}) {
  const user = await getUserById(userId);

  const rawPhone = cleanText(to) || getUserPhone(user);

  if (rawPhone) {
    return {
      identifierKey: "phonenumber",
      identifierValue: await toE164(rawPhone, defaultCountryCode),
    };
  }

  const bsuid = cleanText(whatsappBsuid) || cleanText(user?.whatsapp_bsuid);
  if (bsuid) {
    return {
      identifierKey: "whatsappbsuid",
      identifierValue: bsuid,
    };
  }

  const contactId =
    cleanText(birdContactId) || cleanText(user?.bird_contact_id);
  if (contactId) {
    return { id: contactId };
  }

  return null;
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
      whatsappBsuid,
      birdContactId,
      userId,
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
        { status: 400 },
      );
    }

    if (!to && !whatsappBsuid && !birdContactId && !userId) {
      return NextResponse.json(
        {
          error:
            "Missing recipient. Provide to, whatsappBsuid, birdContactId, or userId",
        },
        { status: 400 },
      );
    }

    const org = await getOrgById(orgId);
    if (!org?.channel_id) {
      return NextResponse.json(
        { error: "Missing org.channel_id" },
        { status: 400 },
      );
    }

    const kvParameters = parseKeyValueParams(params, urlVar);

    const contact = await buildWhatsappContact({
      to,
      whatsappBsuid,
      birdContactId,
      userId,
      defaultCountryCode:
        org.default_phone_country_code ||
        process.env.DEFAULT_COUNTRY_CODE ||
        "+351",
    });

    if (!contact) {
      return NextResponse.json(
        {
          error:
            "Could not build WhatsApp recipient. Need phone number, whatsapp_bsuid, or bird_contact_id",
        },
        { status: 400 },
      );
    }

    const WORKSPACE_ID = process.env.WORKSPACE_ID;
    const endpoint = `https://api.bird.com/workspaces/${WORKSPACE_ID}/channels/${org.channel_id}/messages`;

    const payload = {
      receiver: {
        contacts: [contact],
      },
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
      { status: res.status },
    );
  } catch (e) {
    console.error("send-template error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
