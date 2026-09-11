"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, FileVideo, Image as ImageIcon, Link2, Plus, User, Building2 } from "lucide-react";

import WhatsAppPhone, {
  WhatsAppBubble,
} from "@/app/components/WhatsAppPhone/WhatsAppPhone";

import styles from "../broadcast.module.css";
import TokenTextEditor from "./TokenTextEditor";

function PlusMenu({ onAddFile, onAddLink, variables, onInsertToken, translation }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function onDoc(e) {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    }

    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(action) {
    setOpen(false);
    action();
  }

  return (
    <div className={styles.plusWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.plusBtn}
        aria-label={translation("Broadcast.composer.add")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={18} />
      </button>

      {open && (
        <div className={styles.plusMenu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.plusItem}
            onClick={() => pick(onAddFile)}
          >
            <ImageIcon size={16} />
            <span>{translation("Broadcast.composer.addFile")}</span>
          </button>

          {onAddLink && (
            <button
              type="button"
              role="menuitem"
              className={styles.plusItem}
              onClick={() => pick(onAddLink)}
            >
              <Link2 size={16} />
              <span>{translation("Broadcast.composer.addLink")}</span>
            </button>
          )}

          {variables.length > 0 && (
            <div className={styles.plusLabel}>
              {translation("Broadcast.composer.variables")}
            </div>
          )}

          {variables.map((v) => (
            <button
              key={v.key}
              type="button"
              role="menuitem"
              className={styles.plusItem}
              onClick={() => pick(() => onInsertToken(v.key))}
            >
              {v.kind === "company" ? <Building2 size={16} /> : v.kind === "link" ? <Link2 size={16} /> : <User size={16} />}
              <span>{v.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * O telemóvel é o próprio editor: escreve-se dentro do balão, as imagens
 * aparecem no topo do balão e os ficheiros por baixo, como no WhatsApp.
 * O "+" da barra inferior junta imagens, links e variáveis.
 */
export default function PhoneComposer({
  channel,
  contactName,
  message,
  onMessageChange,
  editorRef,
  tokenLabel,
  variables = [],
  onInsertToken,
  imageFiles = [],
  videoFiles = [],
  otherFiles = [],
  onRemoveFile,
  onPickThumbnail,
  onRemoveThumbnail,
  onAddFile,
  onAddLink,
  previewTime,
  translation,
}) {
  return (
    <div className={styles.phoneWrap}>
      <WhatsAppPhone
        contactName={contactName}
        variant={channel === "teams" ? "teams" : "whatsapp"}
        footer={
          <>
            <PlusMenu
              onAddFile={onAddFile}
              onAddLink={onAddLink}
              variables={variables}
              onInsertToken={onInsertToken}
              translation={translation}
            />
            <span className={styles.barHint}>
              {translation("Broadcast.composer.barHint")}
            </span>
          </>
        }
      >
        <WhatsAppBubble time={previewTime}>
          {imageFiles.length > 0 && (
            <div className={styles.bubbleImages}>
              {imageFiles.map((f) => (
                <div key={f.url} className={styles.bubbleImageWrap}>
                  <img
                    src={f.url}
                    alt={f.name || "upload"}
                    className={styles.bubbleImage}
                  />
                  <button
                    type="button"
                    className={styles.bubbleImageRemove}
                    aria-label={`${translation("Broadcast.remove")} ${f.name || ""}`}
                    onClick={() => onRemoveFile(f.url)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <TokenTextEditor
            ref={editorRef}
            value={message}
            onChange={onMessageChange}
            tokenLabel={tokenLabel}
            placeholder={translation("Broadcast.composer.placeholder")}
            ariaLabel={translation("Broadcast.message")}
          />
        </WhatsAppBubble>

        {videoFiles.map((f) => (
          <WhatsAppBubble key={f.url} className={styles.fileBubble}>
            <div className={styles.fileBubbleName}>
              <FileVideo size={16} />
              <span>{f.name || "video"}</span>
            </div>
            <div className={styles.fileBubbleActions}>
              <button type="button" onClick={() => onPickThumbnail(f.url)}>
                {translation("Broadcast.thumbnail")}
              </button>
              {f.thumbnailUrl && (
                <button type="button" onClick={() => onRemoveThumbnail(f.url)}>
                  {translation("Broadcast.removeThumbnail")}
                </button>
              )}
              <button type="button" onClick={() => onRemoveFile(f.url)}>
                {translation("Broadcast.remove")}
              </button>
            </div>
          </WhatsAppBubble>
        ))}

        {otherFiles.map((f) => (
          <WhatsAppBubble key={f.url} className={styles.fileBubble}>
            <div className={styles.fileBubbleName}>
              <FileText size={16} />
              <a href={f.url} target="_blank" rel="noreferrer">
                {f.name || "file"}
              </a>
            </div>
            <div className={styles.fileBubbleActions}>
              <button type="button" onClick={() => onRemoveFile(f.url)}>
                {translation("Broadcast.remove")}
              </button>
            </div>
          </WhatsAppBubble>
        ))}
      </WhatsAppPhone>
    </div>
  );
}
