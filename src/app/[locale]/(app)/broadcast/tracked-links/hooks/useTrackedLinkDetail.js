"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useAlert } from "@/app/components/Alert/AlertProvider";
import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { normalizeTrackedLinkDetail } from "../helpers/tracked-links.helpers";

/**
 * Hook do detalhe de um relatório de link rastreado.
 * Gere sendGroupId, carregamento e os dados derivados para a página de detalhe.
 * Não renderiza JSX nem consulta a base de dados diretamente.
 */
export default function useTrackedLinkDetail() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { stopLoading } = useGlobalLoader();
  const translation = useTranslations("TrackedLinks.detail");
  const showAlert = useAlert();
  const showAlertRef = useRef(showAlert);
  const sendGroupId = searchParams.get("sendGroupId") || "";
  const [data, setData] = useState(null);
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
        title: translation("alerts.noOrg.title"),
        message: translation("alerts.noOrg.message"),
        tone: "warning",
      });
      return;
    }

    if (!sendGroupId) {
      const message = translation("alerts.missingSendGroup.message");
      setLoading(false);
      setError(message);
      stopLoading();
      void showAlertRef.current({
        title: translation("alerts.missingSendGroup.title"),
        message,
        tone: "warning",
      });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        orgId: String(org.id),
        sendGroupId,
      });
      const response = await fetch(`/api/tracked-links/report-detail?${query}`, {
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || "Failed to load tracked link detail.");
      }

      setData(normalizeTrackedLinkDetail(result));
    } catch {
      const message = translation("alerts.loadFailed.message");
      setError(message);
      void showAlertRef.current({
        title: translation("alerts.loadFailed.title"),
        message,
        tone: "danger",
      });
    } finally {
      setLoading(false);
      stopLoading();
    }
  }, [org?.id, orgLoading, sendGroupId, stopLoading, translation]);

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

  const summary = useMemo(() => data?.summary || null, [data]);
  const clicked = useMemo(() => data?.clicked || [], [data]);
  const notClicked = useMemo(() => data?.notClicked || [], [data]);

  return {
    translation,
    sendGroupId,
    loading,
    error,
    summary,
    clicked,
    notClicked,
    refresh,
  };
}
