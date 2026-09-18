"use client";

import { SendHorizontal, Sparkles, X } from "lucide-react";

import styles from "../broadcast.module.css";

const PROMPT_MAX_LENGTH = 600;

/**
 * Barra inferior do telemóvel em modo de sugestão: o pedido escreve-se aqui,
 * como uma mensagem do WhatsApp, e segue com Enter ou com a seta.
 */
export function SuggestBar({ suggest, translation }) {
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
        aria-label={translation("Broadcast.suggest.close")}
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
            suggest.hasCurrentText()
              ? "Broadcast.suggest.placeholderChange"
              : "Broadcast.suggest.placeholderWrite",
          )}
          aria-label={translation("Broadcast.suggest.promptLabel")}
        />
      </label>

      <button
        type="submit"
        className={styles.suggestSendBtn}
        disabled={suggest.loading}
        aria-label={translation("Broadcast.suggest.ask")}
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
