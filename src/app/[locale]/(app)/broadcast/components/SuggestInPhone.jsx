"use client";

import { SendHorizontal, X } from "lucide-react";

import PillSelect from "@/app/components/PillSelect/PillSelect";

import styles from "../broadcast.module.css";

const PROMPT_MAX_LENGTH = 600;

const TONE_PILL_STYLE = {
  height: "26px",
  padding: "0 10px",
  fontSize: "12px",
};

/**
 * Barra inferior do telemóvel em modo de sugestão: o pedido escreve-se aqui,
 * como uma mensagem do WhatsApp, e segue com Enter ou com a seta.
 */
export function SuggestBar({ suggest, translation }) {
  const { assistants } = suggest;

  if (assistants.length === 0) {
    return (
      <div className={styles.suggestBar}>
        <div className={styles.suggestBarRow}>
          <span className={styles.barHint}>
            {translation("Broadcast.suggest.noAssistants")}
          </span>
          <button
            type="button"
            className={styles.suggestIconBtn}
            onClick={suggest.close}
            aria-label={translation("Broadcast.suggest.close")}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.suggestBar}>
      {assistants.length > 1 && (
        <div className={styles.suggestTone}>
          <span>{translation("Broadcast.suggest.tone")}</span>
          <PillSelect
            value={suggest.assistantId}
            options={assistants.map((a) => ({
              value: String(a.id),
              label: a.name,
            }))}
            onChange={(value) => suggest.setAssistantId(String(value))}
            menuWidth={240}
            style={TONE_PILL_STYLE}
          />
        </div>
      )}

      <form
        className={styles.suggestBarRow}
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

        <input
          autoFocus
          className={styles.suggestInput}
          value={suggest.prompt}
          maxLength={PROMPT_MAX_LENGTH}
          onChange={(e) => suggest.setPrompt(e.target.value)}
          placeholder={translation("Broadcast.suggest.placeholder")}
          aria-label={translation("Broadcast.suggest.promptLabel")}
        />

        <button
          type="submit"
          className={styles.suggestSendBtn}
          disabled={suggest.loading}
          aria-label={translation("Broadcast.suggest.ask")}
        >
          <SendHorizontal size={16} />
        </button>
      </form>
    </div>
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
