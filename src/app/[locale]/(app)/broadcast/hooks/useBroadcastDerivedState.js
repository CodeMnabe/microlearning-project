"use client";

import { useCallback, useMemo } from "react";

import {
  buildBroadcastPayload,
  buildFallbackTemplatePayload,
  buildReadChainPayload,
  isReadChainValid,
} from "../lib";
/**
 * Calcula estado derivado necessário para envio e agendamento.
 *
 * Responsabilidades:
 * - verificar se existe template fallback válido;
 * - validar se a read chain está completa;
 * - calcular se o botão principal pode ser ativado;
 * - construir payloads de broadcast normal;
 * - construir payloads de read chain.
 *
 * Este hook não envia dados.
 * Apenas prepara valores e funções usados pelas ações principais.
 */

export function useBroadcastDerivedState({
  channel,
  orgId,
  createdByUserId,

  selectedCount,
  scheduleInvalid,

  chainMode,
  readChainsFeatureEnabled,
  chainSteps,

  tplName,
  tplLang,
  paramsComplete,
  chosenTemplate,
  orderedParamValues,
  varDefs,
  tplParamsManual,
  needsUrlVar,

  composerMessage,
  composerFiles,
  composerSelectedTrackedUrlKey,

  imageUrls,
  normalizedTrackedLinks,
  trackedLinksValid,
  whatsappUrlBindingValid,
}) {
  const hasFallbackTemplate =
    channel === "whatsapp" && tplName && tplLang && paramsComplete;

  const chainValid = useMemo(
    () =>
      isReadChainValid({
        chainMode,
        readChainsFeatureEnabled,
        channel,
        hasFallbackTemplate,
        chainSteps,
      }),
    [
      chainMode,
      readChainsFeatureEnabled,
      channel,
      hasFallbackTemplate,
      chainSteps,
    ],
  );

  const baseCanSend =
    selectedCount > 0 &&
    (chainMode
      ? chainValid
      : trackedLinksValid &&
        whatsappUrlBindingValid &&
        (channel === "whatsapp"
          ? (tplName && tplLang && paramsComplete) ||
            composerMessage.trim().length > 0 ||
            composerFiles.length > 0
          : composerMessage.trim().length > 0 || composerFiles.length > 0));

  const canSend = baseCanSend && !scheduleInvalid;

  const getFallbackTemplatePayload = useCallback(() => {
    return buildFallbackTemplatePayload({
      chosenTemplate,
      tplName,
      tplLang,
      paramsComplete,
      orderedParamValues,
      varDefs,
      tplParamsManual,
      needsUrlVar,
      selectedTrackedUrlKey: composerSelectedTrackedUrlKey,
    });
  }, [
    chosenTemplate,
    tplName,
    tplLang,
    paramsComplete,
    orderedParamValues,
    varDefs,
    tplParamsManual,
    needsUrlVar,
    composerSelectedTrackedUrlKey,
  ]);

  const buildBroadcastPayloadForRecipients = useCallback(
    (chosen) => {
      return buildBroadcastPayload({
        channel,
        orgId,
        users: chosen,
        message: composerMessage,
        imageUrls,
        files: composerFiles,
        trackedLinks: normalizedTrackedLinks,
        template: getFallbackTemplatePayload(),
      });
    },
    [
      channel,
      orgId,
      composerMessage,
      imageUrls,
      composerFiles,
      normalizedTrackedLinks,
      getFallbackTemplatePayload,
    ],
  );

  const buildChainPayloadForRecipients = useCallback(
    (chosen) => {
      return buildReadChainPayload({
        orgId,
        createdByUserId,
        users: chosen,
        fallbackTemplate: getFallbackTemplatePayload(),
        steps: chainSteps,
      });
    },
    [orgId, createdByUserId, getFallbackTemplatePayload, chainSteps],
  );

  return {
    hasFallbackTemplate,
    chainValid,
    canSend,

    getFallbackTemplatePayload,
    buildBroadcastPayload: buildBroadcastPayloadForRecipients,
    buildChainPayload: buildChainPayloadForRecipients,
  };
}
