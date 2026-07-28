"use client";

import { useMemo } from "react";

import { formatHour, formatMinute } from "../lib";
/**
 * Prepara pequenos valores derivados usados pela UI.
 *
 * Exemplos:
 * - hora apresentada no preview do template;
 * - label do botão de agendamento;
 * - label do botão de template.
 *
 * Mantém estes cálculos fora da page para reduzir ruído visual.
 */

export function useBroadcastUiState({
  deliveryMode,
  scheduledFor,
  channel,
  tplName,
  translation,
}) {
  const previewTime = useMemo(
    () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const scheduleButtonLabel =
    deliveryMode === "schedule"
      ? `${scheduledFor.toLocaleDateString()} ${formatHour(
          scheduledFor,
        )}:${formatMinute(scheduledFor)}`
      : translation("Broadcast.sendnow");

  const templateButtonLabel =
    channel === "whatsapp" && tplName ? tplName : "No template";

  return {
    previewTime,
    scheduleButtonLabel,
    templateButtonLabel,
  };
}
