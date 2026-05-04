import styles from "../../broadcast.module.css";

export default function WhatsAppPreview({
  preview,
  previewTime,
  sampleRecipient,
  translation,
}) {
  if (!preview.body && !preview.buttonText && !preview.buttonUrl) {
    return (
      <div className={styles.previewPlaceholder}>
        {translation("Common.noResults")}
      </div>
    );
  }

  return (
    <>
      <div className={`${styles.waFrame} ${styles.waFrameSmall}`}>
        <div className={styles.waHeader}>
          <div className={styles.waAvatar}>U</div>

          <div className={styles.waHeaderText}>
            <div className={styles.waTitle}>
              {sampleRecipient?.name || translation("Common.none")}
            </div>
            <div className={styles.waSubtitle}>online</div>
          </div>

          <div className={styles.waIcons}>⋯</div>
        </div>

        <div className={styles.waChat}>
          <div className={styles.waRowOut}>
            <div className={styles.waBubbleOut}>
              <span className={styles.waText}>{preview.body || "—"}</span>
              <span className={styles.waMeta}>{previewTime} ✓✓</span>
            </div>
          </div>

          {(preview.buttonText || preview.buttonUrl) && (
            <div className={styles.waRowOut}>
              <button className={styles.waCtaBtn} type="button">
                {preview.buttonText || "Abrir"}
              </button>
            </div>
          )}
        </div>
      </div>

      {preview.buttonUrl && (
        <div className={styles.previewUrlHint}>URL: {preview.buttonUrl}</div>
      )}
    </>
  );
}
