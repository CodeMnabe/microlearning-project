import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "../options.module.css";

export default function ActivityPagination({
  translation,
  page,
  pages,
  total,
  onPrev,
  onNext,
  loading,
}) {
  if (!total) return null;

  return (
    <div className={styles.pagination}>
      <span className={styles.paginationInfo}>
        {translation("Pagination.total", { count: total })}
      </span>

      <div className={styles.paginationControls}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onPrev}
          disabled={loading || page <= 1}
          aria-label={translation("Pagination.prev")}
        >
          <ChevronLeft aria-hidden size={18} />
        </button>

        <span className={styles.paginationPage}>
          {translation("Pagination.pageOf", { page, pages })}
        </span>

        <button
          type="button"
          className={styles.iconButton}
          onClick={onNext}
          disabled={loading || page >= pages}
          aria-label={translation("Pagination.next")}
        >
          <ChevronRight aria-hidden size={18} />
        </button>
      </div>
    </div>
  );
}
