"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import styles from "../templates.module.css";
import {
  HEADER_TYPES,
  LIMITS,
  appendVariable,
  extractVariables,
  makeButton,
  syncExamples,
} from "../lib/templateComponents";

/**
 * Field-based editor for the template components. It owns no state: the
 * parent passes the form and receives the whole updated form on change.
 */
export default function TemplateComponentsEditor({
  form,
  onChange,
  errors = [],
  disabled = false,
}) {
  const t = useTranslations("Templates");

  const errorsByField = useMemo(() => {
    const map = {};
    for (const e of errors) {
      if (!map[e.field]) map[e.field] = [];
      map[e.field].push(t(`editor.errors.${e.key}`, e.params));
    }
    return map;
  }, [errors, t]);

  const update = (patch) => onChange({ ...form, ...patch });
  const updateHeader = (patch) =>
    update({ header: { ...form.header, ...patch } });
  const updateBody = (text) =>
    update({
      body: { text, examples: syncExamples(text, form.body.examples) },
    });
  const updateExample = (index, value) => {
    const examples = [...form.body.examples];
    examples[index] = value;
    update({ body: { ...form.body, examples } });
  };
  const updateButton = (id, patch) =>
    update({
      buttons: form.buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  const removeButton = (id) =>
    update({ buttons: form.buttons.filter((b) => b.id !== id) });
  const addButton = (type) =>
    update({ buttons: [...form.buttons, makeButton(type)] });

  const headerHasVariable = extractVariables(form.header.text).length > 0;
  const bodyVariableCount = form.body.examples.length;
  const urlButtonCount = form.buttons.filter((b) => b.type === "URL").length;
  const canAddButton = form.buttons.length < LIMITS.buttonsMax;
  const canAddUrlButton = canAddButton && urlButtonCount < LIMITS.urlButtonsMax;

  return (
    <div className={styles.editor}>
      {/* ---------- Header ---------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <label className={styles.sectionTitle} htmlFor="tpl-header-type">
            {t("editor.header.title")}
          </label>
          <select
            id="tpl-header-type"
            className={styles.selectInline}
            value={form.header.type}
            disabled={disabled}
            onChange={(e) => updateHeader({ type: e.target.value })}
          >
            {HEADER_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`editor.header.types.${type}`)}
              </option>
            ))}
          </select>
        </div>

        {form.header.type === "text" && (
          <div className={styles.fields}>
            <Field
              id="tpl-header-text"
              label={t("editor.header.text")}
              count={form.header.text.length}
              max={LIMITS.headerTextMax}
            >
              <input
                id="tpl-header-text"
                className={styles.input}
                value={form.header.text}
                disabled={disabled}
                maxLength={LIMITS.headerTextMax + 20}
                placeholder={t("editor.header.textPlaceholder")}
                onChange={(e) => updateHeader({ text: e.target.value })}
              />
            </Field>
            {headerHasVariable && (
              <Field
                id="tpl-header-example"
                label={t("editor.header.example")}
                hint={t("editor.exampleHint")}
              >
                <input
                  id="tpl-header-example"
                  className={styles.input}
                  value={form.header.textExample}
                  disabled={disabled}
                  onChange={(e) =>
                    updateHeader({ textExample: e.target.value })
                  }
                />
              </Field>
            )}
          </div>
        )}

        {form.header.type === "image" && (
          <div className={styles.fields}>
            <Field
              id="tpl-header-image"
              label={t("editor.header.imageUrl")}
              hint={t("editor.header.imageHint")}
            >
              <input
                id="tpl-header-image"
                className={styles.input}
                value={form.header.imageUrl}
                disabled={disabled}
                placeholder="https://"
                onChange={(e) => updateHeader({ imageUrl: e.target.value })}
              />
            </Field>
          </div>
        )}

        <Errors messages={errorsByField.header} />
      </section>

      {/* ---------- Body ---------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <label className={styles.sectionTitle} htmlFor="tpl-body">
            {t("editor.body.title")}
          </label>
          <button
            type="button"
            className={styles.linkBtn}
            disabled={disabled}
            onClick={() => updateBody(appendVariable(form.body.text))}
          >
            {t("editor.body.addVariable")}
          </button>
        </div>

        <Field
          id="tpl-body"
          count={form.body.text.length}
          max={LIMITS.bodyMax}
          hint={t("editor.body.hint")}
        >
          <textarea
            id="tpl-body"
            className={styles.textarea}
            rows={6}
            value={form.body.text}
            disabled={disabled}
            placeholder={t("editor.body.placeholder")}
            onChange={(e) => updateBody(e.target.value)}
          />
        </Field>
        <Errors messages={errorsByField.body} />

        {bodyVariableCount > 0 && (
          <div className={styles.examples}>
            <div className={styles.examplesTitle}>
              {t("editor.body.examplesTitle")}
            </div>
            <div className={styles.examplesGrid}>
              {form.body.examples.map((value, i) => (
                <div key={i} className={styles.exampleRow}>
                  <code className={styles.varTag}>{`{{${i + 1}}}`}</code>
                  <input
                    aria-label={t("editor.body.exampleFor", { index: i + 1 })}
                    className={styles.input}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => updateExample(i, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <Errors messages={errorsByField.bodyExamples} />
          </div>
        )}
      </section>

      {/* ---------- Footer ---------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <label className={styles.sectionTitle} htmlFor="tpl-footer">
            {t("editor.footer.title")}
          </label>
        </div>
        <Field
          id="tpl-footer"
          count={form.footer.length}
          max={LIMITS.footerMax}
          hint={t("editor.footer.hint")}
        >
          <input
            id="tpl-footer"
            className={styles.input}
            value={form.footer}
            disabled={disabled}
            placeholder={t("editor.footer.placeholder")}
            onChange={(e) => update({ footer: e.target.value })}
          />
        </Field>
        <Errors messages={errorsByField.footer} />
      </section>

      {/* ---------- Buttons ---------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>{t("editor.buttons.title")}</span>
          <span className={styles.counter}>
            {form.buttons.length}/{LIMITS.buttonsMax}
          </span>
        </div>

        {form.buttons.length === 0 && (
          <div className={styles.hint}>{t("editor.buttons.empty")}</div>
        )}

        <div className={styles.buttonList}>
          {form.buttons.map((b, i) => {
            const hasUrlVariable = extractVariables(b.url).length > 0;
            return (
              <div key={b.id} className={styles.buttonRow}>
                <div className={styles.buttonRowHead}>
                  <span className={styles.buttonType}>
                    {t(`editor.buttons.types.${b.type}`)}
                  </span>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    disabled={disabled}
                    aria-label={t("editor.buttons.remove", { index: i + 1 })}
                    onClick={() => removeButton(b.id)}
                  >
                    {t("editor.buttons.removeLabel")}
                  </button>
                </div>

                <div className={styles.buttonFields}>
                  <Field
                    id={`tpl-btn-text-${b.id}`}
                    label={t("editor.buttons.text")}
                    count={b.text.length}
                    max={LIMITS.buttonTextMax}
                  >
                    <input
                      id={`tpl-btn-text-${b.id}`}
                      className={styles.input}
                      value={b.text}
                      disabled={disabled}
                      onChange={(e) =>
                        updateButton(b.id, { text: e.target.value })
                      }
                    />
                  </Field>

                  {b.type === "URL" && (
                    <>
                      <Field
                        id={`tpl-btn-url-${b.id}`}
                        label={t("editor.buttons.url")}
                        hint={t("editor.buttons.urlHint")}
                      >
                        <input
                          id={`tpl-btn-url-${b.id}`}
                          className={styles.input}
                          value={b.url}
                          disabled={disabled}
                          placeholder="https://"
                          onChange={(e) =>
                            updateButton(b.id, { url: e.target.value })
                          }
                        />
                      </Field>
                      {hasUrlVariable && (
                        <Field
                          id={`tpl-btn-url-example-${b.id}`}
                          label={t("editor.buttons.urlExample")}
                          hint={t("editor.exampleHint")}
                        >
                          <input
                            id={`tpl-btn-url-example-${b.id}`}
                            className={styles.input}
                            value={b.urlExample}
                            disabled={disabled}
                            onChange={(e) =>
                              updateButton(b.id, {
                                urlExample: e.target.value,
                              })
                            }
                          />
                        </Field>
                      )}
                    </>
                  )}
                </div>

                <Errors messages={errorsByField[`button:${b.id}`]} />
              </div>
            );
          })}
        </div>

        <div className={styles.addRow}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={disabled || !canAddButton}
            onClick={() => addButton("QUICK_REPLY")}
          >
            {t("editor.buttons.addQuickReply")}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={disabled || !canAddUrlButton}
            onClick={() => addButton("URL")}
          >
            {t("editor.buttons.addUrl")}
          </button>
        </div>

        <Errors messages={errorsByField.buttons} />
      </section>
    </div>
  );
}

function Field({ id, label, hint, count, max, children }) {
  const over = typeof max === "number" && count > max;
  return (
    <div className={styles.field}>
      {(label || typeof max === "number") && (
        <div className={styles.fieldHead}>
          {label ? (
            <label className={styles.label} htmlFor={id}>
              {label}
            </label>
          ) : (
            <span />
          )}
          {typeof max === "number" && (
            <span className={over ? styles.counterOver : styles.counter}>
              {count}/{max}
            </span>
          )}
        </div>
      )}
      {children}
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}

function Errors({ messages }) {
  if (!messages?.length) return null;
  return (
    <ul className={styles.errorList} role="alert">
      {messages.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>
  );
}
