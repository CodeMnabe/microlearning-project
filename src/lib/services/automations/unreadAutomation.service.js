import {
  getActiveAutomationRules,
} from "@/lib/repos/automations/automationRules.repo";

import {
  getUsersInOrg,
} from "@/lib/repos/user.repo";

import {
  getInboundAfterForUserAssistant,
  getLastOutboundForUserAssistant,
} from "@/lib/repos/messages.repo";

import {
  queueAutomationRunForRule,
} from "@/lib/services/automations/automationEngine";

const PAGE_SIZE = 500;
const TRIGGER_TYPE = "message.unread";

/**
 * Organiza as regras por âmbito de assistente.
 *
 * - Regras com assistant_id são específicas.
 * - Uma regra sem assistant_id funciona como fallback.
 *
 * Mantém exatamente a lógica anteriormente existente
 * na route do cron message.unread.
 */
function buildRuleResolver(rules) {
  const specificByAssistant = new Map();
  let fallbackRule = null;

  for (const rule of rules) {
    if (rule.assistant_id == null) {
      fallbackRule = rule;
      continue;
    }

    specificByAssistant.set(
      Number(rule.assistant_id),
      rule,
    );
  }

  return {
    specificByAssistant,
    fallbackRule,
  };
}

/**
 * Obtém o estado normalizado de uma mensagem.
 */
function getMessageStatus(message) {
  return String(
    message?.status ||
      message?.delivery_status ||
      message?.deliveryStatus ||
      message?.message_status ||
      "",
  ).toLowerCase();
}

/**
 * Verifica se a mensagem já possui confirmação de leitura.
 */
function hasReadReceipt(message) {
  const status = getMessageStatus(message);

  return Boolean(
    message?.read_at ||
      message?.readAt ||
      message?.read_timestamp ||
      message?.readTimestamp ||
      status === "read",
  );
}

/**
 * Verifica se a mensagem outbound falhou.
 */
function isFailedOutbound(message) {
  const status = getMessageStatus(message);

  return [
    "failed",
    "error",
    "undelivered",
    "rejected",
    "cancelled",
    "canceled",
  ].includes(status);
}

/**
 * Verifica se a mensagem ainda está pendente.
 */
function isPendingOutbound(message) {
  const status = getMessageStatus(message);

  return [
    "queued",
    "pending",
    "scheduled",
    "processing",
  ].includes(status);
}

/**
 * Obtém a data base utilizada para calcular o delay.
 */
function getOutboundBaseTime(message) {
  return (
    message?.sent_at ||
    message?.sentAt ||
    message?.delivered_at ||
    message?.deliveredAt ||
    message?.created_at ||
    message?.createdAt ||
    null
  );
}

/**
 * Obtém os metadados disponíveis na mensagem.
 */
function getMetadata(message) {
  const metadata =
    message?.metadata ||
    message?.payload ||
    {};

  if (
    !metadata ||
    typeof metadata !== "object"
  ) {
    return {};
  }

  return metadata;
}

/**
 * Verifica se a mensagem outbound foi enviada
 * pela mesma regra que está a ser avaliada.
 */
function wasSentBySameAutomationRule(
  message,
  rule,
) {
  const metadata = getMetadata(message);

  const messageRuleId =
    message?.automation_rule_id ||
    message?.automationRuleId ||
    metadata?.automation_rule_id ||
    metadata?.automationRuleId ||
    metadata?.resolvedByRuleId ||
    metadata?.resolvedRuleId ||
    null;

  if (
    messageRuleId == null ||
    rule?.id == null
  ) {
    return false;
  }

  return (
    Number(messageRuleId) ===
    Number(rule.id)
  );
}

/**
 * Processa os utilizadores de uma organização
 * para um determinado canal.
 *
 * A lógica foi movida diretamente da route,
 * sem alterações funcionais.
 */
