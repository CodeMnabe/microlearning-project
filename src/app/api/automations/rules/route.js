import { NextResponse } from "next/server";
import {
  assertNoActiveInactivityRuleConflict,
  createAutomationRule,
  getOrgAutomationRules,
} from "@/lib/repos/automationRules.repo";

function normalizeAssistantId(value) {
  if (value === "" || value === undefined || value === null) return null;
  return Number(value);
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = Number(searchParams.get("orgId"));

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const items = await getOrgAutomationRules(orgId);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const organizationId = Number(body.organization_id);
    const assistantId = normalizeAssistantId(body.assistant_id);
    const isActive = body.is_active ?? true;
    const triggerType = body.trigger_type;
    const channel = body.channel;

    if (!organizationId || !body.name || !triggerType || !channel) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: organization_id, name, trigger_type, channel",
        },
        { status: 400 },
      );
    }

    if (triggerType === "user.inactive" && isActive) {
      await assertNoActiveInactivityRuleConflict({
        organizationId,
        channel,
        assistantId,
      });
    }

    const row = await createAutomationRule({
      organization_id: organizationId,
      name: body.name,
      trigger_type: triggerType,
      assistant_id: assistantId,
      channel,
      delay_minutes: Math.max(0, Number(body.delay_minutes || 0)),
      payload: body.payload || {},
      is_active: isActive,
      whatsapp_template_id: body.whatsapp_template_id ?? null,
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const status =
      error?.status || (error?.code === "INACTIVITY_RULE_CONFLICT" ? 409 : 500);

    return NextResponse.json(
      { error: error?.message || String(error) },
      { status },
    );
  }
}
