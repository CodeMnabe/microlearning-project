"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./CheckList.module.css";

/* A partir de quantos itens aparece a pesquisa. */
const SEARCH_THRESHOLD = 8;

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Lista de escolha múltipla: uma linha por item, a linha inteira clicável.
 *
 * Os itens de `initialSelectedIds` aparecem primeiro; a ordem não muda
 * enquanto se marca e desmarca, para as linhas não saltarem. Com `onMakeActive`
 * cada linha selecionada pode ser marcada como a ativa (`activeId`).
 */
export default function CheckList({
  label,
  items = [],
  selectedIds = [],
  initialSelectedIds = [],
  onToggle,
  activeId = null,
  onMakeActive,
  emptyText,
}) {
  const translation = useTranslations("CheckList");
  const [query, setQuery] = useState("");

  const ordered = useMemo(() => {
    const first = new Set(initialSelectedIds);

    return [
      ...items.filter((item) => first.has(item.id)),
      ...items.filter((item) => !first.has(item.id)),
    ];
  }, [items, initialSelectedIds]);

  const wanted = normalize(query.trim());
  const visible = wanted
    ? ordered.filter((item) => normalize(item.name).includes(wanted))
    : ordered;

  const showSearch = items.length > SEARCH_THRESHOLD;

  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        {selectedIds.length > 0 && (
          <span className={styles.count}>
            {translation("selected", { count: selectedIds.length })}
          </span>
        )}
      </div>

      <div className={styles.box}>
        {showSearch && (
          <input
            type="search"
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={translation("search")}
            aria-label={translation("search")}
          />
        )}

        <ul className={styles.list}>
          {visible.map((item) => {
            const checked = selectedIds.includes(item.id);
            const isActive = checked && activeId === item.id;

            return (
              <li
                key={item.id}
                className={`${styles.row} ${checked ? styles.rowChecked : ""}`}
              >
                <label className={styles.rowMain}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={checked}
                    onChange={() => onToggle(item.id)}
                  />
                  <span className={styles.name}>{item.name}</span>
                </label>

                {onMakeActive && isActive && (
                  <span className={styles.activeBadge}>
                    {translation("active")}
                  </span>
                )}

                {onMakeActive && checked && !isActive && (
                  <button
                    type="button"
                    className={styles.makeActive}
                    onClick={() => onMakeActive(item.id)}
                  >
                    {translation("makeActive")}
                  </button>
                )}
              </li>
            );
          })}

          {!visible.length && (
            <li className={styles.empty}>
              {items.length ? translation("noResults") : emptyText}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
