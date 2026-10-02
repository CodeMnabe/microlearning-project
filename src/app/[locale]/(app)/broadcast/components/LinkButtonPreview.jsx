"use client";

import { ExternalLink } from "lucide-react";
import { WhatsAppButton } from "@/app/components/WhatsAppPhone/WhatsAppPhone";

import styles from "../broadcast.module.css";

/**
 * Botão de link por baixo do balão, como o contacto o vai ver no WhatsApp.
 * `linkButton` vem de pickLinkButton: é null quando o link fica no texto.
 */
export default function LinkButtonPreview({ linkButton, translation }) {
  if (!linkButton) return null;

  return (
    <>
      <WhatsAppButton className={styles.linkButton}>
        <ExternalLink size={14} aria-hidden="true" />
        {linkButton.buttonText}
      </WhatsAppButton>
      <div className={styles.linkButtonHint}>
        {translation("Broadcast.composer.linkButtonHint")}
      </div>
    </>
  );
}
