"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import styles from "../templates.module.css";
import { previewFromForm } from "../lib/templateComponents";

/** Phone-style preview of the template being created, using example values. */
export default function TemplatePreview({ form, time, compact = false }) {
  const t = useTranslations("Templates");
  const preview = useMemo(() => previewFromForm(form), [form]);

  const urlButtons = compact
    ? []
    : preview.buttons.filter((b) => b.type === "URL" && b.url);

  return (
    <div
      className={compact ? styles.previewCompact : styles.preview}
      data-testid="template-preview"
    >
      {!compact && (
        <div className={styles.previewTitle}>{t("preview.title")}</div>
      )}

      <div className={styles.waFrame}>
        <div className={styles.waHeader}>
          <div className={styles.waAvatar}>U</div>
          <div className={styles.waHeaderText}>
            <div className={styles.waTitle}>{t("preview.contact")}</div>
            <div className={styles.waSubtitle}>online</div>
          </div>
        </div>

        <div className={styles.waChat}>
          {preview.isEmpty ? (
            <div className={styles.waEmpty}>{t("preview.empty")}</div>
          ) : (
            <div className={styles.waRowOut}>
              <div className={styles.waBubble}>
                {preview.header?.type === "image" && (
                  <div className={styles.waImage}>{t("preview.image")}</div>
                )}
                {preview.header?.type === "text" && (
                  <div className={styles.waHeadline}>{preview.header.text}</div>
                )}
                {preview.body && (
                  <div className={styles.waText}>{preview.body}</div>
                )}
                {preview.footer && (
                  <div className={styles.waFooter}>{preview.footer}</div>
                )}
                <div className={styles.waMeta}>{time} ✓✓</div>
              </div>
            </div>
          )}

          {preview.buttons.length > 0 && (
            <div className={styles.waButtons}>
              {preview.buttons.map((b, i) => (
                <div key={i} className={styles.waButton}>
                  {b.type === "URL" ? "↗ " : ""}
                  {b.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {urlButtons.map((b, i) => (
        <div key={i} className={styles.previewUrlHint}>
          {b.text}: {b.url}
        </div>
      ))}
    </div>
  );
}
