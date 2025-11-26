// /api/broadcast/whatsapp/route.js
require("dotenv").config();
import { NextResponse } from "next/server";
import { toE164 } from "@/lib/whatsapp/E164";
import { createClient } from "@supabase/supabase-js";
import { getUserByNumber } from "@/lib/repos/user.repo";
import { isWindowOpenForUser } from "@/lib/repos/messages.repo";
import { createPendingOutreach } from "@/lib/repos/pendingOutreach.repo";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
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
  // If we have declared var keys, align them with values and override name/nome
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

  // Manual CSV "key=value" case; replace name/nome if present, add url if needed
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

  if (urlVar && !pairs.some((p) => p.startsWith("url=")))
    pairs.push(`url=${urlVar}`);
  return pairs;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      orgId,
      message = "",
      imageUrls = [],
      recipients = [],
      template = null, // { projectId, name, languageCode, params, varKeys, manualParams, urlVar }
    } = body;

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    if ((!message && imageUrls.length === 0) || recipients.length === 0) {
      return NextResponse.json(
        { error: "Missing message/images or recipients" },
        { status: 400 }
      );
    }

    // Load org/channel
    const { data: org, error } = await supabaseAdmin
      .from("organization")
      .select(
        "id, name, channel_id, waba_namespace, default_phone_country_code"
      )
      .eq("id", orgId)
      .single();

    if (error || !org?.channel_id) {
      return NextResponse.json(
        { error: "Could not load organization/channel_id" },
        { status: 400 }
      );
    }

    const WORKSPACE_ID = process.env.WORKSPACE_ID;
    const CHANNEL_ID = org.channel_id;
    const ACCESS_KEY = process.env.BIRD_API_KEY;
    const DEFAULT_CC =
      org.default_phone_country_code ||
      process.env.DEFAULT_COUNTRY_CODE ||
      "+351";

    if (!WORKSPACE_ID || !CHANNEL_ID || !ACCESS_KEY) {
      return NextResponse.json(
        {
          error:
            "Missing Bird config (WORKSPACE_ID, channel_id, BIRD_API_KEY).",
        },
        { status: 500 }
      );
    }

    const messagesEndpoint = `https://api.bird.com/workspaces/${WORKSPACE_ID}/channels/${CHANNEL_ID}/messages`;

    async function sendFreeform(toE164Value) {
      const payload = {
        receiver: {
          contacts: [
            { identifierKey: "phonenumber", identifierValue: toE164Value },
          ],
        },
        body: imageUrls.length
          ? {
              type: "image",
              image: {
                images: imageUrls.map((u) => ({
                  altText: "image",
                  mediaUrl: u,
                })),
                ...(message ? { text: message } : {}),
              },
            }
          : { type: "text", text: { text: message } },
      };

      const res = await fetch(messagesEndpoint, {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${ACCESS_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      return { ok: res.ok, status: res.status, data };
    }

    async function sendTemplate(toE164Value, kvPairs) {
      const payload = {
        receiver: {
          contacts: [
            { identifierKey: "phonenumber", identifierValue: toE164Value },
          ],
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

      const res = await fetch(messagesEndpoint, {
        method: "POST",
        headers: {
          Authorization: `AccessKey ${ACCESS_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }

    async function handleOne(rawPhone) {
      const digits = String(rawPhone).replace(/\D/g, "");

      // 1) Look up the user by NATIONAL number (phone_national)
      const user = await getUserByNumber(digits);

      // 2) Decide the E.164 destination
      let to;
      if (user) {
        // Prefer the full phone_number if you stored E.164 there
        if (user.phone_number) {
          to = user.phone_number;
        } else if (user.phone_country_code && user.phone_national) {
          // Fallback in case phone_number is empty but split fields exist
          to = `${user.phone_country_code}${String(user.phone_national).replace(
            /\D/g,
            ""
          )}`;
        } else {
          // Very old rows – we have no split info, so fall back to org default
          to = await toE164(rawPhone, DEFAULT_CC);
        }
      } else {
        // Not in DB: assume this is either E.164 or a national number,
        // and use the org's default CC as a fallback
        to = await toE164(rawPhone, DEFAULT_CC);
      }

      const windowOpen = user ? await isWindowOpenForUser(user.id) : false;

      if (windowOpen) {
        // Inside 24h window -> send your freeform message
        const r = await sendFreeform(to);
        return { to, kind: "freeform", ...r };
      }

      // Window closed and we have a picked template
      if (!template?.projectId) {
        return {
          to,
          kind: "freeform",
          ok: false,
          status: 412,
          data: { error: "24h window closed and no template provided." },
        };
      }

      const kvPairs = buildKvParamsForUser({
        varKeys: template.varKeys || [],
        baseValues: template.params || [],
        manualParams: template.manualParams,
        userName: user?.name || "",
        orgName: org?.name || "",
        urlVar: template.urlVar || null,
      });

      const r = await sendTemplate(to, kvPairs);

      // On successful template, queue the intended message for auto-send when user replies
      if (r.ok && user) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const templateMessageId =
          r.data?.id || r.data?.message?.id || r.data?.payload?.id || null;

        await createPendingOutreach({
          orgId,
          userId: user.id,
          payload: { message, imageUrls },
          expiresAt,
          templateMessageId,
        });
      }

      return { to, kind: "template", ...r };
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
          }
    );
    const okCount = results.filter((r) => r.ok).length;

    return NextResponse.json({
      ok: okCount,
      failed: results.length - okCount,
      results,
      note: "If a contact was outside the 24h window, we sent the selected template and queued your message to be delivered on their first reply.",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
