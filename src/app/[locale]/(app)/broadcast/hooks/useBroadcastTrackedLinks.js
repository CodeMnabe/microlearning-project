"use client";

import { useEffect, useMemo } from "react";

import {
  areComposerTrackedLinksValid,
  getTrackedLinkOptions,
  isWhatsappUrlBindingValid,
  makeTrackedLinkDraft,
  normalizeComposerTrackedLinks,
  replaceTrackedPlaceholders,
  sanitizeTrackedKey,
} from "../lib";
/**
 * Gere links rastreados usados no Broadcast.
 *
 * Responsabilidades:
 * - criar, editar e remover links rastreados;
 * - normalizar keys e URLs;
 * - validar links incompletos ou duplicados;
 * - substituir placeholders no preview da mensagem;
 * - garantir ligação entre tracked link e botão URL de templates WhatsApp.
 */

export function useBroadcastTrackedLinks({
  channel,
  composerMessage,
  composerTrackedLinks,
  setComposerTrackedLinks,
  needsUrlVar,
  composerSelectedTrackedUrlKey,
  setComposerSelectedTrackedUrlKey,
  showAlert,
  translation,
}) {
  const trackedLinkOptions = useMemo(
    () => getTrackedLinkOptions(composerTrackedLinks),
    [composerTrackedLinks],
  );

  const normalizedTrackedLinks = useMemo(
    () => normalizeComposerTrackedLinks(composerTrackedLinks),
    [composerTrackedLinks],
  );

  const trackedLinksCount = normalizedTrackedLinks.length;

  const trackedLinksValid = useMemo(
    () => areComposerTrackedLinksValid(composerTrackedLinks),
    [composerTrackedLinks],
  );

  const whatsappUrlBindingValid = useMemo(
    () =>
      isWhatsappUrlBindingValid({
        needsUrlVar,
        trackedLinkOptions,
        selectedTrackedUrlKey: composerSelectedTrackedUrlKey,
      }),
    [needsUrlVar, trackedLinkOptions, composerSelectedTrackedUrlKey],
  );

  const previewMessageWithTrackedLinks = useMemo(() => {
    return replaceTrackedPlaceholders(
      composerMessage,
      normalizedTrackedLinks,
      channel,
    );
  }, [composerMessage, normalizedTrackedLinks, channel]);

  useEffect(() => {
    if (!needsUrlVar) return;
    if (!trackedLinkOptions.length) return;
    if (composerSelectedTrackedUrlKey) return;

    setComposerSelectedTrackedUrlKey(trackedLinkOptions[0].value);
  }, [
    needsUrlVar,
    trackedLinkOptions,
    composerSelectedTrackedUrlKey,
    setComposerSelectedTrackedUrlKey,
  ]);

  function addTrackedLink() {
    setComposerTrackedLinks((prev) => [...prev, makeTrackedLinkDraft()]);
  }

  function updateTrackedLink(id, field, value) {
    setComposerTrackedLinks((prev) =>
      prev.map((link) => {
        if (link.id !== id) return link;

        if (field === "key") {
          return { ...link, key: sanitizeTrackedKey(value) };
        }

        return { ...link, [field]: value };
      }),
    );
  }

  function removeTrackedLink(id) {
    const removed = composerTrackedLinks.find((link) => link.id === id);

    const removedSelectedUrlLink =
      removed &&
      composerSelectedTrackedUrlKey === sanitizeTrackedKey(removed.key);

    setComposerTrackedLinks((prev) => prev.filter((link) => link.id !== id));

    if (removedSelectedUrlLink) {
      setComposerSelectedTrackedUrlKey("");

      void showAlert({
        title: translation("Broadcast.alerts.trackedLinkRemoved.title"),
        message: translation("Broadcast.alerts.trackedLinkRemoved.message"),
        tone: "warning",
      });
    }
  }

  return {
    trackedLinkOptions,
    normalizedTrackedLinks,
    trackedLinksCount,
    trackedLinksValid,
    whatsappUrlBindingValid,
    previewMessageWithTrackedLinks,

    addTrackedLink,
    updateTrackedLink,
    removeTrackedLink,
  };
}
