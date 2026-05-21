import { NextResponse } from "next/server";
import { getActiveAutomationRules } from "@/lib/repos/automationRules.repo";
import { getUsersInOrg } from "@/lib/repos/user.repo";
import { getLastInboundForUserAssistant } from "@/lib/repos/messages.repo";
import { queueAutomationRunForRule } from "@/lib/services/automations/automationEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 500;

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const xCronSecret = req.headers.get("x-cron-secret") || "";

  return bearer === cronSecret || xCronSecret === cronSecret;
}

function buildRuleResolver(rules) {
  const specificByAssistant = new Map();
  let fallbackRule = null;

  for (const rule of rules) {
    if (rule.assistant_id == null) {
      fallbackRule = rule;
      continue;
    }

    specificByAssistant.set(Number(rule.assistant_id), rule);
  }

  return { specificByAssistant, fallbackRule };
}

async function processOrganizationChannel({ organizationId, channel, rules }) {
  let page = 1;
  let scanned = 0;
  let created = 0;
  let skipped = 0;

  const { specificByAssistant, fallbackRule } = buildRuleResolver(rules);

  while (true) {
    const result = await getUsersInOrg(organizationId, {
      page,
      pageSize: PAGE_SIZE,
    });

    const users = result.items || [];
    if (!users.length) break;

    for (const user of users) {
      scanned += 1;

      const userAssistantId = user.assistant_id ?? null;

      if (userAssistantId == null) {
        skipped += 1;
        continue;
      }

      const chosenRule =
        specificByAssistant.get(Number(userAssistantId)) ||
        fallbackRule ||
        null;

      if (!chosenRule) {
        skipped += 1;
        continue;
      }

      const lastInbound = await getLastInboundForUserAssistant(
        user.id,
        userAssistantId,
        channel,
      );

      if (!lastInbound) {
        skipped += 1;
        continue;
      }

      const dueAt = new Date(
        new Date(lastInbound.created_at).getTime() +
          Number(chosenRule.delay_minutes || 0) * 60 * 1000,
      );

      if (dueAt > new Date()) {
        skipped += 1;
        continue;
      }

      const triggerKey = `user.inactive:${channel}:${user.id}:${userAssistantId}:${lastInbound.id}`;

      const run = await queueAutomationRunForRule({
        rule: chosenRule,
        user,
        assistantId: userAssistantId,
        sourceMessageRowId: lastInbound.id,
        baseTime: lastInbound.created_at,
        triggerKey,
        payload: {
          lastInboundMessageId: lastInbound.id,
          lastInboundAt: lastInbound.created_at,
          resolvedByRuleId: chosenRule.id,
          ruleScopeAssistantId: chosenRule.assistant_id ?? null,
          usedFallbackRule: chosenRule.assistant_id == null,
        },
      });

      if (run) {
        created += 1;
      } else {
        skipped += 1;
      }
    }

    if (page * PAGE_SIZE >= (result.total || 0)) {
      break;
    }

    page += 1;
  }

  return {
    organizationId,
    channel,
    scanned,
    created,
    skipped,
    specificRules: specificByAssistant.size,
    hasFallbackRule: Boolean(fallbackRule),
  };
}

async function handler(req) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let limitOrganizations = null;

    try {
      const url = new URL(req.url);
      const raw = url.searchParams.get("organizationId");
      if (raw) {
        limitOrganizations = Number(raw);
      }
    } catch {
      // ignore this error
    }

    let rules = await getActiveAutomationRules({
      triggerType: "user.inactive",
    });

    if (limitOrganizations) {
      rules = rules.filter(
        (rule) => Number(rule.organization_id) === Number(limitOrganizations),
      );
    }

    if (!rules.length) {
      return NextResponse.json({
        ok: true,
        message: "No active inactivity rules",
        processedGroups: 0,
        results: [],
      });
    }

    const grouped = new Map();

    for (const rule of rules) {
      const key = `${rule.organization_id}:${rule.channel}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(rule);
    }

    const results = [];

    for (const groupRules of grouped.values()) {
      const organizationId = Number(groupRules[0].organization_id);
      const channel = groupRules[0].channel;

      results.push(
        await processOrganizationChannel({
          organizationId,
          channel,
          rules: groupRules,
        }),
      );
    }

    return NextResponse.json({
      ok: true,
      processedGroups: results.length,
      createdRuns: results.reduce((sum, item) => sum + item.created, 0),
      scannedUsers: results.reduce((sum, item) => sum + item.scanned, 0),
      skipped: results.reduce((sum, item) => sum + item.skipped, 0),
      results,
    });
  } catch (error) {
    console.error("[Automations][Inactivity]", error);
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  return handler(req);
}

export async function POST(req) {
  return handler(req);
}
