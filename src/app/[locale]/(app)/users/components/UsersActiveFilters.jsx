"use client";

import { useTranslations } from "next-intl";

import styles from "../users.module.css";

/**
 * Chips dos filtros ativos.
 *
 * Cada chip remove o respetivo filtro. O último botão limpa todos.
 *
 * Não é renderizado quando não existem filtros ativos.
 */
export default function UsersActiveFilters({
  tags,
  assistants,
  selectedTagIds,
  selectedAssistantIds,
  onRemoveTag,
  onRemoveAssistant,
  onClearAll,
}) {
  const translation = useTranslations();

  if (selectedTagIds.length + selectedAssistantIds.length === 0) return null;

  return (
    <div className={styles.activeFilters}>
      {selectedTagIds.map((id) => {
        const tag = tags.find((x) => x.id === id);
        if (!tag) return null;

        return (
          <button
            key={`t${id}`}
            className={styles.filterChip}
            onClick={() => onRemoveTag(id)}
            title={translation("Users.filters.remove")}
          >
            {tag.name} ×
          </button>
        );
      })}

      {selectedAssistantIds.map((id) => {
        const assistant = assistants.find((x) => x.id === id);
        if (!assistant) return null;

        return (
          <button
            key={`a${id}`}
            className={styles.filterChip}
            onClick={() => onRemoveAssistant(id)}
            title={translation("Users.filters.remove")}
          >
            {assistant.name} ×
          </button>
        );
      })}

      <button className={styles.filterClearAll} onClick={onClearAll}>
        {translation("Common.clearAll")}
      </button>
    </div>
  );
}
