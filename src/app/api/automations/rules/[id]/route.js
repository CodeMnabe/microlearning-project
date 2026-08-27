import { NextResponse } from "next/server";
import {
  assertNoActiveInactivityRuleConflict,
  deleteAutomationRule,
  updateAutomationRule,
} from "@/lib/repos/automationRules.repo";
import {
  assertAssistantBelongsToOrg,
  assertWhatsappTemplateBelongsToOrg,
  requireOrgForAutomationRule,
} from "@/lib/auth/guards";
import { sanitizeAutomationPayload } from "@/lib/services/automations/automationEngine";

function normalizeAssistantId(value, fallback) {
  if (value === undefined) return fallback;
  if (value === "" || value === null) return null;
  return Number(value);
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const orgAuth = await requireOrgForAutomationRule(id);
    if (orgAuth.error) return orgAuth.error;

    const existing = orgAuth.rule;
    const patch = {};

    if (body.name !== undefined) patch.name = body.name;
    if (body.trigger_type !== undefined) patch.trigger_type = body.trigger_type;

    if (body.assistant_id !== undefined) {
      patch.assistant_id = normalizeAssistantId(body.assistant_id, null);

      patch.assistant_id = await assertAssistantBelongsToOrg(
        orgAuth.admin,
        orgAuth.orgId,
        patch.assistant_id,
      );
    }

    if (body.channel !== undefined) patch.channel = body.channel;

    if (body.delay_minutes !== undefined) {
      patch.delay_minutes = Math.max(0, Number(body.delay_minutes || 0));
    }

    if (body.payload !== undefined) {
      patch.payload = sanitizeAutomationPayload(body.payload);
    }
    if (body.is_active !== undefined) patch.is_active = body.is_active;

    if (body.whatsapp_template_id !== undefined) {
      patch.whatsapp_template_id = await assertWhatsappTemplateBelongsToOrg(
        orgAuth.admin,
        orgAuth.orgId,
        body.whatsapp_template_id,
      );
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
      organization_id: orgAuth.orgId,
    };

    if (finalRule.trigger_type === "user.inactive" && finalRule.is_active) {
      await assertNoActiveInactivityRuleConflict({
        organizationId: orgAuth.orgId,
        channel: finalRule.channel,
        assistantId: finalRule.assistant_id,
        excludeRuleId: orgAuth.ruleId,
      });
    }

    const updated = await updateAutomationRule(orgAuth.ruleId, patch);
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

    const orgAuth = await requireOrgForAutomationRule(id);
    if (orgAuth.error) return orgAuth.error;

    await deleteAutomationRule(orgAuth.ruleId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
