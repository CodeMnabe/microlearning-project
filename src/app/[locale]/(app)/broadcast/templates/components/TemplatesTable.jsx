import TemplateStatusPill from "./TemplateStatusPill";
import styles from "../templates.module.css";

export default function TemplatesTable({
  translation,
  items,
  loading,
  onRefresh,
  onSendTest,
}) {
  return (
    <section>
      <div className={styles.tableActions}>
        <button
          type="button"
          onClick={() => onRefresh(true)}
          disabled={loading}
          className={styles.primaryButton}
        >
          {loading ? translation("syncing") : translation("sync")}
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{translation("name")}</th>
              <th>{translation("language")}</th>
              <th>{translation("category")}</th>
              <th>{translation("status")}</th>
              <th aria-label={translation("sendTest")} />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  {translation("noTemplates")}
                </td>
              </tr>
            ) : (
              items.map((template) => (
                <tr key={`${template.name}-${template.language}`}>
                  <td>{template.name}</td>
                  <td>{template.language}</td>
                  <td>{template.category}</td>
                  <td>
                    <TemplateStatusPill
                      status={template.status}
                      translation={translation}
                    />
                  </td>
                  <td className={styles.actionCell}>
                    <button
                      type="button"
                      onClick={() => onSendTest(template)}
                      className={styles.secondaryButton}
                    >
                      {translation("sendTest")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
