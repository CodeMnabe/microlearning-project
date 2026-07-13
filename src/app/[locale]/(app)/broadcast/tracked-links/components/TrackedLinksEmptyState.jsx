import styles from "../tracked-links.module.css";

export default function TrackedLinksEmptyState({ children, error = false }) {
  return <div className={error ? styles.errorBox : styles.emptyBox}>{children}</div>;
}
