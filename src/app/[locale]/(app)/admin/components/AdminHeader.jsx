import styles from "../admin.module.css";

/**
 * Header principal da página Admin.
 *
 * Mostra o título da área de administração.
 */
export default function AdminHeader({ translation }) {
  return <h1 className={styles.header}>{translation("title")}</h1>;
}