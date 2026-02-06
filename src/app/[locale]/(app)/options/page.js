"use client";

import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { createClient } from "@/utils/supabase/client";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

export default function OptionsPage() {
  const { user } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const translation = useTranslations();
  const supabase = createClient();
  const { startLoading, stopLoading } = useGlobalLoader();

  const [name, setName] = useState("");
  const [teamsTenantId, setTeamsTenantId] = useState("");

  useEffect(() => {
    // No user -> nothing to load
    if (!user) {
      stopLoading();
      setName("");
      return;
    }

    // While org is loading -> keep global loader on
    if (orgLoading) {
      return;
    }

    // Done loading -> stop loader and set name (org may still be null if not found)
    stopLoading();
    setName(org?.name ?? "");
    setTeamsTenantId(org?.teams_tenant_id);
  }, [user, orgLoading, org, startLoading, stopLoading]);

  useEffect(() => {
    console.log("name:", name);
  }, [name]);

  return (
    <>
      <h1>{name || "Test"}</h1>
      <h1>{teamsTenantId}</h1>
    </>
  );
}
