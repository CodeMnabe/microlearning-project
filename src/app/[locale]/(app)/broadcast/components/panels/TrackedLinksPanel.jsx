import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import styles from "../../broadcast.module.css";
import {
  filterTrackedLinkLibrary,
  isSameTrackedLink,
  sanitizeTrackedKey,
} from "../../lib/helpers";

/*
 * Links já usados noutros envios, para escolher em vez de escrever outra
 * vez. Sem nenhum link usado, a secção não aparece.
 */
function LinkLibrary({ library, trackedLinks, onUse, translation }) {
  const [query, setQuery] = useState("");
  const items = library?.items || [];

  if (!library || (!library.loading && !library.failed && !items.length)) {
    return null;
  }

  const visible = filterTrackedLinkLibrary(items, query);

  return (
    <div className={styles.linkLibrary}>
      <div className={styles.smallLabel}>
        {translation("Broadcast.linkLibrary.title")}
      </div>

      {library.loading && !items.length && (
        <div className={styles.emptyMini}>
          {translation("Broadcast.linkLibrary.loading")}
        </div>
      )}

      {library.failed && (
        <div className={styles.linkLibraryFailed}>
          <span className={styles.helpDanger}>
            {translation("Broadcast.linkLibrary.failed")}
          </span>
          <button
            type="button"
            onClick={library.reload}
            className={styles.kbdBtn}
          >
            {translation("Broadcast.linkLibrary.retry")}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={translation("Broadcast.linkLibrary.search")}
            className={styles.input}
          />

          <ul className={styles.linkLibraryList}>
            {visible.map((item) => {
              const added = trackedLinks.some((link) =>
                isSameTrackedLink(link, item),
              );

              return (
                <li
                  key={`${item.label}\n${item.destinationUrl}`}
                  className={styles.linkLibraryItem}
                >
                  <div className={styles.linkLibraryText}>
                    <strong>{item.label}</strong>
                    <span
                      className={styles.linkLibraryUrl}
                      title={item.destinationUrl}
                    >
                      {item.destinationUrl}
                    </span>
                    {item.lastUsedAt && (
                      <span className={styles.trackedPlaceholder}>
                        {translation("Broadcast.linkLibrary.lastUsed", {
                          date: new Date(item.lastUsedAt),
                        })}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={added}
                    onClick={() => onUse(item)}
                    className={styles.kbdBtn}
                  >
                    {translation(
                      added
                        ? "Broadcast.linkLibrary.added"
                        : "Broadcast.linkLibrary.use",
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {!visible.length && (
            <div className={styles.emptyMini}>
              {translation("Broadcast.linkLibrary.noMatches")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TrackedLinksPanel({
  trackedLinks,
  trackedLinksValid,
  addTrackedLink,
  updateTrackedLink,
  removeTrackedLink,
  library = null,
  onUseLibraryLink,
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

      <LinkLibrary
        library={library}
        trackedLinks={trackedLinks}
        onUse={onUseLibraryLink}
        translation={translation}
      />

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
                type="url"
                onChange={(e) =>
                  updateTrackedLink(link.id, "destinationUrl", e.target.value)
                }
                placeholder="https://example.com/course/123"
                className={styles.input}
              />
              {link.destinationUrl.trim() && !/^https?:\/\//i.test(link.destinationUrl.trim()) && (
                <p className={styles.helpDanger}>
                  {translation("Broadcast.destinationUrlInvalid")}
                </p>
              )}
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
