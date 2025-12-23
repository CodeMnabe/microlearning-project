import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBotToken } from "@/lib/teams/auth";
import { getUserTeamsConversation } from "@/lib/repos/teamConversations.repo";
import { getOrganization } from "@/lib/repos/organizations.repo";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("[TEAMS broadcast] incoming body:", body);

    const { orgId, userIds = [], message = "", imageUrls = [] } = body;

    if (!orgId || !Array.isArray(userIds) || userIds.length === 0) {
      console.warn("[TEAMS broadcast] Missing orgId or userIds");
      return NextResponse.json(
        { error: "Missing orgId or userIds" },
        { status: 400 }
      );
    }

    // allow text OR images (or both)
    if (
      !message.trim() &&
      (!Array.isArray(imageUrls) || imageUrls.length === 0)
    ) {
      console.warn("[TEAMS broadcast] Empty message & no images");
      return NextResponse.json(
        { error: "Message or images must be provided" },
        { status: 400 }
      );
    }

    const org = await getOrganization(orgId);
    console.log("[TEAMS broadcast] org lookup result:", org?.id, org?.name);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 400 }
      );
    }

    const results = [];

    for (const userId of userIds) {
      console.log("[TEAMS broadcast] processing user:", userId);

      const conv = await getUserTeamsConversation(userId);
      console.log("[TEAMS broadcast] conversation row:", conv);

      if (!conv) {
        results.push({
          userId,
          ok: false,
          error: "No Teams conversation found for this user.",
        });
        continue;
      }

      try {
        const token = await getBotToken(conv.tenant_id);
        console.log("[TEAMS broadcast] got token for tenant:", conv.tenant_id);

        const endpoint = `${conv.service_url.replace(
          /\/$/,
          ""
        )}/v3/conversations/${conv.conversation_id}/activities`;

        // build attachments from imageUrls (if any)
        const attachments =
          Array.isArray(imageUrls) && imageUrls.length
            ? imageUrls.map((url) => {
                const lower = url.toLowerCase();
                let contentType = "image/png";
                if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
                  contentType = "image/jpeg";
                else if (lower.endsWith(".gif")) contentType = "image/gif";
                else if (lower.endsWith(".webp")) contentType = "image/webp";

                return {
                  contentType,
                  contentUrl: url,
                  name: url.split("/").pop() || "image",
                };
              })
            : [];

        const payload = {
          type: "message",
          text: message || (attachments.length ? "" : " "), // avoid completely empty text
          ...(attachments.length ? { attachments } : {}),
        };

        console.log("[TEAMS broadcast] POSTing to:", endpoint);
        console.log(
          "[TEAMS broadcast] payload:",
          JSON.stringify(payload, null, 2)
        );

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }

        console.log(
          "[TEAMS broadcast] response for user",
          userId,
          "status:",
          res.status,
          "body:",
          data
        );

        results.push({
          userId,
          ok: res.ok,
          status: res.status,
          data,
        });
      } catch (err) {
        console.error("[TEAMS broadcast] error sending to user", userId, err);
        results.push({
          userId,
          ok: false,
          error: err.message,
        });
      }
    }

    console.log("[TEAMS broadcast] final results:", results);

    return NextResponse.json({
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    console.error("Teams broadcast error (top-level):", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
