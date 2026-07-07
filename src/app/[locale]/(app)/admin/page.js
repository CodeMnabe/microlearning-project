"use client";

import { useTranslations } from "next-intl";

import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";
import { useAlert } from "@/app/components/Alert/AlertProvider";

import styles from "./admin.module.css";

import AdminHeader from "./components/AdminHeader";
import CreateOrganizationForm from "./components/CreateOrganizationForm";
import OrganizationsThemeList from "./components/OrganizationsThemeList";


import { useAdminOrganizations } from "./hooks/admin.hooks";

/**
 * Página principal da área Admin.
 *
 * Responsabilidades:
 * - compor a interface da administração;
 * - apresentar criação de organizações;
 * - apresentar edição de temas por organização;
 * - delegar lógica de dados e ações para hooks locais.
 */
export default function AdminPage() {
  const translation = useTranslations("AdminPage");
  const showAlert = useAlert();
  const { stopLoading } = useGlobalLoader();

  const {
    orgs,
    loading,
    savingId,
    msg,

    name,
    setName,
    creating,

    handleColorChange,
    handleSave,
    handleCreate,
  } = useAdminOrganizations({
    translation,
    showAlert,
    stopLoading,
  });

  return (
    <main className={styles.pageWrapper}>
      <AdminHeader translation={translation} />

      <CreateOrganizationForm
        translation={translation}
        name={name}
        setName={setName}
        creating={creating}
        onSubmit={handleCreate}
      />

      <OrganizationsThemeList
        translation={translation}
        orgs={orgs}
        loading={loading}
        savingId={savingId}
        onColorChange={handleColorChange}
        onSave={handleSave}
      />

      {msg ? <p style={{ marginTop: 12 }}>{msg}</p> : null}
    </main>
  );
}