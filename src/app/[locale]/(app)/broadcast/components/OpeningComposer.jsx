"use client";

import OpeningMessageEditor from "@/app/components/WhatsAppPhone/OpeningMessageEditor";
import { sanitizeOpeningBody } from "@/lib/whatsapp/openingTemplate";

import styles from "../broadcast.module.css";

/**
 * Composição da mensagem de abertura: o template aprovado, com o corpo
 * editável só para este envio.
 */
export default function OpeningComposer({
  info,
  body,
  onBodyChange,
  loading,
  failed,
  onRetry,
  sampleName,
  orgName,
  previewTime,
  translation,
}) {
  if (loading) {
    return (
      <div className={styles.composerHint}>
        {translation("Broadcast.composer.openingLoading")}
      </div>
    );
  }

  if (failed || !info) {
    return (
      <div className={styles.errorBox} role="alert">
        <div>{translation("Broadcast.composer.openingLoadFailed")}</div>
        <button
          type="button"
          className={styles.kbdBtn}
          style={{ marginTop: 8 }}
          onClick={onRetry}
        >
          {translation("Broadcast.composer.retry")}
        </button>
      </div>
    );
  }

  const cleanLength = sanitizeOpeningBody(body).length;
  const maxLength = info.maxLength || 600;
  const tooLong = cleanLength > maxLength;

  return (
    <>
      <div className={styles.composerHint}>
        {translation("Broadcast.composer.openingHint")}
      </div>

      <div className={styles.phoneWrap}>
        <OpeningMessageEditor
          intro={info.intro}
          outro={info.outro}
          button={info.button}
          body={body}
          onBodyChange={onBodyChange}
          sampleName={sampleName}
          orgName={orgName}
          placeholder={translation("Broadcast.composer.openingPlaceholder")}
          ariaLabel={translation("Broadcast.composer.openingBody")}
          inputId="broadcast-opening-body"
          time={previewTime}
        />
      </div>

      <div className={styles.openingMeta}>
        <div className={`${styles.counter} ${tooLong ? styles.counterOver : ""}`}>
          {translation("Broadcast.composer.openingCounter", {
            count: cleanLength,
            max: maxLength,
          })}
        </div>
      </div>
    </>
  );
}
