import { Plus, Trash2 } from "lucide-react";

import styles from "../../broadcast.module.css";
import { sanitizeTrackedKey } from "../../lib/helpers";

export default function TrackedLinksPanel({
  trackedLinks,
  trackedLinksValid,
  addTrackedLink,
  updateTrackedLink,
  removeTrackedLink,
  translation,
}) {
  return (
    <div className={styles.toolPanelCard}>
      <div className={styles.modalSectionHeader}>
        <div className={styles.panelTitle}>
          {translation("Broadcast.trackedLinks")}
        </div>

        <button
          type="button"
          onClick={addTrackedLink}
          className={styles.kbdBtn}
        >
          <Plus size={14} />
          <span>{translation("Broadcast.addLink")}</span>
        </button>
      </div>

      <div className={styles.modalHelpText}>
        {translation("Broadcast.addPlaceholders.first")}{" "}
        <code>{`{{link.training}}`}</code>{" "}
        {translation("Broadcast.addPlaceholders.second")}
      </div>

      <div className={styles.trackedLinksGrid}>
        {trackedLinks.map((link, index) => (
          <div key={link.id} className={styles.trackedLinkCard}>
            <div className={styles.trackedLinkCardHeader}>
              <strong>Link {index + 1}</strong>

              <button
                type="button"
                onClick={() => removeTrackedLink(link.id)}
                className={styles.kbdBtn}
              >
                <Trash2 size={14} />
                <span>{translation("Broadcast.remove")}</span>
              </button>
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.smallLabel}>
                {translation("Broadcast.key")}
              </label>
              <input
                value={link.key}
                onChange={(e) =>
                  updateTrackedLink(link.id, "key", e.target.value)
                }
                placeholder="training"
                className={styles.input}
              />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.smallLabel}>
                {translation("Broadcast.label")}
              </label>
              <input
                value={link.label}
                onChange={(e) =>
                  updateTrackedLink(link.id, "label", e.target.value)
                }
                placeholder="Aceder à formação"
                className={styles.input}
              />
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.smallLabel}>
                {translation("Broadcast.destinationUrl")}
              </label>
              <input
                value={link.destinationUrl}
                onChange={(e) =>
                  updateTrackedLink(link.id, "destinationUrl", e.target.value)
                }
                placeholder="https://example.com/course/123"
                className={styles.input}
              />
            </div>

            {sanitizeTrackedKey(link.key) && (
              <div className={styles.trackedPlaceholder}>
                Placeholder:{" "}
                <code>{`{{link.${sanitizeTrackedKey(link.key)}}}`}</code>
              </div>
            )}
          </div>
        ))}

        {trackedLinks.length === 0 && (
          <div className={styles.emptyMini}>No tracked links added yet.</div>
        )}

        {!trackedLinksValid && trackedLinks.length > 0 && (
          <div className={styles.helpDanger}>
            Complete every tracked link and avoid duplicate keys.
          </div>
        )}
      </div>

    </div>
  );
}
