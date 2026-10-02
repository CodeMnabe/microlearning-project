import styles from "../../broadcast.module.css";

/**
 * Colaboradores | Grupos Teams (#166). Os grupos só recebem mensagens em
 * branco, por isso o separador fica desativado nos outros tipos e na cadeia.
 */
export default function AudienceTabs({
  audience,
  canUseGroups,
  onChooseUsers,
  onChooseGroups,
  translation,
}) {
  return (
    <div className={styles.audienceTabs} role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={audience === "users"}
        className={`${styles.channelBtn} ${styles.audienceTab} ${
          audience === "users" ? styles.channelBtnActive : ""
        }`}
        onClick={onChooseUsers}
      >
        {translation("Broadcast.groups.tabUsers")}
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={audience === "groups"}
        className={`${styles.channelBtn} ${styles.audienceTab} ${
          audience === "groups" ? styles.channelBtnActive : ""
        }`}
        onClick={onChooseGroups}
        disabled={!canUseGroups}
        title={
          canUseGroups ? undefined : translation("Broadcast.groups.onlyBlank")
        }
      >
        {translation("Broadcast.groups.tabGroups")}
      </button>
    </div>
  );
}
