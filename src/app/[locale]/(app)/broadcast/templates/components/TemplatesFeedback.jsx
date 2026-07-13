import styles from "../templates.module.css";

export default function TemplatesFeedback({ error, notice }) {
  return (
    <>
      {error && <div className={styles.errorFeedback}>{error}</div>}
      {notice && <div className={styles.noticeFeedback}>{notice}</div>}
    </>
  );
}
