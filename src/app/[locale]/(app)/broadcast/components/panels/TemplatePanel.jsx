import styles from "../../broadcast.module.css";
import { COMPANY_KEYS, NAME_KEYS, isLockedVar } from "../../lib/constants";
import WhatsAppPreview from "./WhatsAppPreview";

export default function TemplatePanel({
  tplErr,
  tplLoading,
  nameOptions,
  tplName,
  setTplName,
  varDefs,
  varValues,
  setVarValues,
  tplLang,
  tplParamsManual,
  setTplParamsManual,
  paramsComplete,
  org,
  sampleRecipient,
  preview,
  previewTime,
  translation,
}) {
  return (
    <div className={styles.toolPanelCard}>
      <div className={styles.panelTitle}>Pré-Visualização do Template</div>

      {tplErr && <div className={styles.errorBox}>{tplErr}</div>}

      <div className={styles.templateCardBody}>
        <div className={styles.templateFields}>
          <div className={styles.field}>
            <div className={styles.label}>
              {translation("Broadcast.template")}
            </div>

            <select
              disabled={tplLoading || nameOptions.length === 0}
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              className={styles.select}
            >
              {nameOptions.length === 0 ? (
                <option value="">{translation("Broadcast.noTemplates")}</option>
              ) : (
                nameOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))
              )}
            </select>
          </div>

          {varDefs.length > 0 ? (
            <div className={styles.gridSingle}>
              {varDefs.map((v) => {
                const kLower = String(v.key || "").toLowerCase();
                const locked = isLockedVar(kLower);

                let displayVal = varValues[v.key] ?? "";

                if (!displayVal && COMPANY_KEYS.includes(kLower)) {
                  displayVal = org?.name || "";
                }

                if (!displayVal && NAME_KEYS.includes(kLower)) {
                  displayVal = sampleRecipient?.name || "";
                }

                const placeholder =
                  v.examplesLocale?.[tplLang]?.exampleValueStrings?.[0] ??
                  (v.examplesLocale
                    ? v.examplesLocale[Object.keys(v.examplesLocale)[0]]
                        ?.exampleValueStrings?.[0]
                    : "") ??
                  "";

                return (
                  <div key={v.key} className={styles.fieldWide}>
                    <label className={styles.smallLabel}>
                      {v.key}
                      {v.characterLimit ? ` · máx ${v.characterLimit}` : ""}
                      {v.description ? ` — ${v.description}` : ""}
                    </label>

                    {locked ? (
                      <div className={styles.lockedField}>
                        {displayVal || "—"}
                      </div>
                    ) : (
                      <input
                        value={varValues[v.key] ?? ""}
                        onChange={(e) =>
                          setVarValues((prev) => ({
                            ...prev,
                            [v.key]: e.target.value,
                          }))
                        }
                        placeholder={placeholder}
                        maxLength={v.characterLimit || undefined}
                        className={styles.input}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.fieldWide}>
              <label className={styles.smallLabel}>
                {translation("Broadcast.varKeyDesc")}
              </label>

              <input
                value={tplParamsManual}
                onChange={(e) => setTplParamsManual(e.target.value)}
                placeholder="name=Gaspar,url=?session=123"
                className={styles.input}
              />
            </div>
          )}

          {!paramsComplete && (
            <div className={styles.helpDanger}>
              {translation("Common.error")}
            </div>
          )}
        </div>

        <aside className={styles.templatePreviewCol}>
          <WhatsAppPreview
            preview={preview}
            previewTime={previewTime}
            sampleRecipient={sampleRecipient}
            translation={translation}
          />
        </aside>
      </div>
    </div>
  );
}
