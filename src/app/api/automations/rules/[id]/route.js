import { NextResponse } from "next/server";
import {
  assertNoActiveInactivityRuleConflict,
  deleteAutomationRule,
  getAutomationRuleById,
  updateAutomationRule,
} from "@/lib/repos/automationRules.repo";

function normalizeAssistantId(value, fallback) {
  if (value === undefined) return fallback;
  if (value === "" || value === null) return null;
  return Number(value);
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await getAutomationRuleById(id);
    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const patch = {};

    if (body.name !== undefined) patch.name = body.name;
    if (body.trigger_type !== undefined) patch.trigger_type = body.trigger_type;
    if (body.assistant_id !== undefined) {
      patch.assistant_id = normalizeAssistantId(body.assistant_id, null);
    }
    if (body.channel !== undefined) patch.channel = body.channel;
    if (body.delay_minutes !== undefined) {
      patch.delay_minutes = Math.max(0, Number(body.delay_minutes || 0));
    }
    if (body.payload !== undefined) patch.payload = body.payload;
    if (body.is_active !== undefined) patch.is_active = body.is_active;
    if (body.whatsapp_template_id !== undefined) {
      patch.whatsapp_template_id = body.whatsapp_template_id || null;
    }

    const finalRule = {
      ...existing,
      ...patch,
      assistant_id: normalizeAssistantId(
        patch.assistant_id,
        existing.assistant_id ?? null,
      ),
      is_active:
        patch.is_active !== undefined ? patch.is_active : existing.is_active,
      trigger_type: patch.trigger_type ?? existing.trigger_type,
      channel: patch.channel ?? existing.channel,
      organization_id: existing.organization_id,
    };

    if (finalRule.trigger_type === "user.inactive" && finalRule.is_active) {
      await assertNoActiveInactivityRuleConflict({
        organizationId: finalRule.organization_id,
        channel: finalRule.channel,
        assistantId: finalRule.assistant_id,
        excludeRuleId: id,
      });
    }

    const updated = await updateAutomationRule(id, patch);
    return NextResponse.json(updated);
  } catch (error) {
    const status =
      error?.status || (error?.code === "INACTIVITY_RULE_CONFLICT" ? 409 : 500);

    return NextResponse.json(
      { error: error?.message || String(error) },
      { status },
    );
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;
    await deleteAutomationRule(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
