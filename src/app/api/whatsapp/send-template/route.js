import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toE164 } from "@/lib/whatsapp/E164";
import { recordAuditEvent } from "@/lib/services/audit/recordAuditEvent";
import { AUDIT_ACTIONS } from "@/lib/audit/auditEvents";
import {
  assertUsersBelongToOrg,
  handleApiError,
  requireOwnedOrg,
} from "@/lib/auth/guards";

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

async function buildWhatsappContact({ userId, defaultCountryCode }) {
  const user = await getUserById(userId);

  const rawPhone = getUserPhone(user);

  if (rawPhone) {
    return {
      identifierKey: "phonenumber",
      identifierValue: await toE164(rawPhone, defaultCountryCode),
    };
  }

  const bsuid = cleanText(user?.whatsapp_bsuid);
  if (bsuid) {
    return {
      identifierKey: "whatsappbsuid",
      identifierValue: bsuid,
    };
  }

  const contactId = cleanText(user?.bird_contact_id);

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

async function getAllowedProviderTemplateIds(admin, orgId) {
  const { data, error } = await admin
    .from("whatsapp_templates")
    .select("provider_template_id")
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .eq("status", "ACTIVE")
    .not("provider_template_id", "is", null);

  if (error) throw error;

  return new Set(
    (data || []).map((row) => String(row.provider_template_id)),
  );
}

async function requireAuthorizedBirdTemplate({
  admin,
  orgId,
  projectId,
  languageCode,
}) {
  const allowedIds = await getAllowedProviderTemplateIds(admin, orgId);

  if (allowedIds.size === 0) {
    const error = new Error("Template not found or not authorized");
    error.status = 404;
    throw error;
  }

  const url = new URL(
    `https://api.bird.com/workspaces/${encodeURIComponent(
      process.env.WORKSPACE_ID,
    )}/projects/${encodeURIComponent(projectId)}/channel-templates`,
  );

  url.searchParams.set("limit", "100");

  let nextPageToken = null;

  do {
    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken);
    } else {
      url.searchParams.delete("pageToken");
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `AccessKey ${process.env.BIRD_API_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 404) {
        const error = new Error("Template not found or not authorized");
        error.status = 404;
        throw error;
      }

      const error = new Error("Messaging provider request failed");
      error.status = 502;
      throw error;
    }

    const authorizedTemplate = (data?.results || []).find((template) => {
      const locale =
        template.defaultLocale ||
        template.platformContent?.[0]?.locale ||
        null;

      return (
        allowedIds.has(String(template.id)) &&
        String(locale || "").toLowerCase() === languageCode.toLowerCase()
      );
    });

    if (authorizedTemplate) {
      return authorizedTemplate;
    }

    nextPageToken = data?.nextPageToken || null;
  } while (nextPageToken);

  const error = new Error("Template not found or not authorized");
  error.status = 404;
  throw error;
}

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      orgId,
      userId,
      projectId,
      languageCode = "pt-PT",
      params = [],
      urlVar,
    } = body;

    if (!orgId || !projectId) {
      return NextResponse.json(
        { error: "orgId and projectId are required" },
        { status: 400 },
      );
    }

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const orgAuth = await requireOwnedOrg(orgId);
    if (orgAuth.error) return orgAuth.error;

    const safeUserIds = await assertUsersBelongToOrg(
      orgAuth.admin,
      orgAuth.orgId,
      [userId],
    );

    const authorizedTemplate = await requireAuthorizedBirdTemplate({
      admin: orgAuth.admin,
      orgId: orgAuth.orgId,
      projectId: String(projectId).trim(),
      languageCode: String(languageCode).trim(),
    });

    const safeUserId = safeUserIds[0];

    const org = await getOrgById(orgAuth.orgId);

    if (!org?.channel_id) {
      return NextResponse.json(
        { error: "Missing org.channel_id" },
        { status: 400 },
      );
    }

    const kvParameters = parseKeyValueParams(params, urlVar);

    const contact = await buildWhatsappContact({
      userId: safeUserId,
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
        projectId: String(projectId).trim(),
        version: String(authorizedTemplate.id),
        locale: String(languageCode).trim(),
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

    await recordAuditEvent(orgAuth, {
      action: AUDIT_ACTIONS.MESSAGE_TEMPLATE_SENT,
      entityType: "user",
      entityId: safeUserId,
      details: {
        channel: "whatsapp",
        projectId: String(projectId).trim(),
        languageCode: String(languageCode).trim(),
        ok: res.ok,
        status: res.status,
      },
    });

    return NextResponse.json(
      { ok: res.ok, status: res.status, data },
      { status: res.status },
    );
  } catch (err) {
    return handleApiError(err, "WhatsApp template send failed");
  }
}
