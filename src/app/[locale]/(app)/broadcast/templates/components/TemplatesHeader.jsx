import styles from "../templates.module.css";

export default function TemplatesHeader({ translation }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{translation("title")}</h1>
    </header>
  );
}
