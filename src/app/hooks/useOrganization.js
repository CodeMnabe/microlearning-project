"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { applyThemeVariables } from "@/lib/helpers/theme.helpers";

export default function useOrganization(user) {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(Boolean(user)); // load only if we have a user
  const supabase = useMemo(() => createClient(), []);

  const loadOrganization = useCallback(async () => {
    if (!user) {
      setOrg(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("organization")
      .select(
        "id, name, logo_url, theme, channel_id, waba_id, waba_namespace, teams_tenant_id, default_phone_country_code",
      )
      .eq("owner_user_id", user.id)
      .single();

    if (error) console.error("[useOrganization]", error.message);
    setOrg(data ?? null);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadOrganization();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [loadOrganization]);

  useEffect(() => {
    const refresh = () => loadOrganization();
    window.addEventListener("organization:updated", refresh);
    return () => window.removeEventListener("organization:updated", refresh);
  }, [loadOrganization]);

  useEffect(() => {
    applyThemeVariables(org?.theme);
  }, [org]);

  return { org, loading, refresh: loadOrganization };
}
