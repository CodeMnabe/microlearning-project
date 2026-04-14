import { createClient } from "@supabase/supabase-js";
import { splitE164, toE164 } from "@/lib/whatsapp/E164";
import { getUserByNumber } from "@/lib/repos/user.repo";
import { isWindowOpenForUser } from "@/lib/repos/messages.repo";
import { createPendingOutreach } from "@/lib/repos/pendingOutreach.repo";
import { BroadcastError, normalizeFiles, isImageType } from "./shared";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const NAME_KEYS = [
  "name",
  "nome",
  "firstname",
  "first_name",
  "utilizador",
  "user",
];

const COMPANY_KEYS = [
  "empresa",
  "company",
  "organization",
  "organização",
  "organizacao",
  "org",
  "orgname",
  "companyname",
  "organizationname",
];

const isIn = (arr, k) => arr.includes(String(k || "").toLowerCase());

function buildKvParamsForUser({
  varKeys = [],
  baseValues = [],
  manualParams,
  userName,
  urlVar,
  orgName,
}) {
  if (Array.isArray(varKeys) && varKeys.length) {
    return varKeys
      .map((k, i) => {
        let v = baseValues[i] ?? "";

        if (isIn(NAME_KEYS, k)) v = userName ?? v ?? "";
        if (isIn(COMPANY_KEYS, k)) v = orgName ?? v ?? "";

        return `${k}=${v}`;
      })
      .concat(urlVar ? [`url=${urlVar}`] : []);
  }

  const pairs = (manualParams || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((kv) => {
      const [k, ...rest] = kv.split("=");
      const key = (k || "").trim();

      let value = (rest.join("=") || "").trim();

      if (isIn(NAME_KEYS, key)) value = userName || value;
      if (isIn(COMPANY_KEYS, key)) value = orgName || value;

      return `${key}=${value}`;
    });

  if (urlVar && !pairs.some((p) => p.startsWith("url="))) {
    pairs.push(`url=${urlVar}`);
  }

  return pairs;
}

async function loadOrgForWhatsapp(orgId) {
  const { data: org, error } = await supabaseAdmin
    .from("organization")
    .select("id, name, channel_id, waba_namespace, default_phone_country_code")
    .eq("id", orgId)
    .single();

  if (error || !org?.channel_id) {
    throw new BroadcastError("Could not load organization/channel_id", 400);
  }

  return org;
}

function getMessagesEndpoint(channelId) {
  const workspaceId = process.env.WORKSPACE_ID;
  const accessKey = process.env.BIRD_API_KEY;

  if (!workspaceId || !channelId || !accessKey) {
    throw new BroadcastError(
      "Missing Bird config (WORKSPACE_ID, channel_id, BIRD_API_KEY",
      500,
    );
  }

  return {
    url: `https://api.bird.com/workspaces/${workspaceId}/channels/${channelId}/messages`,
    accessKey,
  };
}

async function sendFreeform({ endpoint, accessKey, to, message, imageUrls }) {
  const payload = {
    receiver: {
      contacts: [{ identifierKey: "phonenumber", identifierValue: to }],
    },
    body: imageUrls.length
      ? {
          type: "image",
          image: {
            images: imageUrls.map((u) => ({
              // altText: "image",
              mediaUrl: u,
            })),
            ...(message ? { text: message } : {}),
          },
        }
      : { type: "text", text: { text: message } },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `AccessKey ${accessKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

async function sendTemplate({ endpoint, accessKey, to, template, kvPairs }) {
  const payload = {
    receiver: {
      contacts: [{ identifierKey: "phonenumber", identifierValue: to }],
    },
    template: {
      projectId: template.projectId,
      version: "latest",
      locale: template.languageCode || "pt-PT",
      parameters: kvPairs.map((kv) => {
        const [k, ...rest] = kv.split("=");
        return {
          type: "string",
          key: k.trim(),
          value: rest.join("=").trim(),
        };
      }),
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `AccessKey ${accessKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

export async function sendWhatsappBroadcast(input = {}) {
  const {
    orgId,
    message = "",
    files = [],
    imageUrls = [],
    recipients = [],
    template = null,
  } = input;

  if (!orgId) {
    throw new BroadcastError("Missing orgId", 400);
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new BroadcastError("Missing recipients", 400);
  }

  const normalizedFiles = normalizeFiles({ files, imageUrls });
  const onlyImageUrls = normalizedFiles
    .filter((f) => isImageType(f.contentType))
    .map((f) => f.url);

  const hasFreeformContent =
    String(message || "").trim().length > 0 || onlyImageUrls.length > 0;

  const hasTemplate = Boolean(template?.projectId);

  if (!hasFreeformContent && !hasTemplate) {
    throw new BroadcastError(
      "Missing message/images and no template provided",
      400,
    );
  }

  const org = await loadOrgForWhatsapp(orgId);
  const { url: messagesEndpoint, accessKey } = getMessagesEndpoint(
    org.channel_id,
  );

  const defaultCc =
    org.default_phone_country_code ||
    process.env.DEFAULT_COUNTRY_CODE ||
    "+351";

  async function handleOne(rawPhone) {
    const { nationalNumber } = splitE164(rawPhone);
    const digits = String(rawPhone).replace(/\D/g, "");

    const user =
      (nationalNumber && (await getUserByNumber(nationalNumber))) ||
      (digits && (await getUserByNumber(digits))) ||
      null;

    let to;

    if (user) {
      if (user.phone_number) {
        to = user.phone_number;
      } else if (user.phone_country_code && user.phone_national) {
        to = `${user.phone_country_code}${String(user.phone_national).replace(/\D/g, "")}`;
      } else {
        to = await toE164(rawPhone, defaultCc);
      }
    } else {
      to = await toE164(rawPhone, defaultCc);
    }

    const windowOpen = user ? await isWindowOpenForUser(user.id) : false;

    if (windowOpen && hasFreeformContent) {
      const r = await sendFreeform({
        endpoint: messagesEndpoint,
        accessKey,
        to,
        message,
        imageUrls: onlyImageUrls,
      });

      return { to, kind: "freeform", ...r };
    }

    if (hasTemplate) {
      const kvPairs = buildKvParamsForUser({
        varKeys: template.varKeys || [],
        baseValues: template.params || [],
        manualParams: template.manualParams,
        userName: user?.name || "",
        orgName: org?.name || "",
        urlVar: template.urlVar || null,
      });

      const r = await sendTemplate({
        endpoint: messagesEndpoint,
        accessKey,
        to,
        template,
        kvPairs,
      });

      if (r.ok && user && hasFreeformContent) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const templateMessageId =
          r.data?.id || r.data?.message?.id || r.data?.payload?.id || null;

        await createPendingOutreach({
          orgId,
          userId: user.id,
          payload: {
            message,
            imageUrls: onlyImageUrls,
          },
          expiresAt,
          templateMessageId,
        });
      }

      return {
        to,
        kind: "template",
        ...r,
      };
    }

    return {
      to,
      kind: "freeform",
      ok: false,
      status: 412,
      data: { error: "24h window closed and no template provided." },
    };
  }

  const settled = await Promise.allSettled(recipients.map(handleOne));

  const results = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          to: recipients[i],
          ok: false,
          status: 0,
          data: { error: String(r.reason) },
        },
  );

  const okCount = results.filter((r) => r.ok).length;

  return {
    ok: okCount,
    failed: results.length - okCount,
    results,
    note:
      hasTemplate && hasFreeformContent
        ? "If a contact was outside the 24h window, we sent the selected template and queued your message to be delivered on their first reply."
        : null,
  };
}
