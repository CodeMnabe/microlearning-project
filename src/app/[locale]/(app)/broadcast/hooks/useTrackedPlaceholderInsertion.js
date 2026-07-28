"use client";

import { useCallback, useRef } from "react";
/**
 * Gere a inserção de placeholders de links rastreados no composer.
 *
 * Insere tokens no formato {{link.key}} na posição atual do cursor.
 * Quando a textarea não está ativa, adiciona o token ao fim da mensagem.
 *
 * Também preserva espaços antes/depois do token e reposiciona o cursor
 * após a inserção.
 */

export function useTrackedPlaceholderInsertion({
  composerMessage,
  setComposerMessage,
}) {
  const messageInputRef = useRef(null);

  const insertTrackedPlaceholder = useCallback(
    (key) => {
      const token = `{{link.${key}}}`;
      const textArea = messageInputRef.current;
      const currentMessage =
        typeof composerMessage === "string" ? composerMessage : "";

      if (!textArea) {
        setComposerMessage(
          (prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${token}`,
        );

        return;
      }

      const start = textArea.selectionStart ?? currentMessage.length;
      const end = textArea.selectionEnd ?? currentMessage.length;

      const before = currentMessage.slice(0, start);
      const after = currentMessage.slice(end);

      const prefix =
        before && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";

      const suffix =
        after && !after.startsWith(" ") && !after.startsWith("\n") ? " " : "";

      const inserted = `${prefix}${token}${suffix}`;
      const nextValue = before + inserted + after;

      setComposerMessage(nextValue);

      requestAnimationFrame(() => {
        textArea.focus();

        const nextCursor = before.length + inserted.length;

        textArea.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [composerMessage, setComposerMessage],
  );

  return {
    messageInputRef,
    insertTrackedPlaceholder,
  };
}
