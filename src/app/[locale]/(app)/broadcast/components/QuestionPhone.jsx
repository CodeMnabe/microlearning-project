"use client";

import WhatsAppPhone, {
  WhatsAppBubble,
} from "@/app/components/WhatsAppPhone/WhatsAppPhone";

import styles from "../broadcast.module.css";
import { BubbleImages, FileBubbles } from "./ComposerAttachments";
import { PlusMenuBar } from "./PlusMenu";
import TokenTextEditor from "./TokenTextEditor";

const NO_TOKENS = () => null;

/**
 * Telemóvel de uma pergunta (quiz, sondagem ou pergunta aberta). O corpo
 * escreve-se no balão com pastilhas para variáveis e links; as imagens
 * ficam no topo do mesmo balão, porque seguem na mesma mensagem que o
 * texto e os botões. Os filhos são as linhas por baixo do balão (as
 * opções). `tools` traz o "+" e os anexos do composer.
 */
export default function QuestionPhone({
  contactName,
  previewTime,
  body,
  onBodyChange,
  bodyLabel,
  bodyPlaceholder,
  tools = null,
  translation,
  children,
}) {
  return (
    <div className={styles.phoneWrap}>
      <WhatsAppPhone
        contactName={contactName}
        footer={<PlusMenuBar tools={tools} translation={translation} />}
      >
        {tools && (
          <FileBubbles
            videoFiles={tools.videoFiles}
            otherFiles={tools.otherFiles}
            onRemoveFile={tools.onRemoveFile}
            onPickThumbnail={tools.onPickThumbnail}
            onRemoveThumbnail={tools.onRemoveThumbnail}
            translation={translation}
          />
        )}

        <WhatsAppBubble time={previewTime}>
          {tools && (
            <BubbleImages
              imageFiles={tools.imageFiles}
              onRemoveFile={tools.onRemoveFile}
              translation={translation}
            />
          )}

          <TokenTextEditor
            ref={tools?.editorRef}
            value={body}
            onChange={onBodyChange}
            tokenLabel={tools?.tokenLabel || NO_TOKENS}
            placeholder={bodyPlaceholder}
            ariaLabel={bodyLabel}
          />
        </WhatsAppBubble>

        {children}
      </WhatsAppPhone>
    </div>
  );
}
