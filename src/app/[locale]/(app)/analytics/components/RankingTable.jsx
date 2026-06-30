
import styles from "../analytics.module.css";

import DescriptionInfo from "./DescriptionInfo";
/**
 * Tabela reutilizável para rankings.
 * Recebe colunas dinâmicas e linhas vindas da API.
 */
export default function RankingTable({
  title,
  description,
  columns,
  rows,
  emptyMessage,
  splitTopTen = false,
  footer,
}) {
  const visibleRows = splitTopTen ? rows.slice(0, 10) : rows;

  const shouldSplit = splitTopTen && visibleRows.length > 5;

  const rowGroups = shouldSplit
    ? [visibleRows.slice(0, 5), visibleRows.slice(5, 10)]
    : [visibleRows];

  return (
    <section className={styles.rankingCard}>
      <div className={styles.chartHeader}>
        <div className={styles.titleWithInfo}>
          <h2 className={styles.chartTitle}>{title}</h2>
          <DescriptionInfo text={description} />
        </div>
      </div>

      {visibleRows.length > 0 ? (
        <div
          className={`${styles.tableWrapper} ${
            shouldSplit ? styles.splitTableWrapper : ""
          }`}
        >
          {rowGroups.map((groupRows, groupIndex) => (
            <table key={groupIndex} className={styles.rankingTable}>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {groupRows.map((row, index) => {
                  const globalIndex = groupIndex === 0 ? index : index + 5;

                  return (
                    <tr key={row.id || `${groupIndex}-${index}`}>
                      {columns.map((column) => (
                        <td key={column.key}>
                          {column.render
                            ? column.render(row, globalIndex)
                            : row[column.key]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        </div>
      ) : (
        <div className={styles.chartEmpty}>{emptyMessage}</div>
      )}

      {footer}
    </section>
  );
}