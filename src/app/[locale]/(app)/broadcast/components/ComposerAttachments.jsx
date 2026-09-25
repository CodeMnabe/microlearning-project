"use client";

import { FileText, FileVideo } from "lucide-react";

import { WhatsAppBubble } from "@/app/components/WhatsAppPhone/WhatsAppPhone";

import styles from "../broadcast.module.css";

/**
 * Grelha de imagens dentro de um balão, com o botão para as tirar.
 * Devolve null sem imagens.
 */
export function BubbleImages({ imageFiles = [], onRemoveFile, translation }) {
  if (!imageFiles.length) return null;

  return (
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
  );
}

/**
 * Um balão por vídeo e por documento, como no WhatsApp, com as ações de
 * miniatura e remoção.
 */
export function FileBubbles({
  videoFiles = [],
  otherFiles = [],
  onRemoveFile,
  onPickThumbnail,
  onRemoveThumbnail,
  translation,
}) {
  return (
    <>
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
    </>
  );
}
