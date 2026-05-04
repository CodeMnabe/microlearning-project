import { Plus, Trash2 } from "lucide-react";

import styles from "../../broadcast.module.css";
import { sanitizeTrackedKey } from "../../lib/helpers";

export default function TrackedLinksPanel({
  channel,
  needsUrlVar,
  trackedLinks,
  trackedLinksValid,
  trackedLinkOptions,
  selectedTrackedUrlKey,
  setSelectedTrackedUrlKey,
  whatsappUrlBindingValid,
  addTrackedLink,
  updateTrackedLink,
  removeTrackedLink,
}) {
  return (
    <div className={styles.toolPanelCard}>
      <div className={styles.modalSectionHeader}>
        <div className={styles.panelTitle}>Tracked Links</div>

        <button
          type="button"
          onClick={addTrackedLink}
          className={styles.kbdBtn}
        >
          <Plus size={14} />
          <span>Add link</span>
        </button>
      </div>

      <div className={styles.modalHelpText}>
        Add placeholders like <code>{`{{link.training}}`}</code> inside the
        message.
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
                <span>Remove</span>
              </button>
            </div>

            <div className={styles.fieldWide}>
              <label className={styles.smallLabel}>Key</label>
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
              <label className={styles.smallLabel}>Label</label>
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
              <label className={styles.smallLabel}>Destination URL</label>
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

      {channel === "whatsapp" && needsUrlVar && (
        <div className={styles.modalSection}>
          <div className={styles.panelTitle}>WhatsApp CTA Button</div>

          <div className={styles.fieldWide}>
            <label className={styles.smallLabel}>
              Tracked link for CTA button
            </label>

            <select
              value={selectedTrackedUrlKey}
              onChange={(e) => setSelectedTrackedUrlKey(e.target.value)}
              className={styles.select}
              disabled={trackedLinkOptions.length === 0}
            >
              {trackedLinkOptions.length === 0 ? (
                <option value="">Add a tracked link first</option>
              ) : (
                <>
                  <option value="">Select tracked link</option>
                  {trackedLinkOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </>
              )}
            </select>

            {trackedLinkOptions.length === 0 && (
              <div className={styles.inlineHelpText}>
                This template needs a URL variable, so you should add at least
                one tracked link.
              </div>
            )}
          </div>

          {!whatsappUrlBindingValid && (
            <div className={styles.helpDanger}>
              Select which tracked link should power the WhatsApp CTA button.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
