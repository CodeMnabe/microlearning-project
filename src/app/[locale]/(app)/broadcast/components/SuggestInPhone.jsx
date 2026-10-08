"use client";

import { SendHorizontal, Sparkles, X } from "lucide-react";

import styles from "../broadcast.module.css";

const PROMPT_MAX_LENGTH = 600;

/* Textos da barra na sugestão de texto (a imagem com IA traz os seus). */
const TEXT_KEYS = {
  close: "Broadcast.suggest.close",
  promptLabel: "Broadcast.suggest.promptLabel",
  placeholderWrite: "Broadcast.suggest.placeholderWrite",
  placeholderChange: "Broadcast.suggest.placeholderChange",
  ask: "Broadcast.suggest.ask",
};

/**
 * Barra inferior do telemóvel em modo de pedido à IA: o pedido escreve-se
 * aqui, como uma mensagem do WhatsApp, e segue com Enter ou com a seta.
 */
export function SuggestBar({ suggest, translation, keys = TEXT_KEYS }) {
  return (
    <form
      className={styles.suggestBar}
      onSubmit={(e) => {
        e.preventDefault();
        suggest.ask();
      }}
    >
      <button
        type="button"
        className={styles.suggestIconBtn}
        onClick={suggest.close}
        aria-label={translation(keys.close)}
      >
        <X size={16} />
      </button>

      {/* O campo fica marcado como pedido à IA: ícone e contorno de destaque. */}
      <label className={styles.suggestField}>
        <Sparkles size={16} className={styles.suggestSpark} aria-hidden="true" />
        <input
          autoFocus
          className={styles.suggestInput}
          value={suggest.prompt}
          maxLength={PROMPT_MAX_LENGTH}
          onChange={(e) => suggest.setPrompt(e.target.value)}
          placeholder={translation(
            suggest.hasCurrentText?.()
              ? keys.placeholderChange
              : keys.placeholderWrite,
          )}
          aria-label={translation(keys.promptLabel)}
        />
      </label>

      <button
        type="submit"
        className={styles.suggestSendBtn}
        disabled={suggest.loading}
        aria-label={translation(keys.ask)}
      >
        <SendHorizontal size={16} />
      </button>
    </form>
  );
}

/**
 * A proposta dentro do balão, no lugar do texto: a escrever, o resultado com
 * as ações, ou o erro. O texto da mensagem só muda com "Usar".
 */
export function SuggestBubble({ suggest, translation }) {
  if (suggest.loading) {
    return (
      <div className={styles.suggestStatus}>
        {translation("Broadcast.suggest.loading")}
      </div>
    );
  }

  if (suggest.failed) {
    return (
      <div className={styles.suggestStatus} role="alert">
        {translation("Broadcast.suggest.failed")}
      </div>
    );
  }

  return (
    <>
      <div className={styles.suggestTag}>
        <Sparkles size={13} aria-hidden="true" />
        {translation("Broadcast.suggest.tag")}
      </div>

      <div data-testid="suggest-result">{suggest.suggestion}</div>

      <div className={styles.suggestBubbleActions}>
        <button type="button" onClick={suggest.accept}>
          {translation("Broadcast.suggest.use")}
        </button>
        <button type="button" onClick={suggest.ask}>
          {translation("Broadcast.suggest.again")}
        </button>
        <button type="button" onClick={suggest.discardSuggestion}>
          {translation("Broadcast.suggest.discard")}
        </button>
      </div>
    </>
  );
}
