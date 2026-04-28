import { createClient } from "@supabase/supabase-js";
import { splitE164, toE164 } from "@/lib/whatsapp/E164";
import { getUserByNumber } from "@/lib/repos/user.repo";
import { isWindowOpenForUser } from "@/lib/repos/messages.repo";
import { createPendingOutreach } from "@/lib/repos/pendingOutreach.repo";
import { BroadcastError, normalizeFiles, isImageType } from "./shared";
import { getWhatsappTemplateById } from "@/lib/repos/whatsappTemplates.repo";
import { interpolateBroadcastMessage } from "./interpolateMessage";
import {
  replaceTrackedPlaceholders,
  resolveTrackedLinksForRecipient,
} from "./trackedLinks";

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
    const pairs = varKeys.map((k, i) => {
      let v = baseValues[i] ?? "";

      if (isIn(NAME_KEYS, k)) v = userName ?? v ?? "";
      if (isIn(COMPANY_KEYS, k)) v = orgName ?? v ?? "";

      return `${k}=${v}`;
    });

    if (urlVar && !pairs.some((p) => p.startsWith("url="))) {
      pairs.push(`url=${urlVar}`);
    }

    return pairs;
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
      "Missing Bird config (WORKSPACE_ID, channel_id, BIRD_API_KEY)",
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
    whatsappTemplateId = null,
    trackedLinks = [],
    scheduledBroadcastId = null,
    createdByUserId = null,
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

  let resolvedTemplate = template;

  if (!resolvedTemplate && whatsappTemplateId) {
    const tpl = await getWhatsappTemplateById(whatsappTemplateId);

    if (!tpl) {
      throw new BroadcastError("WhatsApp template not found", 400);
    }

    if (tpl.org_id != null && Number(tpl.org_id) !== Number(orgId)) {
      throw new BroadcastError(
        "WhatsApp template does not belong to this organization",
        400,
      );
    }

    const order = Array.isArray(tpl.components?.order)
      ? tpl.components.order
      : [];

    resolvedTemplate = {
      projectId: String(tpl.provider_template_id || "").trim(),
      languageCode: String(tpl.language || "pt-PT").trim(),
      varKeys: order,
      params: order.map(() => ""),
      manualParams: "",
      trackedUrlKey: tpl.components?.urlButtonVarKey || null,
    };
  }

  const hasTemplate = Boolean(resolvedTemplate?.projectId);
  const hasInitialFreeformContent =
    String(message || "").trim().length > 0 || onlyImageUrls.length > 0;

  if (!hasInitialFreeformContent && !hasTemplate) {
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

    const resolvedTrackedLinks = await resolveTrackedLinksForRecipient({
      trackedLinks,
      orgId,
      channel: "whatsapp",
      recipientUserId: user?.id || null,
      scheduledBroadcastId,
      createdByUserId,
    });

    const messageWithTrackedLinks = replaceTrackedPlaceholders(
      message,
      resolvedTrackedLinks,
    );

    const resolvedMessage = interpolateBroadcastMessage(
      messageWithTrackedLinks,
      {
        user,
        org,
        assistant: null,
      },
    );

    const hasResolvedFreeformContent =
      String(resolvedMessage || "").trim().length > 0 ||
      onlyImageUrls.length > 0;

    const windowOpen = user ? await isWindowOpenForUser(user.id) : false;

    if (windowOpen && hasResolvedFreeformContent) {
      const r = await sendFreeform({
        endpoint: messagesEndpoint,
        accessKey,
        to,
        message: resolvedMessage,
        imageUrls: onlyImageUrls,
      });

      console.log("[WA freeform result]", {
        to,
        ok: r.ok,
        status: r.status,
        data: r.data,
      });

      return { to, kind: "freeform", ...r };
    }

    if (hasTemplate) {
      const orderedKeys = Array.isArray(resolvedTemplate.varKeys)
        ? resolvedTemplate.varKeys
        : [];

      const baseValues = Array.isArray(resolvedTemplate.params)
        ? resolvedTemplate.params
        : [];

      let trackedUrlForTemplate = null;
      if (resolvedTemplate.trackedUrlKey) {
        const found = resolvedTrackedLinks.find(
          (x) => x.key === resolvedTemplate.trackedUrlKey,
        );
        trackedUrlForTemplate = found?.trackedUrl || null;
      }

      const kvPairs = buildKvParamsForUser({
        varKeys: orderedKeys,
        baseValues,
        manualParams: resolvedTemplate.manualParams,
        userName: user?.name || "",
        orgName: org?.name || "",
        urlVar: trackedUrlForTemplate,
      });

      console.log("[WA template final]", {
        to,
        orderedKeys,
        baseValues,
        trackedUrlForTemplate,
        kvPairs,
        resolvedTemplate,
      });

      const r = await sendTemplate({
        endpoint: messagesEndpoint,
        accessKey,
        to,
        template: resolvedTemplate,
        kvPairs,
      });

      console.log("[WA template result]", {
        to,
        ok: r.ok,
        status: r.status,
        data: r.data,
      });

      if (r.ok && user && hasResolvedFreeformContent) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const templateMessageId =
          r.data?.id || r.data?.message?.id || r.data?.payload?.id || null;

        await createPendingOutreach({
          orgId,
          userId: user.id,
          payload: {
            message: resolvedMessage,
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
  const failedCount = results.length - okCount;

  if (okCount === 0) {
    throw new BroadcastError(
      results[0]?.data?.error ||
        results[0]?.error ||
        "WhatsApp broadcast failed for all recipients.",
      400,
    );
  }

  return {
    ok: okCount,
    failed: failedCount,
    results,
    note:
      hasTemplate && hasInitialFreeformContent
        ? "If a contact was outside the 24h window, we sent the selected template and queued your message to be delivered on their first reply."
        : null,
  };
}
