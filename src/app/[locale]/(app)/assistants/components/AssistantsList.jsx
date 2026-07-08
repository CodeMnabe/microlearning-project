import styles from "../assistants.module.css";

export default function AssistantsList({
  assistants = [],
  selectedId,
  orgId,
  translation,
  onSelect,
  onCreate,
}) {
  return (
    <aside className={styles.listCol}>
      <div className={styles.listHeader}>
        <span>{translation("Assistants.myAssistants")}</span>
      </div>

      <div className={styles.list}>
        {assistants.map((assistant) => (
          <button
            key={assistant.id}
            className={`${styles.listItem} ${
              assistant.id === selectedId ? styles.listItemActive : ""
            }`}
            onClick={() => onSelect(assistant.id)}
          >
            <span className={styles.listItemName}>{assistant.name}</span>
          </button>
        ))}

        {!assistants.length && (
          <div className={styles.emptyState}>
            <p>{translation("Assistants.empty")}</p>
          </div>
        )}
      </div>

      <div className={styles.listFooter}>
        <button
          className={styles.ctaPrimary}
          onClick={onCreate}
          disabled={!orgId}
          title={translation("Assistants.createAssistant")}
        >
          {translation("Assistants.createAssistant")}
        </button>
      </div>
    </aside>
  );
}