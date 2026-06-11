export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function countRows(table, applyFilters) {
  let query = supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });

  if (typeof applyFilters === "function") {
    query = applyFilters(query);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function fetchRows(table, columns, applyFilters) {
  let query = supabaseAdmin.from(table).select(columns);

  if (typeof applyFilters === "function") {
    query = applyFilters(query);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data ?? [];
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function sumNumbers(items, key) {
  return items.reduce((sum, item) => {
    const value = Number(item?.[key] ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

async function getTrackedLinkMetrics(orgId) {
  const trackedLinks = await fetchRows("tracked_link", "id", (q) =>
    q.eq("org_id", orgId)
  );

  const trackedLinkIds = trackedLinks.map((link) => link.id);

  if (trackedLinkIds.length === 0) {
    return {
      totalLinks: 0,
      totalClicks: 0,
    };
  }

  const totalClicks = await countRows("tracked_link_event", (q) =>
    q.eq("event_type", "click").in("tracked_link_id", trackedLinkIds)
  );

  return {
    totalLinks: trackedLinkIds.length,
    totalClicks,
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));

    if (!orgId || Number.isNaN(orgId)) {
      return NextResponse.json(
        { error: "Missing or invalid orgId" },
        { status: 400 }
      );
    }

    const [
      users,
      assistantsTotal,
      assistantsWithoutOpenAiId,
      templatesTotal,
      templatesActive,
      templatesPending,
      templatesRejected,
      messagesTotal,
      whatsappMessages,
      teamsMessages,
      userMessages,
      assistantMessages,
      deliveredMessages,
      readMessages,
      failedMessages,
      automationRulesTotal,
      automationRulesActive,
      automationRunsTotal,
      automationRunsProcessed,
      automationRunsFailed,
      scheduledBroadcastRows,
      pendingOutreachTotal,
      pendingOutreachActive,
      trackedLinks,
    ] = await Promise.all([
      fetchRows(
        "user",
        `
          id,
          assistant_id,
          email,
          phone_number,
          phone_country_code,
          phone_national,
          teams_aad_object_id,
          teams_from_id,
          whatsapp_bsuid,
          bird_contact_id
        `,
        (q) => q.eq("organization_id", orgId)
      ),

      countRows("assistant", (q) => q.eq("organization_id", orgId)),

      countRows("assistant", (q) =>
        q.eq("organization_id", orgId).or("open_ai_id.is.null,open_ai_id.eq.")
      ),

      countRows("whatsapp_templates", (q) =>
        q.or(`org_id.eq.${orgId},org_id.is.null`)
      ),

      countRows("whatsapp_templates", (q) =>
        q
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .in("status", ["ACTIVE", "active", "APPROVED", "approved"])
      ),

      countRows("whatsapp_templates", (q) =>
        q
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .in("status", [
            "PENDING",
            "pending",
            "NEW",
            "new",
            "DRAFT",
            "draft",
            "PENDINGREVIEW",
            "pendingreview",
          ])
      ),

      countRows("whatsapp_templates", (q) =>
        q
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .in("status", ["REJECTED", "rejected", "INACTIVE", "inactive"])
      ),

      countRows("message", (q) => q.eq("organization_id", orgId)),

      countRows("message", (q) =>
        q.eq("organization_id", orgId).eq("channel", "whatsapp")
      ),

      countRows("message", (q) =>
        q.eq("organization_id", orgId).eq("channel", "teams")
      ),

      countRows("message", (q) =>
        q.eq("organization_id", orgId).eq("role", "user")
      ),

      countRows("message", (q) =>
        q.eq("organization_id", orgId).eq("role", "assistant")
      ),

      countRows("message", (q) =>
        q.eq("organization_id", orgId).not("delivered_at", "is", null)
      ),

      countRows("message", (q) =>
        q.eq("organization_id", orgId).not("read_at", "is", null)
      ),

      countRows("message", (q) =>
        q.eq("organization_id", orgId).not("failed_at", "is", null)
      ),

      countRows("automation_rule", (q) => q.eq("organization_id", orgId)),

      countRows("automation_rule", (q) =>
        q.eq("organization_id", orgId).eq("is_active", true)
      ),

      countRows("automation_run", (q) => q.eq("organization_id", orgId)),

      countRows("automation_run", (q) =>
        q.eq("organization_id", orgId).not("processed_at", "is", null)
      ),

      countRows("automation_run", (q) =>
        q.eq("organization_id", orgId).not("last_error", "is", null)
      ),

      fetchRows(
        "scheduled_broadcast",
        "id, status, channel, recipient_count",
        (q) => q.eq("organization_id", orgId)
      ),

      countRows("pending_outreach", (q) => q.eq("org_id", orgId)),

      countRows("pending_outreach", (q) =>
        q.eq("org_id", orgId).in("status", ["pending", "queued", "active"])
      ),

      getTrackedLinkMetrics(orgId),
    ]);

    const totalUsers = users.length;

    const usersWithAssistant = users.filter((user) =>
      hasValue(user.assistant_id)
    ).length;

    const usersWithEmail = users.filter((user) => hasValue(user.email)).length;

    const usersWithPhone = users.filter(
      (user) =>
        hasValue(user.phone_number) ||
        (hasValue(user.phone_country_code) && hasValue(user.phone_national))
    ).length;

    const usersWithTeams = users.filter(
      (user) =>
        hasValue(user.teams_aad_object_id) || hasValue(user.teams_from_id)
    ).length;

    const usersWithWhatsapp = users.filter(
      (user) =>
        hasValue(user.whatsapp_bsuid) ||
        hasValue(user.bird_contact_id) ||
        hasValue(user.phone_number)
    ).length;

    const scheduledBroadcastsTotal = scheduledBroadcastRows.length;

    const scheduledBroadcastsQueued = scheduledBroadcastRows.filter((item) =>
      ["queued", "pending", "scheduled"].includes(
        String(item.status || "").toLowerCase()
      )
    ).length;

    const scheduledBroadcastsCompleted = scheduledBroadcastRows.filter((item) =>
      ["completed", "sent", "done"].includes(
        String(item.status || "").toLowerCase()
      )
    ).length;

    const scheduledBroadcastsFailed = scheduledBroadcastRows.filter((item) =>
      ["failed", "error"].includes(String(item.status || "").toLowerCase())
    ).length;

    const scheduledBroadcastRecipients = sumNumbers(
      scheduledBroadcastRows,
      "recipient_count"
    );

    return NextResponse.json({
      ok: true,

      users: {
        total: totalUsers,
        withAssistant: usersWithAssistant,
        withoutAssistant: Math.max(0, totalUsers - usersWithAssistant),
        withEmail: usersWithEmail,
        withPhone: usersWithPhone,
        withTeams: usersWithTeams,
        withWhatsapp: usersWithWhatsapp,
      },

      assistants: {
        total: assistantsTotal,
        withoutOpenAiId: assistantsWithoutOpenAiId,
      },

      templates: {
        total: templatesTotal,
        active: templatesActive,
        pending: templatesPending,
        rejected: templatesRejected,
      },

      messages: {
        total: messagesTotal,
        whatsapp: whatsappMessages,
        teams: teamsMessages,
        userMessages,
        assistantMessages,
        delivered: deliveredMessages,
        read: readMessages,
        failed: failedMessages,
      },

      automations: {
        rulesTotal: automationRulesTotal,
        rulesActive: automationRulesActive,
        rulesPaused: Math.max(0, automationRulesTotal - automationRulesActive),
        runsTotal: automationRunsTotal,
        runsProcessed: automationRunsProcessed,
        runsFailed: automationRunsFailed,
      },

      scheduledBroadcasts: {
        total: scheduledBroadcastsTotal,
        queued: scheduledBroadcastsQueued,
        completed: scheduledBroadcastsCompleted,
        failed: scheduledBroadcastsFailed,
        recipientCount: scheduledBroadcastRecipients,
      },

      pendingOutreach: {
        total: pendingOutreachTotal,
        active: pendingOutreachActive,
      },

      trackedLinks,
    });
  } catch (err) {
    console.error("[analytics/overview] error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Failed to load analytics overview",
      },
      { status: 500 }
    );
  }
}