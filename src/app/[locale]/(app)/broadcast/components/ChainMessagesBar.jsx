import { Copy, MessageSquarePlus, Plus, Trash2, X } from "lucide-react";
import styles from "../broadcast.module.css";

export default function ChainMessagesBar({
  enabled,
  chainMode,
  setChainMode,
  chainSteps,
  activeChainStepIndex,
  setActiveChainStepIndex,
  addChainStep,
  duplicateChainStep,
  removeChainStep,
  hasFallbackTemplate,
  translation,
}) {
  if (!enabled && !chainMode) {
    return null;
  }

  return (
    <div className={styles.chainBox}>
      <div className={styles.chainHeader}>
        <div className={styles.chainTitleWrap}>
          <div className={styles.chainTitle}>
            <MessageSquarePlus size={17} />
            <span>{translation("Broadcast.broadcastChain.title")}</span>
          </div>

          <div className={styles.chainHelp}>
            {translation("Broadcast.broadcastChain.chainHelp")}
          </div>
        </div>

        <button
          type="button"
          className={`${styles.secondaryActionBtn} ${
            chainMode ? styles.chainExitBtn : ""
          }`}
          onClick={() => setChainMode((value) => !value)}
        >
          {chainMode ? (
            <>
              <X size={15} />
              <span>{translation("Broadcast.broadcastChain.exitChain")}</span>
            </>
          ) : (
            <>
              <MessageSquarePlus size={15} />
              <span>{translation("Broadcast.broadcastChain.createChain")}</span>
            </>
          )}
        </button>
      </div>

      {!enabled && chainMode && (
        <div className={styles.chainWarning}>
          {translation("Broadcast.broadcastChain.chainOff")}
        </div>
      )}

      {chainMode && !hasFallbackTemplate && (
        <div className={styles.chainWarning}>
          {translation("Broadcast.broadcastChain.chainTemplate")}
        </div>
      )}

      {chainMode && (
        <>
          <div className={styles.chainStepTabs}>
            {chainSteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                className={`${styles.chainStepTab} ${
                  activeChainStepIndex === index
                    ? styles.chainStepTabActive
                    : ""
                }`}
                onClick={() => setActiveChainStepIndex(index)}
              >
                {translation("Broadcast.broadcastChain.chainMessage")}{" "}
                {index + 1}
              </button>
            ))}

            <button
              type="button"
              className={styles.chainStepAdd}
              onClick={addChainStep}
              disabled={chainSteps.length >= 10}
              title={
                chainSteps.length >= 10
                  ? translation("Broadcast.broadcastChain.chainLengthMax")
                  : translation("Broadcast.broadcastChain.chainLengthAdd")
              }
            >
              <Plus size={15} />
            </button>

            <button
              type="button"
              className={styles.chainStepAdd}
              onClick={duplicateChainStep}
              disabled={chainSteps.length >= 10}
              title={translation("Broadcast.broadcastChain.chainDuplicate")}
            >
              <Copy size={15} />
              {/* <span>
                {translation("Broadcast.broadcastChain.chainDuplicate")}
              </span> */}
            </button>

            <button
              type="button"
              className={`${styles.chainStepAdd} ${styles.chainStepRemove}`}
              onClick={() => removeChainStep(activeChainStepIndex)}
              disabled={chainSteps.length <= 2}
              title={translation("Broadcast.broadcastChain.chainRemove")}
            >
              <Trash2 size={15} />
              {/* <span>{translation("Broadcast.broadcastChain.chainRemove")}</span> */}
            </button>
          </div>

          <div className={styles.chainActionsRow}>
            {/* <button
              type="button"
              className={styles.kbdBtn}
              onClick={duplicateChainStep}
              disabled={chainSteps.length >= 10}
            >
              <Copy size={14} />
              <span>
                {translation("Broadcast.broadcastChain.chainDuplicate")}
              </span>
            </button>

            <button
              type="button"
              className={styles.kbdBtn}
              onClick={() => removeChainStep(activeChainStepIndex)}
              disabled={chainSteps.length <= 2}
            >
              <Trash2 size={14} />
              <span>{translation("Broadcast.broadcastChain.chainRemove")}</span>
            </button> */}

            <span className={styles.chainCounter}>
              {chainSteps.length}/10{" "}
              {translation("Broadcast.broadcastChain.chainMessages")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
