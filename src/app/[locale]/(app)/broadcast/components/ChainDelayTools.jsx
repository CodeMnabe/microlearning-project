import styles from "../broadcast.module.css";

import {
  formatDelayLabel,
  MAX_CHAIN_DELAY_HOURS,
} from "../lib/broadcast.helpers";

/**
 * Ferramentas de atraso entre mensagens de uma read chain.
 *
 * Só aparece quando o modo chain está ativo.
 * A primeira mensagem não tem atraso porque é enviada imediatamente
 * ou na data agendada.
 */
export default function ChainDelayTools({
  chainMode,
  activeChainStepIndex,
  activeDelay,
  activeDelayParts,
  updateChainStepDelayPart,
  translation,
}) {
  if (!chainMode) return null;

  if (activeChainStepIndex === 0) {
    return (
      <div className={styles.composerDelayTools}>
        <div className={styles.composerDelayHelp}>
          {translation("Broadcast.broadcastChain.chainFirstMessage")}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.composerDelayTools}>
      <div className={styles.composerDelayTitle}>
        {translation("Broadcast.broadcastChain.chainDelayBefore")}{" "}
        {activeChainStepIndex + 1}
      </div>

      <div className={styles.composerDelayInputs}>
        <label className={styles.composerDelayField}>
          <span>{translation("Broadcast.broadcastChain.chainHour")}</span>

          <input
            type="number"
            min="0"
            max={MAX_CHAIN_DELAY_HOURS}
            step="1"
            value={activeDelayParts.hours}
            onChange={(event) =>
              updateChainStepDelayPart(
                activeChainStepIndex,
                "hours",
                event.target.value,
              )
            }
          />
        </label>

        <label className={styles.composerDelayField}>
          <span>{translation("Broadcast.broadcastChain.chainMinute")}</span>

          <input
            type="number"
            min="0"
            max="59"
            step="1"
            value={activeDelayParts.minutes}
            onChange={(event) =>
              updateChainStepDelayPart(
                activeChainStepIndex,
                "minutes",
                event.target.value,
              )
            }
          />
        </label>
      </div>

      <div className={styles.composerDelayHelp}>
        {formatDelayLabel(activeDelay, translation)}
      </div>
    </div>
  );
}

