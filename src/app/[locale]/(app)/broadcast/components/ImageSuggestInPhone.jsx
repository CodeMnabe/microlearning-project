"use client";

import { ImagePlus, Sparkles } from "lucide-react";

import styles from "../broadcast.module.css";
import { SuggestBar } from "./SuggestInPhone";

const IMAGE_KEYS = {
  close: "Broadcast.image.close",
  promptLabel: "Broadcast.image.promptLabel",
  placeholderWrite: "Broadcast.image.placeholder",
  placeholderChange: "Broadcast.image.placeholder",
  ask: "Broadcast.image.ask",
};

/** Barra inferior em modo de imagem: a mesma da sugestão de texto. */
export function ImageSuggestBar({ suggest, translation }) {
  return <SuggestBar suggest={suggest} translation={translation} keys={IMAGE_KEYS} />;
}

/**
 * A imagem proposta no topo do balão, onde ficam as imagens carregadas: a
 * criar (um quadrado à espera), o resultado com as ações, ou o erro. O texto
 * da mensagem continua visível por baixo, porque a imagem segue com ele.
 */
export function ImageSuggestBubble({ suggest, translation }) {
  if (suggest.loading) {
    return (
      <div className={styles.imageSuggestLoading} role="status">
        <ImagePlus size={22} aria-hidden="true" />
        <span>{translation("Broadcast.image.loading")}</span>
      </div>
    );
  }

  if (suggest.error === "generate") {
    return (
      <div className={`${styles.suggestStatus} ${styles.imageSuggestBlock}`} role="alert">
        {translation("Broadcast.image.failed")}
      </div>
    );
  }

  return (
    <div className={styles.imageSuggestBlock}>
      <div className={styles.suggestTag}>
        <Sparkles size={13} aria-hidden="true" />
        {translation("Broadcast.image.tag")}
      </div>

      <img
        src={suggest.imageUrl}
        alt={suggest.prompt}
        className={styles.imageSuggestPreview}
      />

      {suggest.error === "save" && (
        <div className={styles.suggestStatus} role="alert">
          {translation("Broadcast.image.saveFailed")}
        </div>
      )}

      <div className={styles.suggestBubbleActions}>
        <button type="button" onClick={suggest.accept} disabled={suggest.saving}>
          {translation(suggest.saving ? "Broadcast.image.saving" : "Broadcast.image.use")}
        </button>
        <button type="button" onClick={suggest.ask} disabled={suggest.saving}>
          {translation("Broadcast.image.again")}
        </button>
        <button type="button" onClick={suggest.discardImage} disabled={suggest.saving}>
          {translation("Broadcast.image.discard")}
        </button>
      </div>
    </div>
  );
}
