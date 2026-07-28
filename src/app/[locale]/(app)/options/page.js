"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";

/**
 * Página de opções.
 *
 * Ainda não tem funcionalidade: apresenta apenas o nome da organização
 * ativa e o tenant de Teams. Enquanto se mantiver assim, não justifica
 * a estrutura de componentes, hooks e lib usada nas restantes camadas.
 */
export default function OptionsPage() {
  const { user } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const { stopLoading } = useGlobalLoader();

  const [name, setName] = useState("");
  const [teamsTenantId, setTeamsTenantId] = useState("");

  useEffect(() => {
    // Sem utilizador não há nada para carregar.
    if (!user) {
      stopLoading();
      setName("");
      return;
    }

    // Enquanto a organização carrega, o loader global fica ativo.
    if (orgLoading) {
      return;
    }

    // A organização pode continuar a ser nula se não for encontrada.
    stopLoading();
    setName(org?.name ?? "");
    setTeamsTenantId(org?.teams_tenant_id);
  }, [user, orgLoading, org, stopLoading]);

  return (
    <>
      <h1>{name || "Test"}</h1>
      <h1>{teamsTenantId}</h1>
    </>
  );
}
