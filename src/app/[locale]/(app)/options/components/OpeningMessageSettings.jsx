"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import WhatsAppPhone, {
  WhatsAppBubble,
  WhatsAppButton,
} from "@/app/components/WhatsAppPhone/WhatsAppPhone";
import { sanitizeOpeningBody } from "@/lib/whatsapp/openingTemplate";

import styles from "../options.module.css";

function fillSample(text, values) {
  return String(text || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    values[key] == null ? "" : String(values[key]),
  );
}

/**
 * Edição do corpo do template de abertura WhatsApp.
 *
 * O balão mostra a mensagem como o contacto a vê: início e fim fixos, e o
 * corpo editável no próprio balão.
 */
export default function OpeningMessageSettings({ orgId, orgName }) {
  const translation = useTranslations("OpeningMessage");

  const [item, setItem] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedRecently, setSavedRecently] = useState(false);

  const inputRef = useRef(null);

  const load = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    setLoadFailed(false);

    try {
      const res = await fetch(`/api/organizations/opening-message?orgId=${orgId}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.item) {
        throw new Error(data?.error || "Failed to load opening message");
      }

      setItem(data.item);
      setDraft(data.item.body || "");
    } catch (err) {
      console.warn("[OpeningMessage] load error:", err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  // O campo cresce com o texto para o balão parecer uma mensagem real.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, item]);

  useEffect(() => {
    if (!savedRecently) return;
    const timeout = setTimeout(() => setSavedRecently(false), 3000);
    return () => clearTimeout(timeout);
  }, [savedRecently]);

  const maxLength = item?.maxLength || 600;
  const cleanDraft = useMemo(() => sanitizeOpeningBody(draft), [draft]);
  const isDirty = Boolean(item) && cleanDraft !== item.body;
  const isEmpty = cleanDraft.length === 0;
  const isTooLong = cleanDraft.length > maxLength;
  const canSave = isDirty && !isEmpty && !isTooLong && !saving;

  const sampleValues = useMemo(
    () => ({
      nome: translation("sampleName"),
      empresa: orgName || "",
    }),
    [translation, orgName],
  );

  async function handleSave() {
    if (!canSave) return;

    setSaving(true);
    setSaveError("");

    try {
      const res = await fetch("/api/organizations/opening-message", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, body: cleanDraft }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.item) {
        throw new Error(data?.error || "Failed to save opening message");
      }

      setItem(data.item);
      setDraft(data.item.body || "");
      setSavedRecently(true);
    } catch (err) {
      console.warn("[OpeningMessage] save error:", err);
      setSaveError(translation("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!item) return;
    setDraft(item.defaultBody || "");
    inputRef.current?.focus();
  }

  if (loading) {
    return <div className={styles.note}>{translation("loading")}</div>;
  }

  if (loadFailed || !item) {
    return (
      <div className={styles.error} role="alert">
        <div>{translation("loadFailed")}</div>
        <div className={styles.actions} style={{ marginTop: 8 }}>
          <button type="button" className={styles.secondaryBtn} onClick={load}>
            {translation("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.opening}>
      <WhatsAppPhone contactName={translation("sampleName")}>
        <WhatsAppBubble>
          <span className={styles.fixedText}>
            {fillSample(item.intro, sampleValues)}
          </span>

          <textarea
            ref={inputRef}
            id="opening-body"
            aria-label={translation("bodyLabel")}
            className={styles.bodyInput}
            rows={3}
            value={draft}
            disabled={saving}
            placeholder={translation("bodyPlaceholder")}
            onChange={(e) => setDraft(e.target.value)}
          />

          <span className={styles.fixedText}>{item.outro}</span>
        </WhatsAppBubble>

        <WhatsAppButton>{item.button}</WhatsAppButton>
      </WhatsAppPhone>

      <div className={styles.side}>
        <label htmlFor="opening-body" className={styles.sideLabel}>
          {translation("bodyLabel")}
        </label>

        <div
          className={`${styles.counter} ${isTooLong ? styles.counterOver : ""}`}
        >
          {translation("counter", { count: cleanDraft.length, max: maxLength })}
        </div>

        {item.isDefault && !isDirty ? (
          <div className={styles.note}>{translation("usingDefault")}</div>
        ) : null}

        {isEmpty ? (
          <div className={styles.note}>{translation("empty")}</div>
        ) : null}

        {isTooLong ? (
          <div className={`${styles.note} ${styles.counterOver}`}>
            {translation("tooLong", { max: maxLength })}
          </div>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!canSave}
            onClick={handleSave}
          >
            {saving ? translation("saving") : translation("save")}
          </button>

          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={saving || cleanDraft === item.defaultBody}
            onClick={handleReset}
          >
            {translation("reset")}
          </button>

          {savedRecently ? (
            <span className={styles.feedback} role="status">
              {translation("saved")}
            </span>
          ) : null}
        </div>

        {saveError ? (
          <div className={styles.error} role="alert">
            {saveError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
