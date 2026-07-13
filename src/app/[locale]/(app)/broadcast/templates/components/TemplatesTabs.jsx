import styles from "../templates.module.css";

export default function TemplatesTabs({ translation, view, onChange }) {
  return (
    <div className={styles.tabs} aria-label={translation("title")}>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`${styles.tabButton} ${
          view === "list" ? styles.tabButtonActive : ""
        }`}
      >
        {translation("tabList")}
      </button>
      <button
        type="button"
        onClick={() => onChange("create")}
        className={`${styles.tabButton} ${
          view === "create" ? styles.tabButtonActive : ""
        }`}
      >
        {translation("tabCreate")}
      </button>
    </div>
  );
}
