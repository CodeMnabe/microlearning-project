"use client";

import WhatsAppPhone, {
  WhatsAppBubble,
} from "@/app/components/WhatsAppPhone/WhatsAppPhone";

import styles from "../broadcast.module.css";
import { BubbleImages, FileBubbles } from "./ComposerAttachments";
import { PlusMenuBar } from "./PlusMenu";
import TokenTextEditor from "./TokenTextEditor";

/**
 * O telemóvel é o próprio editor: escreve-se dentro do balão, as imagens
 * aparecem no topo do balão e os ficheiros por baixo, como no WhatsApp.
 * O "+" da barra inferior junta imagens, links e variáveis.
 */
export default function PhoneComposer({
  channel,
  contactName,
  message,
  onMessageChange,
  tools,
  previewTime,
  translation,
}) {
  return (
    <div className={styles.phoneWrap}>
      <WhatsAppPhone
        contactName={contactName}
        variant={channel === "teams" ? "teams" : "whatsapp"}
        footer={<PlusMenuBar tools={tools} translation={translation} />}
      >
        <WhatsAppBubble time={previewTime}>
          <BubbleImages
            imageFiles={tools.imageFiles}
            onRemoveFile={tools.onRemoveFile}
            translation={translation}
          />

          <TokenTextEditor
            ref={tools.editorRef}
            value={message}
            onChange={onMessageChange}
            tokenLabel={tools.tokenLabel}
            placeholder={translation("Broadcast.composer.placeholder")}
            ariaLabel={translation("Broadcast.message")}
          />
        </WhatsAppBubble>

        <FileBubbles
          videoFiles={tools.videoFiles}
          otherFiles={tools.otherFiles}
          onRemoveFile={tools.onRemoveFile}
          onPickThumbnail={tools.onPickThumbnail}
          onRemoveThumbnail={tools.onRemoveThumbnail}
          translation={translation}
        />
      </WhatsAppPhone>
    </div>
  );
}
