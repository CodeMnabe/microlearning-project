"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import styles from "../templates.module.css";
import VariableTextEditor from "./VariableTextEditor";
import {
  LIMITS,
  VARIABLE_KINDS,
  defaultExampleFor,
  makeButton,
  removeVariable,
} from "../lib/templateComponents";

const URL_VAR_SUFFIX = /\{\{\s*1\s*\}\}\s*$/;
const EMPTY_HEADER = { type: "none", text: "", textExample: "", imageUrl: "" };

/**
 * The template as a vertical stack of blocks in the order they appear on the
 * phone. Only the message block exists by default; the rest is added from a
 * single "Add" menu and removed with an "x". The form shape is unchanged.
 */
export default function TemplateBlocksEditor({
  form,
  onChange,
  errors = [],
  disabled = false,
  context = {},
}) {
  const t = useTranslations("Templates");
  const editorRef = useRef(null);
  const [added, setAdded] = useState(() => new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeVar, setActiveVar] = useState(null);

  const labelFor = useCallback(
    (kind) => t(`builder.variables.kinds.${kind}`),
    [t],
  );

  const errorsByField = useMemo(() => {
    const map = {};
    for (const e of errors) {
      if (!map[e.field]) map[e.field] = [];
      map[e.field].push(t(`editor.errors.${e.key}`, e.params));
    }
    return map;
  }, [errors, t]);

  const quick = form.buttons.filter((b) => b.type === "QUICK_REPLY");
  const links = form.buttons.filter((b) => b.type === "URL");

  const present = {
    image: form.header.type === "image",
    title: form.header.type === "text",
    footer: added.has("footer") || form.footer !== "",
    quick: added.has("quick") || quick.length > 0,
    link: added.has("link") || links.length > 0,
  };

  const update = (patch) => onChange({ ...form, ...patch });
  const setButtons = (q, l) => update({ buttons: [...q, ...l] });
  const updateButton = (id, patch) =>
    update({
      buttons: form.buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  const dropButton = (id) =>
    update({ buttons: form.buttons.filter((b) => b.id !== id) });

  const markAdded = (key, on) =>
    setAdded((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const addBlock = (key) => {
    setMenuOpen(false);
    markAdded(key, true);
    if (key === "image") update({ header: { ...EMPTY_HEADER, type: "image" } });
    if (key === "title") update({ header: { ...EMPTY_HEADER, type: "text" } });
    if (key === "quick") setButtons([...quick, makeButton("QUICK_REPLY")], links);
    if (key === "link") setButtons(quick, [...links, makeButton("URL")]);
  };

  const removeBlock = (key) => {
    markAdded(key, false);
    if (key === "image" || key === "title") update({ header: EMPTY_HEADER });
    if (key === "footer") update({ footer: "" });
    if (key === "quick") setButtons([], links);
    if (key === "link") setButtons(quick, []);
  };

  // ---------- body variables ----------
  const body = form.body;

  const onBodyChange = ({ text, kinds, examples }) =>
    update({ body: { text, kinds, examples } });

  const insertVariable = (kind) => {
    const example = defaultExampleFor(kind, context);
    const index = editorRef.current?.insertVariable(kind, example);
    setActiveVar(kind === "custom" && typeof index === "number" ? index : null);
  };

  const setVarKind = (index, kind) => {
    const kinds = [...body.kinds];
    const examples = [...body.examples];
    const previousDefault = defaultExampleFor(kinds[index], context);
    kinds[index] = kind;
    if (!examples[index] || examples[index] === previousDefault) {
      examples[index] = defaultExampleFor(kind, context);
    }
    update({ body: { ...body, kinds, examples } });
  };

  const setVarExample = (index, value) => {
    const examples = [...body.examples];
    examples[index] = value;
    update({ body: { ...body, examples } });
  };

  const dropVariable = (index) => {
    update({ body: removeVariable(body, index) });
    setActiveVar(null);
  };

  const activeVarValid =
    activeVar !== null && activeVar >= 0 && activeVar < body.kinds.length;

  // ---------- add menu ----------
  const totalButtons = form.buttons.length;
  const topTaken = present.image || present.title;
  const menuItems = [
    !present.image && {
      key: "image",
      disabled: topTaken,
      hint: topTaken ? t("builder.add.onlyOneTop") : null,
    },
    !present.title && {
      key: "title",
      disabled: topTaken,
      hint: topTaken ? t("builder.add.onlyOneTop") : null,
    },
    !present.footer && { key: "footer", disabled: false, hint: null },
    !present.quick && {
      key: "quick",
      disabled: totalButtons >= LIMITS.buttonsMax,
      hint:
        totalButtons >= LIMITS.buttonsMax
          ? t("builder.add.maxButtons", { max: LIMITS.buttonsMax })
          : null,
    },
    !present.link && {
      key: "link",
      disabled: totalButtons >= LIMITS.buttonsMax,
      hint:
        totalButtons >= LIMITS.buttonsMax
          ? t("builder.add.maxButtons", { max: LIMITS.buttonsMax })
          : null,
    },
  ].filter(Boolean);

  const canAddQuick = totalButtons < LIMITS.buttonsMax;
  const canAddLink =
    totalButtons < LIMITS.buttonsMax && links.length < LIMITS.urlButtonsMax;

  return (
    <div className={styles.blocks}>
      {present.image && (
        <Block
          title={t("builder.blocks.image.title")}
          hint={t("builder.blocks.image.hint")}
          onRemove={() => removeBlock("image")}
          removeLabel={t("builder.remove")}
          disabled={disabled}
          errors={errorsByField.header}
        >
          <Field id="tpl-image-url" label={t("builder.blocks.image.url")}>
            <input
              id="tpl-image-url"
              className={styles.input}
              value={form.header.imageUrl}
              disabled={disabled}
              placeholder="https://"
              onChange={(e) =>
                update({ header: { ...form.header, imageUrl: e.target.value } })
              }
            />
          </Field>
        </Block>
      )}

      {present.title && (
        <Block
          title={t("builder.blocks.title.title")}
          hint={t("builder.blocks.title.hint")}
          onRemove={() => removeBlock("title")}
          removeLabel={t("builder.remove")}
          disabled={disabled}
          errors={errorsByField.header}
        >
          <Field
            id="tpl-title"
            count={form.header.text.length}
            max={LIMITS.headerTextMax}
          >
            <input
              id="tpl-title"
              aria-label={t("builder.blocks.title.title")}
              className={styles.input}
              value={form.header.text}
              disabled={disabled}
              onChange={(e) =>
                update({ header: { ...form.header, text: e.target.value } })
              }
            />
          </Field>
        </Block>
      )}

      <Block
        title={t("builder.blocks.body.title")}
        hint={t("builder.blocks.body.hint")}
        errors={[
          ...(errorsByField.body || []),
          ...(errorsByField.bodyExamples || []),
        ]}
      >
        <div className={styles.toolbar}>
          <span className={styles.toolbarLabel}>
            {t("builder.blocks.body.insert")}
          </span>
          {VARIABLE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={styles.chipBtn}
              disabled={disabled}
              onClick={() => insertVariable(kind)}
            >
              + {labelFor(kind)}
            </button>
          ))}
        </div>

        <VariableTextEditor
          ref={editorRef}
          ariaLabel={t("builder.blocks.body.title")}
          value={body.text}
          kinds={body.kinds}
          examples={body.examples}
          labelFor={labelFor}
          placeholder={t("builder.blocks.body.placeholder")}
          disabled={disabled}
          onChange={onBodyChange}
          onChipClick={(index) => setActiveVar(index)}
        />
        <Counter count={body.text.length} max={LIMITS.bodyMax} />

        {activeVarValid && (
          <div className={styles.inspector} data-testid="variable-inspector">
            <div className={styles.inspectorHead}>
              <strong>
                {t("builder.variables.inspector.title", {
                  index: activeVar + 1,
                })}
              </strong>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setActiveVar(null)}
              >
                {t("builder.variables.inspector.close")}
              </button>
            </div>
            <div className={styles.inspectorFields}>
              <Field
                id="tpl-var-kind"
                label={t("builder.variables.inspector.kind")}
              >
                <select
                  id="tpl-var-kind"
                  className={styles.input}
                  value={body.kinds[activeVar]}
                  disabled={disabled}
                  onChange={(e) => setVarKind(activeVar, e.target.value)}
                >
                  {VARIABLE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {labelFor(kind)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id="tpl-var-example"
                label={t("builder.variables.inspector.example")}
                hint={t("builder.variables.inspector.exampleHint")}
              >
                <input
                  id="tpl-var-example"
                  className={styles.input}
                  value={body.examples[activeVar] || ""}
                  disabled={disabled}
                  onChange={(e) => setVarExample(activeVar, e.target.value)}
                />
              </Field>
            </div>
            <button
              type="button"
              className={styles.linkBtn}
              disabled={disabled}
              onClick={() => dropVariable(activeVar)}
            >
              {t("builder.variables.inspector.remove")}
            </button>
          </div>
        )}
      </Block>

      {present.footer && (
        <Block
          title={t("builder.blocks.footer.title")}
          hint={t("builder.blocks.footer.hint")}
          onRemove={() => removeBlock("footer")}
          removeLabel={t("builder.remove")}
          disabled={disabled}
          errors={errorsByField.footer}
        >
          <Field
            id="tpl-footer"
            count={form.footer.length}
            max={LIMITS.footerMax}
          >
            <input
              id="tpl-footer"
              aria-label={t("builder.blocks.footer.title")}
              className={styles.input}
              value={form.footer}
              disabled={disabled}
              placeholder={t("builder.blocks.footer.placeholder")}
              onChange={(e) => update({ footer: e.target.value })}
            />
          </Field>
        </Block>
      )}

      {present.quick && (
        <Block
          title={t("builder.blocks.quick.title")}
          hint={t("builder.blocks.quick.hint")}
          onRemove={() => removeBlock("quick")}
          removeLabel={t("builder.remove")}
          disabled={disabled}
          errors={errorsByField.buttons}
        >
          <div className={styles.itemList}>
            {quick.map((b, i) => (
              <div key={b.id} className={styles.itemRow}>
                <input
                  aria-label={t("builder.blocks.quick.item", { index: i + 1 })}
                  className={styles.input}
                  value={b.text}
                  maxLength={LIMITS.buttonTextMax}
                  disabled={disabled}
                  placeholder={t("builder.blocks.quick.placeholder")}
                  onChange={(e) => updateButton(b.id, { text: e.target.value })}
                />
                <Counter count={b.text.length} max={LIMITS.buttonTextMax} />
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={t("builder.removeItem", { index: i + 1 })}
                  disabled={disabled}
                  onClick={() => dropButton(b.id)}
                >
                  ×
                </button>
                <Errors messages={errorsByField[`button:${b.id}`]} wide />
              </div>
            ))}
          </div>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={disabled || !canAddQuick}
            onClick={() => setButtons([...quick, makeButton("QUICK_REPLY")], links)}
          >
            + {t("builder.blocks.quick.add")}
          </button>
        </Block>
      )}

      {present.link && (
        <Block
          title={t("builder.blocks.link.title")}
          hint={t("builder.blocks.link.hint")}
          onRemove={() => removeBlock("link")}
          removeLabel={t("builder.remove")}
          disabled={disabled}
          errors={present.quick ? null : errorsByField.buttons}
        >
          <div className={styles.itemList}>
            {links.map((b, i) => {
              const dynamic = URL_VAR_SUFFIX.test(b.url);
              const base = b.url.replace(URL_VAR_SUFFIX, "");
              return (
                <div key={b.id} className={styles.linkCard}>
                  <div className={styles.linkCardHead}>
                    <span className={styles.blockSubtitle}>
                      {t("builder.blocks.link.item", { index: i + 1 })}
                    </span>
                    {links.length > 1 && (
                      <button
                        type="button"
                        className={styles.linkBtn}
                        disabled={disabled}
                        onClick={() => dropButton(b.id)}
                      >
                        {t("builder.remove")}
                      </button>
                    )}
                  </div>
                  <Field
                    id={`tpl-link-text-${b.id}`}
                    label={t("builder.blocks.link.text")}
                    count={b.text.length}
                    max={LIMITS.buttonTextMax}
                  >
                    <input
                      id={`tpl-link-text-${b.id}`}
                      className={styles.input}
                      value={b.text}
                      maxLength={LIMITS.buttonTextMax}
                      disabled={disabled}
                      onChange={(e) =>
                        updateButton(b.id, { text: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    id={`tpl-link-url-${b.id}`}
                    label={t("builder.blocks.link.url")}
                  >
                    <div className={styles.urlRow}>
                      <input
                        id={`tpl-link-url-${b.id}`}
                        className={styles.input}
                        value={base}
                        disabled={disabled}
                        placeholder="https://"
                        onChange={(e) =>
                          updateButton(b.id, {
                            url: e.target.value + (dynamic ? "{{1}}" : ""),
                          })
                        }
                      />
                      {dynamic && (
                        <span className={styles.urlSuffix}>
                          {t("builder.blocks.link.suffix")}
                        </span>
                      )}
                    </div>
                  </Field>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={dynamic}
                      disabled={disabled}
                      onChange={(e) =>
                        updateButton(b.id, {
                          url: e.target.checked ? `${base}{{1}}` : base,
                          urlExample: e.target.checked ? b.urlExample : "",
                        })
                      }
                    />
                    <span>{t("builder.blocks.link.dynamic")}</span>
                  </label>
                  {dynamic && (
                    <Field
                      id={`tpl-link-example-${b.id}`}
                      label={t("builder.blocks.link.example")}
                      hint={t("builder.blocks.link.dynamicHint")}
                    >
                      <input
                        id={`tpl-link-example-${b.id}`}
                        className={styles.input}
                        value={b.urlExample}
                        disabled={disabled}
                        onChange={(e) =>
                          updateButton(b.id, { urlExample: e.target.value })
                        }
                      />
                    </Field>
                  )}
                  <Errors messages={errorsByField[`button:${b.id}`]} />
                </div>
              );
            })}
          </div>
          {canAddLink && (
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={disabled}
              onClick={() => setButtons(quick, [...links, makeButton("URL")])}
            >
              + {t("builder.blocks.link.add")}
            </button>
          )}
        </Block>
      )}

      {menuItems.length > 0 && (
        <div className={styles.addWrap}>
          <button
            type="button"
            className={styles.addBtn}
            disabled={disabled}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            + {t("builder.add.label")}
          </button>
          {menuOpen && (
            <div className={styles.addMenu} role="menu">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className={styles.addMenuItem}
                  disabled={item.disabled}
                  onClick={() => addBlock(item.key)}
                >
                  <span>{t(`builder.blocks.${item.key}.title`)}</span>
                  <span className={styles.addMenuHint}>
                    {item.hint || t(`builder.blocks.${item.key}.hint`)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Block({
  title,
  hint,
  onRemove,
  removeLabel,
  disabled,
  errors,
  children,
}) {
  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <div>
          <div className={styles.blockTitle}>{title}</div>
          {hint && <div className={styles.blockHint}>{hint}</div>}
        </div>
        {onRemove && (
          <button
            type="button"
            className={styles.linkBtn}
            disabled={disabled}
            aria-label={`${removeLabel}: ${title}`}
            onClick={onRemove}
          >
            {removeLabel}
          </button>
        )}
      </div>
      <div className={styles.blockBody}>{children}</div>
      <Errors messages={errors} />
    </section>
  );
}

function Field({ id, label, hint, count, max, children }) {
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
          {typeof max === "number" && <Counter count={count} max={max} />}
        </div>
      )}
      {children}
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}

function Counter({ count, max }) {
  const over = count > max;
  return (
    <span className={over ? styles.counterOver : styles.counter}>
      {count}/{max}
    </span>
  );
}

function Errors({ messages, wide = false }) {
  if (!messages?.length) return null;
  return (
    <ul
      className={wide ? `${styles.errorList} ${styles.wide}` : styles.errorList}
      role="alert"
    >
      {messages.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>
  );
}
