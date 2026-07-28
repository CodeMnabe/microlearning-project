"use client";

import { useCallback, useEffect, useRef } from "react";

import { asList } from "../lib";
/**
 * Carrega dados iniciais necessários para a página Broadcast.
 *
 * Responsabilidades:
 * - carregar utilizadores da organização;
 * - carregar tags e assistentes usados nos filtros;
 * - verificar se a organização tem read chains ativas;
 * - carregar templates quando o canal selecionado é WhatsApp;
 * - terminar o loader global quando os dados principais estão prontos.
 *
 * Este hook centraliza fetches iniciais para manter a page limpa.
 */

export function useBroadcastBootstrapData({
  orgId,
  channel,

  setUsers,
  setAllTags,
  setAssistantsList,
  setReadChainsFeatureEnabled,

  loadTemplates,
  showAlert,
  translation,
  stopLoading,
}) {
  const showAlertRef = useRef(showAlert);

  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  const getUsers = useCallback(async () => {
    if (!orgId) return;

    try {
      const res = await fetch(`/api/users?orgId=${orgId}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch users");
      }

      setUsers(asList(data, "items"));
    } catch (err) {
      console.warn("[Broadcast] users load error:", err);

      setUsers([]);

      await showAlertRef.current({
        title: translation("Broadcast.alerts.usersLoadFailed.title"),
        message: translation("Broadcast.alerts.usersLoadFailed.message"),
        tone: "danger",
      });
    }
  }, [orgId, setUsers, translation]);

  useEffect(() => {
    if (!orgId) return;

    let alive = true;

    (async () => {
      try {
        const [assistantsData, tagsData] = await Promise.all([
          fetch(`/api/assistants?orgId=${orgId}`).then((res) => res.json()),
          fetch(`/api/tags?orgId=${orgId}`).then((res) => res.json()),
        ]);

        if (!alive) return;

        setAssistantsList(asList(assistantsData, "items"));
        setAllTags(asList(tagsData, "items"));
      } catch (err) {
        console.warn("[Broadcast] filters load error:", err);

        if (!alive) return;

        setAssistantsList([]);
        setAllTags([]);

        await showAlertRef.current({
          title: translation("Broadcast.alerts.filtersLoadFailed.title"),
          message: translation("Broadcast.alerts.filtersLoadFailed.message"),
          tone: "danger",
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [orgId, setAssistantsList, setAllTags, translation]);

  useEffect(() => {
    if (!orgId) return;

    let alive = true;

    (async () => {
      try {
        const res = await fetch(
          `/api/organizations/messaging-feature?orgId=${orgId}&channel=whatsapp`,
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load read chain feature.");
        }

        if (!alive) return;

        setReadChainsFeatureEnabled(Boolean(data?.item?.read_chains_enabled));
      } catch (err) {
        console.warn("[Broadcast] read chain feature load error:", err);

        if (!alive) return;

        setReadChainsFeatureEnabled(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [orgId, setReadChainsFeatureEnabled]);

  useEffect(() => {
    if (!orgId) return;

    let alive = true;

    (async () => {
      await getUsers();

      if (channel === "whatsapp") {
        await loadTemplates();
      }

      if (alive) {
        stopLoading?.();
      }
    })();

    return () => {
      alive = false;
    };
  }, [orgId, channel, getUsers, loadTemplates, stopLoading]);

  return {
    refreshUsers: getUsers,
  };
}
