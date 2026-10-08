"use client";

import { useState } from "react";

import { requestBroadcastImage } from "../lib/broadcast.api";

/*
 * A imagem que vem em base64 passa a ficheiro, igual a um escolhido no
 * computador: assim segue pelo mesmo upload e entra no balão da mesma forma.
 */
export function imageToFile({ image, contentType }, now = Date.now()) {
  const bytes = Uint8Array.from(atob(image), (char) => char.charCodeAt(0));
  return new File([bytes], `imagem-ia-${now}.jpg`, { type: contentType });
}

/**
 * Estado da imagem criada com IA, vivido dentro do telemóvel como a sugestão
 * de texto: o pedido escreve-se na barra inferior e a proposta aparece no
 * balão. Só é guardada e junta à mensagem com "Usar" (`onUse(file)`); o que
 * se descarta nunca chega a ser guardado.
 *
 * `error` diz o que falhou: "generate" (criar a imagem) ou "save" (juntá-la
 * à mensagem, onde a imagem fica para se tentar outra vez).
 */
export default function useImageSuggestion({ orgId, resetKey, onUse }) {
  const [active, setActive] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function close() {
    setActive(false);
    setPrompt("");
    setResult(null);
    setError(null);
  }

  /* Mudar de tipo de mensagem ou de passo da cadeia fecha a criação. */
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    close();
  }

  async function ask() {
    const cleanPrompt = prompt.trim();
    if (loading || saving || !cleanPrompt || !orgId) return;

    setLoading(true);
    setError(null);

    try {
      setResult(await requestBroadcastImage({ orgId, prompt: cleanPrompt }));
    } catch {
      setError("generate");
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    if (!result || saving) return;

    setSaving(true);
    setError(null);

    try {
      await onUse(imageToFile(result));
      close();
    } catch {
      setError("save");
    } finally {
      setSaving(false);
    }
  }

  return {
    active,
    open: () => setActive(true),
    close,
    prompt,
    setPrompt,
    imageUrl: result ? `data:${result.contentType};base64,${result.image}` : null,
    discardImage: () => {
      setResult(null);
      setError(null);
    },
    loading,
    saving,
    error,
    ask,
    accept,
    /* A criar, com proposta ou com erro, o balão mostra a imagem. */
    showsInBubble:
      active && Boolean(result || loading || error === "generate"),
  };
}
