"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function useOrganization(user) {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(Boolean(user)); // load only if we have a user
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user) {
        setOrg(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("organization")
        .select("id, name, logo_url, theme, channel_id, waba_id")
        .eq("owner_user_id", user.id)
        .single();

      if (cancelled) return;
      if (error) console.error("[useOrganization]", error.message);
      setOrg(data ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  useEffect(() => {
    const t = org?.theme || {};
    const root = document.documentElement;
    root.style.setProperty("--color-primary", t.primary ?? "#30a9e0");
    root.style.setProperty("--color-secondary", t.secondary ?? "#191e3b");
  }, [org]);

  return { org, loading };
}
