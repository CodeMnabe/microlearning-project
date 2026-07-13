import styles from "../templates.module.css";

export default function TemplateSendTestModal({
  translation,
  template,
  sendTo,
  sendParams,
  sendUrlVar,
  loading,
  onClose,
  onSendToChange,
  onSendParamsChange,
  onSendUrlVarChange,
  onSubmit,
}) {
  if (!template) return null;

  return (
    <div className={styles.modalOverlay} role="presentation">
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-template-test-title"
      >
        <div className={styles.modalHeader}>
          <h2 id="send-template-test-title" className={styles.modalTitle}>
            {translation("modal.title")}
          </h2>
          <button type="button" onClick={onClose} className={styles.ghostButton}>
            {translation("modal.close")}
          </button>
        </div>
        <p className={styles.templateMeta}>
          {template.name} · {template.language} · {template.category}
        </p>
        <form onSubmit={onSubmit}>
          <label className={styles.label} htmlFor="send-template-to">
            {translation("modal.to")}
          </label>
          <input
            id="send-template-to"
            value={sendTo}
            onChange={(event) => onSendToChange(event.target.value)}
            placeholder="+3519XXXXXXXX"
            className={styles.input}
          />

          <label className={`${styles.label} ${styles.spacedLabel}`} htmlFor="send-template-params">
            {translation("modal.bodyParams")}
          </label>
          <input
            id="send-template-params"
            value={sendParams}
            onChange={(event) => onSendParamsChange(event.target.value)}
            placeholder="João, Verificar pressão dos pneus"
            className={styles.input}
          />

          <label className={`${styles.label} ${styles.spacedLabel}`} htmlFor="send-template-url-var">
            {translation("modal.urlVar")}
          </label>
          <input
            id="send-template-url-var"
            value={sendUrlVar}
            onChange={(event) => onSendUrlVarChange(event.target.value)}
            placeholder="session-12345"
            className={styles.input}
          />

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} className={styles.secondaryButton}>
              {translation("modal.cancel")}
            </button>
            <button type="submit" disabled={loading} className={styles.primaryButton}>
              {loading ? translation("modal.sending") : translation("modal.send")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
