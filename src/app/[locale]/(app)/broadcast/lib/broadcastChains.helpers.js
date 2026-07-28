/**
 * Read chains da camada Broadcast.
 *
 * Funções puras. Sem React, sem fetch, sem JSX.
 */

import { makeId } from "./broadcast.base.helpers";
import { sanitizeTrackedKey } from "./broadcastTrackedLinks.helpers";
// Limite máximo permitido para atraso entre mensagens de uma read chain.
// Mantemos este valor centralizado para garantir consistência entre validação e UI.
export const MAX_CHAIN_DELAY_MINUTES = 10080; // 7 days
export const MAX_CHAIN_DELAY_HOURS = 168;

/**
 * Cria um step vazio de read chain.
 *
 * Cada step representa uma mensagem da sequência, com texto,
 * anexos, links rastreados e atraso após a leitura anterior.
 */
export function makeChainStep(overrides = {}) {
  return {
    id: makeId(),
    message: "",
    files: [],
    trackedLinks: [],
    selectedTrackedUrlKey: "",
    delayAfterPreviousReadMinutes: 0,
    ...overrides,
  };
}

/**
 * Formata a descrição do atraso entre mensagens de uma read chain.
 *
 * Usa traduções para apresentar minutos, horas ou ambos.
 */
export function formatDelayLabel(minutes, translation) {
  const value = Number(minutes || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return translation("Broadcast.broadcastChain.chainNoDelay");
  }

  const hours = Math.floor(value / 60);
  const remainingMinutes = value % 60;

  if (hours === 0) {
    return translation("Broadcast.broadcastChain.chainDelayMinutes", {
      minutes: remainingMinutes,
    });
  }

  if (remainingMinutes === 0) {
    return translation("Broadcast.broadcastChain.chainDelayHours", {
      hours,
    });
  }

  return translation("Broadcast.broadcastChain.chainDelayMinutesHours", {
    minutes: remainingMinutes,
    hours,
  });
}

/**
 * Divide um atraso em minutos em horas e minutos.
 *
 * Usado pelos inputs da UI para editar atrasos de read chains.
 */
export function splitDelayMinutes(totalMinutes) {
  const total = Number(totalMinutes || 0);

  if (!Number.isFinite(total) || total <= 0) {
    return {
      hours: 0,
      minutes: 0,
    };
  }

  return {
    hours: Math.floor(total / 60),
    minutes: total % 60,
  };
}

/**
 * Normaliza o atraso de um step em minutos.
 *
 * Garante que o valor é numérico e fica dentro dos limites aceites.
 */
export function normalizeDelayMinutes(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }

  return Math.min(Math.floor(number), MAX_CHAIN_DELAY_MINUTES);
}

/**
 * Valida se o atraso de um step está dentro dos limites aceites.
 *
 * O primeiro step não precisa de atraso porque inicia a sequência.
 */
export function chainStepDelayValid(step, index) {
  if (index === 0) return true;

  const value = Number(step.delayAfterPreviousReadMinutes || 0);

  return (
    Number.isFinite(value) && value >= 0 && value <= MAX_CHAIN_DELAY_MINUTES
  );
}

/**
 * Verifica se um step tem conteúdo suficiente para ser enviado.
 *
 * Cada step precisa de texto ou pelo menos um anexo.
 */
export function chainStepHasContent(step) {
  return (
    String(step.message || "").trim().length > 0 ||
    (Array.isArray(step.files) && step.files.length > 0)
  );
}

/**
 * Normaliza os tracked links de um step de read chain.
 *
 * Remove links incompletos antes de construir o payload final.
 */
export function normalizeTrackedLinksForStep(step) {
  return (step.trackedLinks || [])
    .map((link) => ({
      key: sanitizeTrackedKey(link.key),
      label: String(link.label || "").trim(),
      destinationUrl: String(link.destinationUrl || "").trim(),
    }))
    .filter((link) => link.key && link.label && link.destinationUrl);
}

/**
 * Valida se os tracked links de um step estão completos e sem duplicados.
 */
export function trackedLinksValidForStep(step) {
  const normalized = normalizeTrackedLinksForStep(step);

  return (
    normalized.length === (step.trackedLinks || []).length &&
    new Set(normalized.map((link) => link.key)).size === normalized.length
  );
}

/**
 * Valida se uma read chain pode ser enviada ou agendada.
 *
 * Regras principais:
 * - a feature tem de estar ativa para a organização;
 * - o canal tem de ser WhatsApp;
 * - tem de existir template fallback válido;
 * - a chain deve ter o número permitido de steps;
 * - cada step precisa de conteúdo válido;
 * - os tracked links dos steps têm de estar válidos;
 * - os atrasos têm de estar dentro dos limites.
 */
export function isReadChainValid({
  chainMode,
  readChainsFeatureEnabled,
  channel,
  hasFallbackTemplate,
  chainSteps,
}) {
  if (!chainMode) return true;

  const steps = Array.isArray(chainSteps) ? chainSteps : [];

  return (
    Boolean(readChainsFeatureEnabled) &&
    channel === "whatsapp" &&
    Boolean(hasFallbackTemplate) &&
    steps.length >= 2 &&
    steps.length <= 10 &&
    steps.every(chainStepHasContent) &&
    steps.every(trackedLinksValidForStep) &&
    steps.every(chainStepDelayValid)
  );
}