async function processOrganizationChannel({
  organizationId,
  channel,
  rules,
}) {
  let page = 1;
  let scanned = 0;
  let created = 0;
  let skipped = 0;

  const {
    specificByAssistant,
    fallbackRule,
  } = buildRuleResolver(rules);

  while (true) {
    const result = await getUsersInOrg(
      organizationId,
      {
        page,
        pageSize: PAGE_SIZE,
      },
    );

    const users = result.items || [];

    if (!users.length) {
      break;
    }

    for (const user of users) {
      scanned += 1;

      const userAssistantId =
        user.assistant_id ?? null;

      if (userAssistantId == null) {
        skipped += 1;
        continue;
      }

      const chosenRule =
        specificByAssistant.get(
          Number(userAssistantId),
        ) ||
        fallbackRule ||
        null;

      if (!chosenRule) {
        skipped += 1;
        continue;
      }

      const lastOutbound =
        await getLastOutboundForUserAssistant(
          user.id,
          userAssistantId,
          channel,
        );

      if (!lastOutbound) {
        skipped += 1;
        continue;
      }

      if (hasReadReceipt(lastOutbound)) {
        skipped += 1;
        continue;
      }

      if (isFailedOutbound(lastOutbound)) {
        skipped += 1;
        continue;
      }

      if (isPendingOutbound(lastOutbound)) {
        skipped += 1;
        continue;
      }

      if (
        wasSentBySameAutomationRule(
          lastOutbound,
          chosenRule,
        )
      ) {
        skipped += 1;
        continue;
      }

      const outboundBaseTime =
        getOutboundBaseTime(lastOutbound);

      if (!outboundBaseTime) {
        skipped += 1;
        continue;
      }

      const newerInbound =
        await getInboundAfterForUserAssistant(
          user.id,
          userAssistantId,
          channel,
          outboundBaseTime,
        );

      if (newerInbound) {
        skipped += 1;
        continue;
      }

      const dueAt = new Date(
        new Date(
          outboundBaseTime,
        ).getTime() +
          Number(
            chosenRule.delay_minutes || 0,
          ) *
            60 *
            1000,
      );

      if (dueAt > new Date()) {
        skipped += 1;
        continue;
      }

      const triggerKey =
        `${TRIGGER_TYPE}:` +
        `${channel}:` +
        `${user.id}:` +
        `${userAssistantId}:` +
        `${lastOutbound.id}`;

      const run =
        await queueAutomationRunForRule({
          rule: chosenRule,

          user,

          assistantId:
            userAssistantId,

          sourceMessageRowId:
            lastOutbound.id,

          baseTime:
            outboundBaseTime,

          triggerKey,

          payload: {
            lastOutboundMessageId:
              lastOutbound.id,

            lastOutboundExternalMessageId:
              lastOutbound.message_id ||
              lastOutbound
                .external_message_id ||
              null,

            lastOutboundAt:
              outboundBaseTime,

            lastOutboundStatus:
              getMessageStatus(
                lastOutbound,
              ) || null,

            resolvedByRuleId:
              chosenRule.id,

            ruleScopeAssistantId:
              chosenRule.assistant_id ??
              null,

            usedFallbackRule:
              chosenRule.assistant_id ==
              null,
          },
        });

      if (run) {
        created += 1;
      } else {
        skipped += 1;
      }
    }

    if (
      page * PAGE_SIZE >=
      (result.total || 0)
    ) {
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

    specificRules:
      specificByAssistant.size,

    hasFallbackRule:
      Boolean(fallbackRule),
  };
}

/**
 * Processa todas as regras ativas message.unread.
 *
 * organizationId é opcional e corresponde ao filtro
 * já aceite anteriormente pela route.
 */
export async function processUnreadAutomations({
  organizationId = null,
} = {}) {
  let rules =
    await getActiveAutomationRules({
      triggerType: TRIGGER_TYPE,
    });

  if (organizationId) {
    rules = rules.filter(
      (rule) =>
        Number(rule.organization_id) ===
        Number(organizationId),
    );
  }

  if (!rules.length) {
    return {
      ok: true,

      message:
        "No active message.unread rules",

      processedGroups: 0,

      results: [],
    };
  }

  const grouped = new Map();

  for (const rule of rules) {
    const key =
      `${rule.organization_id}:` +
      `${rule.channel}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(rule);
  }

  const results = [];

  for (const groupRules of grouped.values()) {
    const groupOrganizationId = Number(
      groupRules[0].organization_id,
    );

    const channel =
      groupRules[0].channel;

    results.push(
      await processOrganizationChannel({
        organizationId:
          groupOrganizationId,

        channel,

        rules: groupRules,
      }),
    );
  }

  return {
    ok: true,

    processedGroups:
      results.length,

    createdRuns: results.reduce(
      (sum, item) =>
        sum + item.created,
      0,
    ),

    scannedUsers: results.reduce(
      (sum, item) =>
        sum + item.scanned,
      0,
    ),

    skipped: results.reduce(
      (sum, item) =>
        sum + item.skipped,
      0,
    ),

    results,
  };
}