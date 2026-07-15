import {
  assertNoActiveInactivityRuleConflict,
  createAutomationRule,
  deleteAutomationRule,
  getAutomationRuleById,
  getOrgAutomationRules,
  updateAutomationRule,
} from "@/lib/repos/automations/automationRules.repo";

/**
 * Normaliza o ID opcional do assistente.
 *
 * Mantém exatamente o comportamento existente nas API routes:
 * - string vazia, undefined ou null tornam-se null;
 * - qualquer outro valor é convertido para Number.
 */
function normalizeAssistantId(value, fallback = null) {
  if (value === undefined) return fallback;
  if (value === "" || value === null) return null;

  return Number(value);
}

/**
 * Lista as regras de uma organização.
 */
export async function listAutomationRules({
  organizationId,
}) {
  return getOrgAutomationRules(organizationId);
}

/**
 * Cria uma regra de automação.
 *
 * Mantém:
 * - normalização do assistant_id;
 * - is_active=true por defeito;
 * - conflito de user.inactive;
 * - delay mínimo de zero;
 * - payload vazio por defeito;
 * - template null por defeito.
 */
export async function createAutomationRuleFromInput(
  body,
) {
  const organizationId = Number(
    body.organization_id,
  );

  const assistantId = normalizeAssistantId(
    body.assistant_id,
  );

  const isActive = body.is_active ?? true;
  const triggerType = body.trigger_type;
  const channel = body.channel;

  if (
    triggerType === "user.inactive" &&
    isActive
  ) {
    await assertNoActiveInactivityRuleConflict({
      organizationId,
      channel,
      assistantId,
    });
  }

  return createAutomationRule({
    organization_id: organizationId,

    name: body.name,

    trigger_type: triggerType,

    assistant_id: assistantId,

    channel,

    delay_minutes: Math.max(
      0,
      Number(body.delay_minutes || 0),
    ),

    payload: body.payload || {},

    is_active: isActive,

    whatsapp_template_id:
      body.whatsapp_template_id ?? null,
  });
}

/**
 * Atualiza uma regra de automação.
 *
 * Devolve null quando a regra não existe,
 * permitindo à route manter a resposta 404 atual.
 */
export async function updateAutomationRuleFromInput({
  id,
  body,
}) {
  const existing =
    await getAutomationRuleById(id);

  if (!existing) {
    return null;
  }

  const patch = {};

  if (body.name !== undefined) {
    patch.name = body.name;
  }

  if (body.trigger_type !== undefined) {
    patch.trigger_type = body.trigger_type;
  }

  if (body.assistant_id !== undefined) {
    patch.assistant_id =
      normalizeAssistantId(
        body.assistant_id,
        null,
      );
  }

  if (body.channel !== undefined) {
    patch.channel = body.channel;
  }

  if (body.delay_minutes !== undefined) {
    patch.delay_minutes = Math.max(
      0,
      Number(body.delay_minutes || 0),
    );
  }

  if (body.payload !== undefined) {
    patch.payload = body.payload;
  }

  if (body.is_active !== undefined) {
    patch.is_active = body.is_active;
  }

  if (
    body.whatsapp_template_id !== undefined
  ) {
    patch.whatsapp_template_id =
      body.whatsapp_template_id || null;
  }

  const finalRule = {
    ...existing,
    ...patch,

    assistant_id: normalizeAssistantId(
      patch.assistant_id,
      existing.assistant_id ?? null,
    ),

    is_active:
      patch.is_active !== undefined
        ? patch.is_active
        : existing.is_active,

    trigger_type:
      patch.trigger_type ??
      existing.trigger_type,

    channel:
      patch.channel ?? existing.channel,

    organization_id:
      existing.organization_id,
  };

  if (
    finalRule.trigger_type ===
      "user.inactive" &&
    finalRule.is_active
  ) {
    await assertNoActiveInactivityRuleConflict({
      organizationId:
        finalRule.organization_id,

      channel: finalRule.channel,

      assistantId:
        finalRule.assistant_id,

      excludeRuleId: id,
    });
  }

  return updateAutomationRule(id, patch);
}

/**
 * Elimina uma regra de automação.
 */
export async function removeAutomationRule({
  id,
}) {
  await deleteAutomationRule(id);

  return true;
}