import styles from "../../broadcast.module.css";
import { getInitial } from "../../lib/helpers";

export default function RecipientRow({
  user,
  index,
  selected,
  onToggle,
  channel,
  translation,
}) {
  return (
    <label
      className={`${styles.row} ${index % 2 ? styles.rowAlt : ""} ${
        selected ? styles.rowSel : ""
      }`}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} />

      <div className={styles.avatar}>{getInitial(user.name)}</div>

      <div className={styles.nameBlock}>
        <div className={styles.name}>
          {user.name || translation("Common.none")}
        </div>
        <div className={styles.subline}>
          {channel === "whatsapp" ? user.phone_number : user.email}
        </div>
      </div>
    </label>
  );
}
