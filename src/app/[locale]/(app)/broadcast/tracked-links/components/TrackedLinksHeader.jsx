import styles from "../tracked-links.module.css";

export default function TrackedLinksHeader({ translation }) {
  return (
    <div className={styles.headerLeft}>
      <h1 className={styles.title}>{translation("TrackedLinks.title")}</h1>
      <p className={styles.subtitle}>{translation("TrackedLinks.subtitle")}</p>
    </div>
  );
}
