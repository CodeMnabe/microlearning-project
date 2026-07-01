import styles from "../analytics.module.css";

import DescriptionInfo from "./DescriptionInfo";
import RankingTable from "./RankingTable";

export default function TopLinksRanking({
  translation,
  topTrackedLinks,
  allTrackedLinks,
  format,
  onViewAll,
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <div className={styles.titleWithInfo}>
            <h2 className={styles.sectionTitle}>
              {translation("rankings.title")}
            </h2>

            <DescriptionInfo text={translation("rankings.description")} />
          </div>
        </div>
      </div>

      <div className={styles.rankingGrid}>
        <RankingTable
          title={translation("rankings.topLinksTitle")}
          description={translation("rankings.topLinksDescription")}
          rows={topTrackedLinks}
          emptyMessage={translation("rankings.empty")}
          splitTopTen
          footer={
            allTrackedLinks.length > 10 ? (
              <button
                type="button"
                className={styles.viewAllButton}
                onClick={onViewAll}
              >
                {translation("rankings.viewAllLinks", {
                  count: format(allTrackedLinks.length),
                })}
              </button>
            ) : null
          }
          columns={[
            {
              key: "position",
              label: "#",
              render: (_row, index) => (
                <span className={styles.rankingPosition}>{index + 1}</span>
              ),
            },
            {
              key: "label",
              label: translation("rankings.columns.link"),
              render: (row) => (
                <span className={styles.rankingMainText}>{row.label}</span>
              ),
            },
            {
              key: "clicks",
              label: translation("rankings.columns.clicks"),
              render: (row) => format(row.clicks),
            },
          ]}
        />
      </div>
    </section>
  );
}