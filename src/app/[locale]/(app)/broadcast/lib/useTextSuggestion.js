"use client";

import { useState } from "react";

/**
 * Estado da sugestão de texto com IA, vivido dentro do telemóvel: o pedido
 * escreve-se na barra inferior e a proposta aparece no balão. Só entra no
 * texto da mensagem quando é aceite (`accept`).
 */
export default function useTextSuggestion({
  orgId,
  kind,
  editorRef,
  resetKey,
}) {
  const [active, setActive] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  function close() {
    setActive(false);
    setPrompt("");
    setSuggestion("");
    setFailed(false);
  }

  /* Mudar de tipo de mensagem ou de passo da cadeia fecha a sugestão. */
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    close();
  }

  async function ask() {
    const currentText = String(editorRef.current?.getText?.() || "").trim();
    const cleanPrompt = prompt.trim();

    if (loading || (!cleanPrompt && !currentText)) return;

    setLoading(true);
    setFailed(false);

    try {
      const res = await fetch("/api/broadcast/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          kind,
          prompt: cleanPrompt,
          currentText,
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result?.text) throw new Error("Suggestion failed");

      setSuggestion(result.text);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function accept() {
    if (!suggestion) return;

    editorRef.current?.setText?.(suggestion);
    close();
  }

  return {
    active,
    open: () => setActive(true),
    close,
    /* Com texto no balão, o pedido serve para o mudar. */
    hasCurrentText: () =>
      Boolean(String(editorRef.current?.getText?.() || "").trim()),
    prompt,
    setPrompt,
    suggestion,
    discardSuggestion: () => setSuggestion(""),
    loading,
    failed,
    ask,
    accept,
    /* Com proposta, a escrever ou com erro, o balão mostra a sugestão. */
    showsInBubble: active && Boolean(suggestion || loading || failed),
  };
}
