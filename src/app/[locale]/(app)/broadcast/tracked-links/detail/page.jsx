"use client";

import TrackedLinkDetailHeader from "./components/TrackedLinkDetailHeader";
import TrackedLinkRecipients from "./components/TrackedLinkRecipients";
import TrackedLinkSummary from "./components/TrackedLinkSummary";
import useTrackedLinkDetail from "../hooks/useTrackedLinkDetail";
import styles from "./detail.module.css";

/**
 * Página de detalhe de um grupo de links rastreados.
 * A obtenção e normalização do detalhe ficam no hook useTrackedLinkDetail.
 */
export default function TrackedLinkDetailPage() {
  const { translation, loading, error, summary, clicked, notClicked } =
    useTrackedLinkDetail();

  return (
    <main className={styles.screen}>
      <TrackedLinkDetailHeader translation={translation} />
      {loading && <div className={styles.emptyBox}>{translation("loading")}</div>}
      {!loading && error && <div className={styles.errorBox}>{error}</div>}
      {!loading && !error && summary && (
        <>
          <TrackedLinkSummary translation={translation} summary={summary} />
          <TrackedLinkRecipients translation={translation} recipients={clicked} clicked />
          <TrackedLinkRecipients translation={translation} recipients={notClicked} clicked={false} />
        </>
      )}
    </main>
  );
}
