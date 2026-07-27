"use client";

import { useTranslations } from "next-intl";

import styles from "../users.module.css";

import UsersPagination from "./UsersPagination";
import UsersTableRow from "./UsersTableRow";

/**
 * Tabela de utilizadores em modo lista.
 *
 * Compõe o cabeçalho, as linhas e o rodapé de paginação.
 * Cada linha é delegada em `UsersTableRow`.
 */
export default function UsersTable({
  users,
  assistants,
  selected,
  allChecked,
  onToggleAll,
  onToggleOne,
  onView,
  onEdit,
  onDelete,
  onAssistantChange,
  page,
  pageSize,
  totalPages,
  totalUsers,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
}) {
  const translation = useTranslations();

  return (
    <div className={styles.tableCard}>
      <div className={styles.table}>
        <div className={`${styles.row} ${styles.header}`}>
          <div className={styles.cellChk}>
            <label className={styles.chkWrap}>
              <input
                type="checkbox"
                checked={allChecked}
                onChange={onToggleAll}
              />
              <span className={styles.chkFake} />
            </label>
          </div>
          <div className={styles.cellHead}>
            {translation("Users.list.name")}
          </div>
          <div className={styles.cellHead}>
            {translation("Users.list.phone")}
          </div>
          <div className={styles.cellHead}>
            {translation("Users.list.tags")}
          </div>
          <div className={styles.cellHead}>
            {translation("Users.list.assistant")}
          </div>
          <div className={styles.cellHeadRight} />
        </div>

        {users.map((user, index) => (
          <UsersTableRow
            key={user.id}
            user={user}
            isAlternate={index % 2 === 1}
            isSelected={selected.has(user.id)}
            assistants={assistants}
            onToggleSelect={onToggleOne}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onAssistantChange={onAssistantChange}
          />
        ))}
      </div>

      <UsersPagination
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalUsers={totalUsers}
        onPageSizeChange={onPageSizeChange}
        onPrevious={onPreviousPage}
        onNext={onNextPage}
      />
    </div>
  );
}
