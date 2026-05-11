import styles from "../broadcast.module.css";

export default function BroadcastHeader({
  channel,
  setChannel,
  selectedCount,
  sending,
  canSend,
  deliveryMode,
  onPrimaryClick,
  translation,
}) {
  return (
    <div className={styles.headerRow}>
      <div className={styles.channelSwitch}>
        <button
          type="button"
          className={`${styles.channelBtn} ${
            channel === "teams" ? styles.channelBtnActive : ""
          }`}
          onClick={() => setChannel("teams")}
        >
          Teams
        </button>

        <button
          type="button"
          className={`${styles.channelBtn} ${
            channel === "whatsapp" ? styles.channelBtnActive : ""
          }`}
          onClick={() => setChannel("whatsapp")}
        >
          WhatsApp
        </button>
      </div>

      <div className={styles.actionsRight}>
        <div className={styles.selectedLabel}>
          {translation("Broadcast.selected")} <strong>{selectedCount}</strong>
        </div>

        <button
          onClick={onPrimaryClick}
          disabled={sending || !canSend}
          className={styles.primaryBtn}
        >
          {sending
            ? translation("Broadcast.sending")
            : deliveryMode === "schedule"
              ? "Schedule"
              : translation("Broadcast.send")}
        </button>
      </div>
    </div>
  );
}
