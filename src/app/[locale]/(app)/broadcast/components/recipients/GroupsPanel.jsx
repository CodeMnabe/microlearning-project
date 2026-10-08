import styles from "../../broadcast.module.css";
import { getInitial } from "../../lib/helpers";

/* Grupos do Teams onde o bot está, para escolher em vez de colaboradores (#166). */
export default function GroupsPanel({
  groups,
  q,
  setQ,
  selected,
  toggleOne,
  toggleAll,
  allSelected,
  translation,
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.recipientsHeader}>
        <div className={styles.recipientsActionsRow}>
          <span className={styles.subline}>
            {translation("Broadcast.groups.onlyBlank")}
          </span>

          <button type="button" onClick={toggleAll} className={styles.kbdBtn}>
            {allSelected
              ? translation("Broadcast.deselectAll")
              : translation("Broadcast.selectAll")}
          </button>
        </div>
      </div>

      <div className={styles.searchWrap}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={translation("Broadcast.groups.search")}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.listBox}>
        {groups.map((group, index) => {
          const name = group.name || translation("Broadcast.groups.unnamed");
          const isSelected = selected.has(group.id);

          return (
            <label
              key={group.id}
              className={`${styles.row} ${index % 2 ? styles.rowAlt : ""} ${
                isSelected ? styles.rowSel : ""
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleOne(group.id)}
              />

              <div className={styles.avatar}>{getInitial(name)}</div>

              <div className={styles.nameBlock}>
                <div className={styles.name}>{name}</div>
                <div className={styles.subline}>
                  {translation(
                    group.conversationType === "channel"
                      ? "TeamsGroups.type.channel"
                      : "TeamsGroups.type.groupChat",
                  )}
                  {group.assistantName ? ` · ${group.assistantName}` : ""}
                </div>
              </div>
            </label>
          );
        })}

        {groups.length === 0 && (
          <div className={styles.empty}>
            {translation(
              q.trim() ? "TeamsGroups.noMatches" : "Broadcast.groups.empty",
            )}
          </div>
        )}
      </div>
    </div>
  );
}
