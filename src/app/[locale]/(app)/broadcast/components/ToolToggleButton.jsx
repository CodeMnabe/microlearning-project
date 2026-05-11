import styles from "../broadcast.module.css";

export default function ToolToggleButton({
  active,
  icon,
  label,
  badge,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.secondaryActionBtn} ${
        active ? styles.modeBtnActive : ""
      }`}
    >
      <span
        className={`${styles.secondaryActionContent} ${
          active ? styles.modeBtnActive : ""
        }`}
      >
        {icon}
        <span>{label}</span>
      </span>

      {badge !== undefined && badge !== null && badge !== "" && (
        <span className={styles.secondaryActionBadge}>{badge}</span>
      )}
    </button>
  );
}
