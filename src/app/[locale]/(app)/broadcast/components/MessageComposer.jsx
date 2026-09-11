import { CalendarDays, Link2 } from "lucide-react";

import styles from "../broadcast.module.css";
import ToolToggleButton from "./ToolToggleButton";

/**
 * Painel de composição. Recebe o telemóvel (ou a mensagem de abertura) já
 * montado e junta-lhe as ferramentas: corrente, links rastreados e agendar.
 */
export default function MessageComposer({
  title,
  onBack,
  hint,
  chainControls = null,
  leftToolsContent = null,
  showLinks = true,
  activeToolPanel,
  toggleToolPanel,
  scheduleButtonLabel,
  trackedLinksCount,
  translation,
  phone,
  children,
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.composerHead}>
        <div className={styles.panelTitle} style={{ marginBottom: 0 }}>
          {title}
        </div>

        {onBack && (
          <button type="button" className={styles.backBtn} onClick={onBack}>
            {translation("Broadcast.composer.back")}
          </button>
        )}
      </div>

      {chainControls}

      {hint ? <div className={styles.composerHint}>{hint}</div> : null}

      {phone}

      <div className={styles.messageToolsRow}>
        <div className={styles.messageToolsLeft}>{leftToolsContent}</div>

        <div className={styles.messageToolsActions}>
          {showLinks && (
            <ToolToggleButton
              active={activeToolPanel === "links"}
              icon={<Link2 size={16} />}
              label={translation("Broadcast.trackedLinks")}
              badge={trackedLinksCount > 0 ? trackedLinksCount : null}
              onClick={() => toggleToolPanel("links")}
            />
          )}

          <ToolToggleButton
            active={activeToolPanel === "schedule"}
            icon={<CalendarDays size={16} />}
            label={translation("Broadcast.schedule")}
            badge={scheduleButtonLabel}
            onClick={() => toggleToolPanel("schedule")}
          />
        </div>
      </div>

      {activeToolPanel && (
        <div className={styles.inlineToolPanel}>{children}</div>
      )}
    </div>
  );
}
