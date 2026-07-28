"use client";

import { useCallback, useMemo, useState } from "react";

import {
  MAX_CHAIN_DELAY_HOURS,
  clampNumber,
  makeChainStep,
  makeTrackedLinkDraft,
  normalizeDelayMinutes,
  splitDelayMinutes,
} from "../lib";
/**
 * Gere o estado das read chains de WhatsApp.
 *
 * Uma read chain é uma sequência de mensagens freeform enviada
 * com base em leituras/respostas, usando um template WhatsApp como fallback
 * quando a janela de 24h não está aberta.
 *
 * Este hook controla:
 * - ativação do modo chain;
 * - step ativo;
 * - criação, duplicação e remoção de steps;
 * - atraso entre mensagens após leitura;
 * - limite mínimo e máximo de mensagens da chain.
 */

export function useBroadcastChains() {
  const [readChainsFeatureEnabled, setReadChainsFeatureEnabled] =
    useState(false);

  const [chainMode, setChainMode] = useState(false);
  const [activeChainStepIndex, setActiveChainStepIndex] = useState(0);

  const [chainSteps, setChainSteps] = useState(() => [
    makeChainStep(),
    makeChainStep(),
  ]);

  const addChainStep = useCallback(() => {
    setChainSteps((prev) => {
      if (prev.length >= 10) return prev;

      const next = [...prev, makeChainStep()];
      setActiveChainStepIndex(next.length - 1);

      return next;
    });
  }, []);

  const duplicateChainStep = useCallback(() => {
    setChainSteps((prev) => {
      if (prev.length >= 10) return prev;

      const current = prev[activeChainStepIndex] || makeChainStep();

      const copy = makeChainStep({
        message: current.message || "",
        files: Array.isArray(current.files) ? [...current.files] : [],
        trackedLinks: Array.isArray(current.trackedLinks)
          ? current.trackedLinks.map((link) => ({
              ...link,
              id: makeTrackedLinkDraft().id,
            }))
          : [],
        selectedTrackedUrlKey: current.selectedTrackedUrlKey || "",
        delayAfterPreviousReadMinutes: Number(
          current.delayAfterPreviousReadMinutes || 0,
        ),
      });

      const next = [
        ...prev.slice(0, activeChainStepIndex + 1),
        copy,
        ...prev.slice(activeChainStepIndex + 1),
      ];

      setActiveChainStepIndex(activeChainStepIndex + 1);

      return next;
    });
  }, [activeChainStepIndex]);

  const removeChainStep = useCallback((indexToRemove) => {
    setChainSteps((prev) => {
      if (prev.length <= 2) return prev;

      const next = prev.filter((_, index) => index !== indexToRemove);

      setActiveChainStepIndex((current) =>
        Math.min(
          current >= indexToRemove ? current - 1 : current,
          next.length - 1,
        ),
      );

      return next;
    });
  }, []);

  const updateChainStepDelay = useCallback((indexToUpdate, value) => {
    const delay = normalizeDelayMinutes(value);

    setChainSteps((prev) =>
      prev.map((step, index) => {
        if (index !== indexToUpdate) return step;

        return {
          ...step,
          delayAfterPreviousReadMinutes: index === 0 ? 0 : delay,
        };
      }),
    );
  }, []);

  const updateChainStepDelayPart = useCallback(
    (indexToUpdate, part, value) => {
      if (indexToUpdate === 0) return;

      const currentStep = chainSteps[indexToUpdate] || {};
      const currentDelay = Number(
        currentStep.delayAfterPreviousReadMinutes || 0,
      );

      const current = splitDelayMinutes(currentDelay);

      const nextHours =
        part === "hours"
          ? clampNumber(value, 0, MAX_CHAIN_DELAY_HOURS)
          : current.hours;

      const nextMinutes =
        part === "minutes" ? clampNumber(value, 0, 59) : current.minutes;

      updateChainStepDelay(indexToUpdate, nextHours * 60 + nextMinutes);
    },
    [chainSteps, updateChainStepDelay],
  );

  const activeDelay = useMemo(() => {
    const activeStep = chainSteps[activeChainStepIndex] || chainSteps[0];

    return Number(activeStep?.delayAfterPreviousReadMinutes || 0);
  }, [chainSteps, activeChainStepIndex]);

  const activeDelayParts = useMemo(
    () => splitDelayMinutes(activeDelay),
    [activeDelay],
  );

  return {
    readChainsFeatureEnabled,
    setReadChainsFeatureEnabled,

    chainMode,
    setChainMode,

    activeChainStepIndex,
    setActiveChainStepIndex,

    chainSteps,
    setChainSteps,

    addChainStep,
    duplicateChainStep,
    removeChainStep,

    updateChainStepDelay,
    updateChainStepDelayPart,

    activeDelay,
    activeDelayParts,
  };
}
