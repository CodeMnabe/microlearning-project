"use client";

import { useEffect } from "react";
/**
 * Aplica regras quando o canal de envio muda.
 *
 * Exemplos:
 * - fecha o painel de template quando o canal é Teams;
 * - desativa read chains quando o canal deixa de ser WhatsApp.
 *
 * Estas proteções evitam estados inválidos na interface.
 */

export function useBroadcastChannelGuards({
  channel,
  activeToolPanel,
  setActiveToolPanel,
  chainMode,
  setChainMode,
}) {
  useEffect(() => {
    if (channel === "teams" && activeToolPanel === "template") {
      setActiveToolPanel(null);
    }

    if (channel !== "whatsapp" && chainMode) {
      setChainMode(false);
    }
  }, [channel, activeToolPanel, setActiveToolPanel, chainMode, setChainMode]);
}
