"use client";

import { useTranslations } from "next-intl";

import WhatsAppPhone, {
  WhatsAppBubble,
  WhatsAppButton,
} from "@/app/components/WhatsAppPhone/WhatsAppPhone";
import {
  OPENING_TEMPLATE_PREVIEW,
  renderOpeningTemplatePreview,
} from "@/lib/whatsapp/openingTemplate";

import styles from "../settings.module.css";

/** Pré-visualização fixa do template DigikBot, com valores de exemplo. */
export default function OpeningMessageSettings({ orgName }) {
  const translation = useTranslations("OpeningMessage");
  const sampleName = translation("sampleName");
  const companyName = orgName || translation("sampleCompany");
  const message = renderOpeningTemplatePreview({
    name: sampleName,
    orgName: companyName,
  });

  return (
    <div className={styles.opening}>
      <WhatsAppPhone contactName={sampleName}>
        <WhatsAppBubble>{message}</WhatsAppBubble>
        <WhatsAppButton>{OPENING_TEMPLATE_PREVIEW.button}</WhatsAppButton>
      </WhatsAppPhone>

      <div className={styles.openingDetails}>
        <h3 className={styles.openingPreviewTitle}>
          {translation("previewTitle")}
        </h3>
        <p className={styles.openingNotice}>{translation("fixedNotice")}</p>
        <dl className={styles.openingVariables}>
          <div>
            <dt>{translation("recipientName")}</dt>
            <dd>{sampleName}</dd>
          </div>
          <div>
            <dt>{translation("organizationName")}</dt>
            <dd>{companyName}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
