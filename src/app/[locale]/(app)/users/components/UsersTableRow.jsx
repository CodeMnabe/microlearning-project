"use client";

import { useTranslations } from "next-intl";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import PillSelect from "@/app/components/PillSelect/PillSelect";

import styles from "../users.module.css";
import { MAX_VISIBLE_USER_TAGS } from "../lib/users.constants";
import { getUserInitial } from "../lib/users.helpers";

/**
 * Linha da tabela de utilizadores.
 *
 * Apresenta seleção, identificação, telefone, tags, assistente associado
 * e as ações de ver, editar e remover.
 *
 * As tags acima do limite visível são representadas pelo indicador "+n".
 */
export default function UsersTableRow({
  user,
  isAlternate,
  isSelected,
  assistants,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
  onAssistantChange,
}) {
  const translation = useTranslations();

  const allTags = Array.isArray(user.tags) ? user.tags : [];
  const shownTags = allTags.slice(0, MAX_VISIBLE_USER_TAGS);
  const extraTagCount = allTags.length - shownTags.length;

  return (
    <div className={`${styles.row} ${isAlternate ? styles.rowAlt : ""}`}>
      <div className={styles.cellChk}>
        <label className={styles.chkWrap}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(user.id)}
          />
          <span className={styles.chkFake} />
        </label>
      </div>

      <div
        className={styles.cellName}
        role="button"
        onMouseUp={() => onView(user)}
      >
        <div className={styles.avatar}>{getUserInitial(user.name)}</div>
        <div className={styles.nameBlock}>
          <div className={styles.name}>{user.name}</div>
          <div className={styles.subline}>{user.email || ""}</div>
        </div>
      </div>

      <div className={styles.cellPhone}>
        {user.phoneNational || user.phone || "—"}
      </div>

      <div className={styles.cellTags}>
        {shownTags.map((tag) => (
          <span key={tag} className={styles.chip}>
            {tag}
          </span>
        ))}
        {extraTagCount > 0 && (
          <span className={`${styles.chip} ${styles.chipDark}`}>
            +{extraTagCount}
          </span>
        )}
      </div>

      <div className={styles.cellAssistant}>
        <PillSelect
          value={user.assistantId}
          options={assistants.map((assistant) => ({
            value: assistant.id,
            label: assistant.name,
          }))}
          onChange={(newAssistantId) => onAssistantChange(user, newAssistantId)}
        />
      </div>

      <div className={styles.cellKebab}>
        <button
          className={`${styles.iconBtn} ${styles.kebabDefault}`}
          aria-label={translation("Users.row.more")}
          onClick={() => onEdit(user)}
        >
          <MoreHorizontal size={18} />
        </button>

        <div
          className={styles.rowActions}
          aria-label={translation("Common.actions")}
        >
          <button
            className={styles.rowActBtn}
            onClick={() => onView(user)}
            title={translation("Users.row.view")}
          >
            <Eye size={16} /> <span>{translation("Users.row.view")}</span>
          </button>
          <button
            className={styles.rowActBtn}
            onClick={() => onEdit(user)}
            title={translation("Users.row.edit")}
          >
            <Pencil size={16} /> <span>{translation("Users.row.edit")}</span>
          </button>
          <button
            className={`${styles.rowActBtn} ${styles.rowActBtnDanger}`}
            onClick={() => onDelete(user)}
            title={translation("Users.row.delete")}
          >
            <Trash2 size={16} /> <span>{translation("Users.row.delete")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
