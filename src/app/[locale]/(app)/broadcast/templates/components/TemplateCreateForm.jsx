import styles from "../templates.module.css";

export default function TemplateCreateForm({
  translation,
  form,
  loading,
  onSubmit,
  onFieldChange,
  onPresetChange,
  onResetPreset,
}) {
  return (
    <section>
      <form onSubmit={onSubmit} className={styles.createForm}>
        <div className={styles.formFields}>
          <div>
            <label className={styles.label} htmlFor="template-name">
              {translation("createForm.name")}
            </label>
            <input
              id="template-name"
              value={form.name}
              onChange={(event) => onFieldChange("name", event.target.value)}
              placeholder="ml_tip_image_v1"
              className={styles.input}
            />
          </div>
          <div>
            <label className={styles.label} htmlFor="template-language">
              {translation("createForm.language")}
            </label>
            <input
              id="template-language"
              value={form.language}
              onChange={(event) => onFieldChange("language", event.target.value)}
              placeholder="pt"
              className={styles.input}
            />
          </div>
          <div>
            <label className={styles.label} htmlFor="template-category">
              {translation("createForm.category")}
            </label>
            <select
              id="template-category"
              value={form.category}
              onChange={(event) => onFieldChange("category", event.target.value)}
              className={styles.input}
            >
              <option value="MARKETING">{translation("MARKETING")}</option>
              <option value="UTILITY">{translation("UTILITY")}</option>
              <option value="AUTHENTICATION">
                {translation("AUTHENTICATION")}
              </option>
            </select>
          </div>
          <div>
            <label className={styles.label} htmlFor="template-preset">
              {translation("createForm.preset")}
            </label>
            <select
              id="template-preset"
              value={form.presetKey}
              onChange={(event) => onPresetChange(event.target.value)}
              className={styles.input}
            >
              <option value="text_quickreplies">
                {translation("text_quickreplies")}
              </option>
              <option value="image_header_quickreplies">
                {translation("image_header_quickreplies")}
              </option>
              <option value="quiz_url_button">
                {translation("quiz_url_button")}
              </option>
            </select>
          </div>
        </div>

        <div>
          <label className={styles.label} htmlFor="template-components">
            {translation("createForm.components")}
          </label>
          <textarea
            id="template-components"
            value={form.componentsText}
            onChange={(event) =>
              onFieldChange("componentsText", event.target.value)
            }
            spellCheck={false}
            rows={18}
            className={`${styles.input} ${styles.componentsInput}`}
          />
        </div>

        <div className={styles.formActions}>
          <button type="submit" disabled={loading} className={styles.primaryButton}>
            {loading
              ? translation("createForm.creating")
              : translation("createForm.submit")}
          </button>
          <button
            type="button"
            onClick={onResetPreset}
            className={styles.secondaryButton}
          >
            {translation("createForm.reset")}
          </button>
        </div>
      </form>
    </section>
  );
}
