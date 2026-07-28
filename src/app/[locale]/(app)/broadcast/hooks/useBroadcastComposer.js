"use client";

import { useCallback, useState } from "react";

/**
 * Referência estável para listas vazias, para evitar recalcular
 * memos quando não existem dados.
 */
const EMPTY_ARRAY = [];
/**
 * Gere o conteúdo principal do composer.
 *
 * Em modo normal, guarda mensagem, ficheiros e links rastreados
 * no estado base do composer.
 *
 * Em modo read chain, redireciona essas alterações para o step ativo,
 * permitindo que cada mensagem da chain tenha texto, anexos e links próprios.
 */

export function useBroadcastComposer({
  chainMode,
  chainSteps,
  setChainSteps,
  activeChainStepIndex,
}) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [trackedLinks, setTrackedLinks] = useState([]);
  const [selectedTrackedUrlKey, setSelectedTrackedUrlKey] = useState("");

  const activeChainStep = chainSteps[activeChainStepIndex] || chainSteps[0];

  const activeChainStepFiles = activeChainStep?.files || EMPTY_ARRAY;
  const activeChainStepTrackedLinks =
    activeChainStep?.trackedLinks || EMPTY_ARRAY;

  const composerMessage = chainMode ? activeChainStep?.message || "" : message;
  const composerFiles = chainMode ? activeChainStepFiles : files;
  const composerTrackedLinks = chainMode
    ? activeChainStepTrackedLinks
    : trackedLinks;
  const composerSelectedTrackedUrlKey = chainMode
    ? activeChainStep?.selectedTrackedUrlKey || ""
    : selectedTrackedUrlKey;

  const updateActiveChainStep = useCallback(
    (patchOrUpdater) => {
      setChainSteps((prev) =>
        prev.map((step, index) => {
          if (index !== activeChainStepIndex) return step;

          const patch =
            typeof patchOrUpdater === "function"
              ? patchOrUpdater(step)
              : patchOrUpdater;

          return {
            ...step,
            ...patch,
          };
        }),
      );
    },
    [activeChainStepIndex, setChainSteps],
  );

  const setComposerMessage = useCallback(
    (nextValue) => {
      if (!chainMode) {
        setMessage(nextValue);
        return;
      }

      updateActiveChainStep((step) => ({
        message:
          typeof nextValue === "function"
            ? nextValue(step.message || "")
            : nextValue,
      }));
    },
    [chainMode, updateActiveChainStep],
  );

  const setComposerFiles = useCallback(
    (nextValue) => {
      if (!chainMode) {
        setFiles(nextValue);
        return;
      }

      updateActiveChainStep((step) => ({
        files:
          typeof nextValue === "function"
            ? nextValue(step.files || [])
            : nextValue,
      }));
    },
    [chainMode, updateActiveChainStep],
  );

  const setComposerTrackedLinks = useCallback(
    (nextValue) => {
      if (!chainMode) {
        setTrackedLinks(nextValue);
        return;
      }

      updateActiveChainStep((step) => ({
        trackedLinks:
          typeof nextValue === "function"
            ? nextValue(step.trackedLinks || [])
            : nextValue,
      }));
    },
    [chainMode, updateActiveChainStep],
  );

  const setComposerSelectedTrackedUrlKey = useCallback(
    (nextValue) => {
      if (!chainMode) {
        setSelectedTrackedUrlKey(nextValue);
        return;
      }

      updateActiveChainStep((step) => ({
        selectedTrackedUrlKey:
          typeof nextValue === "function"
            ? nextValue(step.selectedTrackedUrlKey || "")
            : nextValue,
      }));
    },
    [chainMode, updateActiveChainStep],
  );

  return {
    message,
    setMessage,

    files,
    setFiles,

    trackedLinks,
    setTrackedLinks,

    selectedTrackedUrlKey,
    setSelectedTrackedUrlKey,

    activeChainStep,
    activeChainStepFiles,
    activeChainStepTrackedLinks,

    composerMessage,
    composerFiles,
    composerTrackedLinks,
    composerSelectedTrackedUrlKey,

    updateActiveChainStep,
    setComposerMessage,
    setComposerFiles,
    setComposerTrackedLinks,
    setComposerSelectedTrackedUrlKey,
  };
}
