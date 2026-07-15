"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Clock3,
  PlayCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useTranslations } from "next-intl";

import styles from "../automations.module.css";

/**
 * Barra principal da página de Automations.
 *
 * Apresenta:
 * - pesquisa;
 * - refresh;
 * - execução manual do cron de inatividade;
 * - materialização de runs;
 * - menu de criação.
 *
 * As ações reais continuam a ser controladas pela página.
 */
export default function AutomationsToolbar({
  query,
  onQueryChange,
  onRefresh,
  onRunInactivity,
  onMaterialize,
  onCreate,
}) {
  const translation = useTranslations("Automations");

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef(null);

  /**
   * Fecha o menu:
   * - ao clicar fora;
   * - ao carregar na tecla Escape.
   */
  useEffect(() => {
    if (!createMenuOpen) return;

    function handleClickOutside(event) {
      if (!createMenuRef.current?.contains(event.target)) {
        setCreateMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setCreateMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [createMenuOpen]);

  /**
   * Fecha primeiro o menu e comunica à página
   * que deve abrir o formulário de criação.
   */
  function handleCreate() {
    setCreateMenuOpen(false);
    onCreate();
  }

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

            <line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
              strokeWidth="2"
            />
          </svg>
        </span>

        <input
          type="search"
          className={styles.searchInputXL}
          placeholder={translation("searchAutomations")}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label={translation("searchAutomations")}
        />
      </div>

      <div className={styles.toolbarRight}>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
          onClick={onRefresh}
        >
          <RefreshCw size={16} />

          <span>{translation("refresh")}</span>
        </button>

        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
          onClick={onRunInactivity}
        >
          <Clock3 size={16} />

          <span>{translation("runInactivity")}</span>
        </button>

        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
          onClick={onMaterialize}
        >
          <PlayCircle size={16} />

          <span>{translation("materialize")}</span>
        </button>

        <div
          ref={createMenuRef}
          className={styles.createMenuWrap}
        >
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            aria-haspopup="menu"
            aria-expanded={createMenuOpen}
            onClick={() => {
              setCreateMenuOpen((currentValue) => !currentValue);
            }}
          >
            <Plus size={16} />

            <span>{translation("newAutomation")}</span>

            <ChevronDown size={16} />
          </button>

          {createMenuOpen && (
            <div
              className={`${styles.createMenu} animateDropdownFadeDown`}
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className={styles.createMenuItem}
                onClick={handleCreate}
              >
                <Plus size={16} />

                <span>{translation("createAutomation")}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}