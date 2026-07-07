import styles from "../admin.module.css";

import OrganizationThemeCard from "./OrganizationThemeCard";

/**
 * Lista de organizações com edição de tema.
 *
 * Trata estados simples de loading/empty e delega cada organização
 * para OrganizationThemeCard.
 */
export default function OrganizationsThemeList({
  translation,
  orgs,
  loading,
  savingId,
  onColorChange,
  onSave,
}) {
  return (
    <section>
      <h2 className={styles.title}>{translation("themes.title")}</h2>

      {loading ? <p>{translation("themes.loading")}</p> : null}

      {!loading && orgs.length === 0 ? (
        <p>{translation("themes.empty")}</p>
      ) : null}

      {orgs.map((org) => (
        <OrganizationThemeCard
          key={org.id}
          org={org}
          translation={translation}
          savingId={savingId}
          onColorChange={onColorChange}
          onSave={onSave}
        />
      ))}
    </section>
  );
}