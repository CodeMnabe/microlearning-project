import {
  CalendarDays,
  Link2,
  MessageSquareText,
  Paperclip,
} from "lucide-react";

import styles from "../broadcast.module.css";
import ToolToggleButton from "./ToolToggleButton";

export default function MessageComposer({
  messageInputRef,
  message,
  setMessage,
  normalizedTrackedLinks,
  previewMessageWithTrackedLinks,
  insertTrackedPlaceholder,
  activeToolPanel,
  toggleToolPanel,
  scheduleButtonLabel,
  attachmentsCount,
  trackedLinksCount,
  channel,
  templateButtonLabel,
  translation,
  children,
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        {translation("Broadcast.message")}
      </div>

      <textarea
        ref={messageInputRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={10}
        placeholder={translation("Broadcast.messagePlaceholder")}
        className={styles.textarea}
      />

      {normalizedTrackedLinks.length > 0 && (
        <div className={styles.placeholderHint}>
          <div className={styles.placeholderHintTitle}>
            Tracked placeholders:
          </div>

          {normalizedTrackedLinks.map((link) => {
            const token = `{{link.${link.key}}}`;

            return (
              <button
                key={link.key}
                type="button"
                className={styles.placeholderInsertBtn}
                onClick={() => insertTrackedPlaceholder(link.key)}
                title={`Insert ${token}`}
              >
                <code>{token}</code>
                <span>→ {link.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {!!message.trim() && normalizedTrackedLinks.length > 0 && (
        <div className={styles.messagePreviewBox}>
          <div className={styles.messagePreviewTitle}>Message preview</div>
          <div className={styles.messagePreviewText}>
            {previewMessageWithTrackedLinks}
          </div>
        </div>
      )}

      <div className={styles.messageToolsRow}>
        <ToolToggleButton
          active={activeToolPanel === "schedule"}
          icon={<CalendarDays size={16} />}
          label="Schedule"
          badge={scheduleButtonLabel}
          onClick={() => toggleToolPanel("schedule")}
        />

        <ToolToggleButton
          active={activeToolPanel === "attachments"}
          icon={<Paperclip size={16} />}
          label="Attachments"
          badge={attachmentsCount > 0 ? attachmentsCount : null}
          onClick={() => toggleToolPanel("attachments")}
        />

        <ToolToggleButton
          active={activeToolPanel === "links"}
          icon={<Link2 size={16} />}
          label="Links"
          badge={trackedLinksCount > 0 ? trackedLinksCount : null}
          onClick={() => toggleToolPanel("links")}
        />

        {channel === "whatsapp" && (
          <ToolToggleButton
            active={activeToolPanel === "template"}
            icon={<MessageSquareText size={16} />}
            label="Template"
            badge={templateButtonLabel}
            onClick={() => toggleToolPanel("template")}
          />
        )}
      </div>

      {activeToolPanel && (
        <div className={styles.inlineToolPanel}>{children}</div>
      )}
    </div>
  );
}
