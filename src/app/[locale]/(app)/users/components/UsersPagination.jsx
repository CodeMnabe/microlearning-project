"use client";

import { useTranslations } from "next-intl";

import PillSelect from "@/app/components/PillSelect/PillSelect";

import styles from "../users.module.css";
import { USERS_PAGE_SIZE_VALUES } from "../lib/users.constants";

/**
 * Rodapé de paginação da tabela de utilizadores.
 *
 * Apresenta o resumo da página atual, o seletor de utilizadores por página
 * e a navegação entre páginas.
 */
export default function UsersPagination({
  page,
  pageSize,
  totalPages,
  totalUsers,
  onPageSizeChange,
  onPrevious,
  onNext,
}) {
  const translation = useTranslations();

  return (
    <div className={styles.pagination}>
      <div className={styles.paginationLeft}>
        <span>
          {translation("Users.pagination.summary", {
            page,
            totalPages,
            totalUsers,
          })}
        </span>
      </div>

      <div className={styles.paginationRight}>
        <PillSelect
          value={pageSize}
          options={USERS_PAGE_SIZE_VALUES.map((count) => ({
            value: count,
            label: translation("Users.pagination.perPage", { count }),
          }))}
          onChange={onPageSizeChange}
        />

        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
          onClick={onPrevious}
          disabled={page === 1}
        >
          {translation("Users.pagination.previous")}
        </button>

        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
          onClick={onNext}
          disabled={page >= totalPages}
        >
          {translation("Users.pagination.next")}
        </button>
      </div>
    </div>
  );
}
