import styles from "../admin.module.css";

import ThemePreview from "./ThemePreview";

/**
 * Card de edição de tema de uma organização.
 *
 * Permite alterar cores primária/secundária e ver preview visual
 * antes de guardar na base de dados.
 */
export default function OrganizationThemeCard({
  org,
  translation,
  savingId,
  onColorChange,
  onSave,
}) {
  const isSaving = savingId === org.id;

  return (
    <div className={styles.changeThemesWrapper}>
      <div>
        <div className={styles.orgName}>
          #{org.id} — {org.name}
        </div>

        <div className={styles.themesQuery}>
          <label className={styles.colorPicker}>
            <span style={{ width: 80 }}>{translation("themes.primary")}</span>

            <input
              type="color"
              value={org.theme.primary}
              onChange={(event) =>
                onColorChange(org.id, "primary", event.target.value)
              }
              className={styles.colorInput}
            />

            <input
              value={org.theme.primary}
              onChange={(event) =>
                onColorChange(org.id, "primary", event.target.value)
              }
              className={styles.colorTextInput}
            />
          </label>

          <label className={styles.colorPicker}>
            <span style={{ width: 80 }}>
              {translation("themes.secondary")}
            </span>

            <input
              type="color"
              value={org.theme.secondary}
              onChange={(event) =>
                onColorChange(org.id, "secondary", event.target.value)
              }
              className={styles.colorInput}
            />

            <input
              value={org.theme.secondary}
              onChange={(event) =>
                onColorChange(org.id, "secondary", event.target.value)
              }
              className={styles.colorTextInput}
            />
          </label>

          <button
            onClick={() => onSave(org)}
            disabled={isSaving}
            className={styles.saveButton}
          >
            {isSaving ? translation("themes.saving") : translation("themes.save")}
          </button>
        </div>
      </div>

      <div className={styles.livePreviewWrapper}>
        <ThemePreview
        theme={org.theme}
        orgName={org.name}
        logoUrl={org.logo_url}
        />
      </div>
    </div>
  );
}