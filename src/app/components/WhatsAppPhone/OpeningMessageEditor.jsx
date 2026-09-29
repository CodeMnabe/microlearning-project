"use client";

import { useEffect, useMemo, useRef } from "react";

import WhatsAppPhone, { WhatsAppBubble, WhatsAppButton } from "./WhatsAppPhone";
import styles from "./whatsAppPhone.module.css";

function fillSample(text, values) {
  return String(text || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    values[key] == null ? "" : String(values[key]),
  );
}

/**
 * O template de abertura tal como o contacto o vê, com o corpo editável no
 * próprio balão. O início e o fim são fixos.
 */
export default function OpeningMessageEditor({
  intro,
  outro,
  button,
  body,
  onBodyChange,
  disabled = false,
  sampleName,
  orgName,
  placeholder,
  ariaLabel,
  inputId,
  time,
}) {
  const inputRef = useRef(null);

  const sampleValues = useMemo(
    () => ({ nome: sampleName || "", empresa: orgName || "" }),
    [sampleName, orgName],
  );

  // O campo cresce com o texto para o balão parecer uma mensagem real.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  return (
    <WhatsAppPhone contactName={sampleName}>
      <WhatsAppBubble time={time}>
        <span className={styles.fixedText}>{fillSample(intro, sampleValues)}</span>

        <textarea
          ref={inputRef}
          id={inputId}
          aria-label={ariaLabel}
          className={styles.bodyInput}
          rows={3}
          value={body}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onBodyChange(e.target.value)}
        />

        <span className={styles.fixedText}>{outro}</span>
      </WhatsAppBubble>

      <WhatsAppButton>{button}</WhatsAppButton>
    </WhatsAppPhone>
  );
}
