import { getUserById } from "@/lib/repos/user.repo";
import { getActiveAutomationRules } from "@/lib/repos/automationRules.repo";
import { createAutomationRunIfMissing } from "@/lib/repos/automationRuns.repo";

function addMinutes(baseTime, minutes) {
  const date = new Date(baseTime);
  return new Date(date.getTime() + Number(minutes || 0) * 60 * 1000);
}

function hasWhatsappDestination(user) {
  return Boolean(
    user?.phone_number || (user?.phone_country_code && user?.phone_national),
  );
}

function hasTeamsIdentity(user) {
  return Boolean(
    user?.teams_aad_object_id || user?.teams_from_id || user?.email,
  );
}

function buildDefaultTriggerKey({
  type,
  userId,
  assistantId = null,
  sourceMessageRowId = null,
}) {
  if (type === "user.created") {
    return `user.created:${userId}`;
  }

  if (type === "message.read" || type === "message.unread") {
    return `${type}:${sourceMessageRowId ?? userId}`;
  }

  return `${type}:${userId}:${assistantId ?? "none"}:${sourceMessageRowId ?? "none"}`;
}

function shouldRuleApplyToContext({ rule, user, assistantId }) {
  const userAssistantId = user?.assistant_id ?? null;
  const contextAssistantId = assistantId ?? userAssistantId;

  if (rule.assistant_id != null) {
    if (contextAssistantId == null) return false;
    if (Number(rule.assistant_id) !== Number(contextAssistantId)) return false;
  }

  if (rule.channel === "whatsapp" && !hasWhatsappDestination(user)) {
    return false;
  }

  if (rule.channel === "teams" && !hasTeamsIdentity(user)) {
    return false;
  }

  return true;
}

export async function queueAutomationRunForRule({
  rule,
  user,
  userId,
  assistantId = null,
  sourceMessageRowId = null,
  baseTime = new Date(),
  triggerKey = null,
  payload = {},
}) {
  const effectiveUser = user ?? (await getUserById(userId));
  if (!effectiveUser) return null;

  if (!shouldRuleApplyToContext({ rule, user: effectiveUser, assistantId })) {
    return null;
  }

  const effectiveAssistantId =
    assistantId ?? effectiveUser.assistant_id ?? null;

  const effectiveTriggerKey =
    triggerKey ||
    buildDefaultTriggerKey({
      type: rule.trigger_type,
      userId: effectiveUser.id,
      assistantId: effectiveAssistantId,
      sourceMessageRowId,
    });

  const scheduledFor = addMinutes(baseTime, rule.delay_minutes).toISOString();

  const mergedPayload = {
    ...(rule.payload || {}),
    whatsappTemplateId: rule.whatsapp_template_id ?? null,
    _automation: {
      triggerType: rule.trigger_type,
      triggerAt: new Date(baseTime).toISOString(),
      sourceMessageRowId: sourceMessageRowId ?? null,
      eventPayload: payload,
    },
  };

  return await createAutomationRunIfMissing({
    rule_id: rule.id,
    organization_id: rule.organization_id,
    user_id: effectiveUser.id,
    assistant_id: effectiveAssistantId,
    channel: rule.channel,
    trigger_type: rule.trigger_type,
    trigger_key: effectiveTriggerKey,
    source_message_row_id: sourceMessageRowId,
    scheduled_for: scheduledFor,
    payload: mergedPayload,
  });
}

export async function emitAutomationEvent({
  type,
  organizationId,
  userId,
  assistantId = null,
  sourceMessageRowId = null,
  baseTime = new Date(),
  triggerKey = null,
  payload = {},
}) {
  const user = await getUserById(userId);
  if (!user) return [];

  const rules = await getActiveAutomationRules({
    organizationId,
    triggerType: type,
  });

  if (!rules.length) return [];

  const createdRuns = [];

  for (const rule of rules) {
    const run = await queueAutomationRunForRule({
      rule,
      user,
      assistantId,
      sourceMessageRowId,
      baseTime,
      triggerKey,
      payload,
    });

    if (run) {
      createdRuns.push(run);
    }
  }

  return createdRuns;
}
