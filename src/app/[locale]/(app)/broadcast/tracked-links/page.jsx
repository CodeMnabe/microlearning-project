"use client";

import { useTranslations } from "next-intl";
import TrackedLinksEmptyState from "./components/TrackedLinksEmptyState";
import TrackedLinksFilters from "./components/TrackedLinksFilters";
import TrackedLinksHeader from "./components/TrackedLinksHeader";
import TrackedLinksStats from "./components/TrackedLinksStats";
import TrackedLinksTable from "./components/TrackedLinksTable";
import useTrackedLinksReports from "./hooks/useTrackedLinksReports";
import styles from "./tracked-links.module.css";

/**
 * Página de relatórios de links rastreados.
 * Compõe a UI a partir do hook e mantém fetches, estado e filtragem fora da page.
 */
export default function TrackedLinksPage() {
  const translation = useTranslations();
  const {
    filteredItems,
    loading,
    error,
    search,
    setSearch,
    stats,
  } = useTrackedLinksReports();

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <TrackedLinksHeader translation={translation} />
        <TrackedLinksStats translation={translation} totalLinks={stats.totalLinks} />
      </div>
      <TrackedLinksFilters
        translation={translation}
        search={search}
        onSearchChange={setSearch}
      />
      {loading && <TrackedLinksEmptyState>{translation("TrackedLinks.loading")}</TrackedLinksEmptyState>}
      {!loading && error && <TrackedLinksEmptyState error>{error}</TrackedLinksEmptyState>}
      {!loading && !error && filteredItems.length === 0 && (
        <TrackedLinksEmptyState>{translation("TrackedLinks.noLinks")}</TrackedLinksEmptyState>
      )}
      {!loading && !error && filteredItems.length > 0 && (
        <TrackedLinksTable translation={translation} items={filteredItems} />
      )}
    </main>
  );
}
