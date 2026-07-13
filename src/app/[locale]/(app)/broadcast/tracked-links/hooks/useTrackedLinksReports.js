"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAlert } from "@/app/components/Alert/AlertProvider";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import {
  filterTrackedLinkReports,
  normalizeTrackedLinkReport,
  safeArray,
} from "../helpers/tracked-links.helpers";

/**
 * Hook principal da listagem de links rastreados.
 * Gere organização, carregamento, pesquisa, filtragem e estatísticas locais.
 * Não renderiza JSX nem faz queries diretas à base de dados.
 */
export default function useTrackedLinksReports() {
  const { user } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { stopLoading } = useGlobalLoader();
  const translation = useTranslations();
  const showAlert = useAlert();
  const showAlertRef = useRef(showAlert);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    showAlertRef.current = showAlert;
  }, [showAlert]);

  const refresh = useCallback(async () => {
    if (orgLoading) return;

    if (!org?.id) {
      setLoading(false);
      stopLoading();
      void showAlertRef.current({
        title: translation("TrackedLinks.alerts.noOrg.title"),
        message: translation("TrackedLinks.alerts.noOrg.message"),
        tone: "warning",
      });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/tracked-links/reports?orgId=${org.id}`,
        { cache: "no-store" }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load tracked links.");
      }

      setItems(safeArray(data?.items).map(normalizeTrackedLinkReport));
    } catch {
      const message = translation("TrackedLinks.alerts.loadFailed.message");
      setError(message);
      void showAlertRef.current({
        title: translation("TrackedLinks.alerts.loadFailed.title"),
        message,
        tone: "danger",
      });
    } finally {
      setLoading(false);
      stopLoading();
    }
  }, [org?.id, orgLoading, stopLoading, translation]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!alive) return;
      await refresh();
    }

    void load();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const filteredItems = useMemo(
    () => filterTrackedLinkReports(items, search),
    [items, search]
  );

  return {
    items,
    filteredItems,
    loading,
    error,
    search,
    setSearch,
    stats: { totalLinks: items.length },
    refresh,
  };
}
