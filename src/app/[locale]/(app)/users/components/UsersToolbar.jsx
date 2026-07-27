"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Filter, Plus, Tag, Upload } from "lucide-react";

import styles from "../users.module.css";

/**
 * Barra de ferramentas da página de utilizadores.
 *
 * Responsável por:
 * - campo de pesquisa;
 * - botão que abre o popover de filtros, incluindo o contador de filtros ativos;
 * - botão de gestão de tags;
 * - menu de criação, com criar utilizador e importar CSV.
 *
 * O estado de abertura do menu de criação é local, porque é comportamento
 * puramente visual deste componente.
 *
 * A referência do botão de filtros é recebida de fora, porque o popover
 * é ancorado a esse botão e é renderizado pela página.
 */
export default function UsersToolbar({
  query,
  onQueryChange,
  filterButtonRef,
  activeFilterCount,
  onToggleFilters,
  onManageTags,
  onCreateUser,
  onImportUsers,
}) {
  const translation = useTranslations();

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef(null);

  useEffect(() => {
    if (!createMenuOpen) return;

    function handleClickOutside(e) {
      if (!createMenuRef.current?.contains(e.target)) {
        setCreateMenuOpen(false);
      }
    }

    function handleEsc(e) {
      if (e.key === "Escape") setCreateMenuOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [createMenuOpen]);

  return (
    <div className={styles.toolbarRow}>
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="11" cy="11" r="7" strokeWidth="2" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
          </svg>
        </span>
        <input
          className={styles.searchInputXL}
          placeholder={translation("Users.searchPlaceholder")}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label={translation("Users.searchPlaceholder")}
        />
      </div>

      <button
        type="button"
        ref={filterButtonRef}
        className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
        onClick={onToggleFilters}
        title={translation("Common.filter")}
      >
        <Filter size={16} /> <span>{translation("Common.filter")}</span>
        {activeFilterCount > 0 && (
          <span className={styles.filterBadge}>{activeFilterCount}</span>
        )}
      </button>

      {/* Right-side actions */}
      <div className={styles.toolbarRight}>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
          onClick={onManageTags}
          title={translation("Users.manageTags")}
        >
          <Tag size={16} /> <span>{translation("Users.manageTags")}</span>
        </button>

        <div className={styles.createMenuWrap} ref={createMenuRef}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={() => setCreateMenuOpen((v) => !v)}
            title={translation("Users.newUser")}
            aria-haspopup="menu"
            aria-expanded={createMenuOpen}
          >
            <Plus size={16} />
            <span>{translation("Users.newUser")}</span>
            <ChevronDown size={16} />
          </button>

          {createMenuOpen && (
            <div
              className={`${styles.createMenu} animateDropdownFadeDown`}
              role="menu"
            >
              <button
                type="button"
                className={styles.createMenuItem}
                role="menuitem"
                onClick={() => {
                  setCreateMenuOpen(false);
                  onCreateUser();
                }}
              >
                <Plus size={16} />
                <span>{translation("Users.newUser")}</span>
              </button>

              <button
                type="button"
                className={styles.createMenuItem}
                role="menuitem"
                onClick={() => {
                  setCreateMenuOpen(false);
                  onImportUsers();
                }}
              >
                <Upload size={16} />
                <span>Import CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
