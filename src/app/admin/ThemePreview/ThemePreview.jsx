"use client";
import styles from "../admin.module.css";

export default function ThemePreview({ theme }) {
  const primary = theme?.primary || "#4f46e5";
  const secondary = theme?.secondary || "#0ea5e9";

  return (
    <div className={styles.preview}>
      <div className={styles.previewApp}>
        {/* SIDEBAR */}
        <aside
          className={styles.previewSidebar}
          style={{ background: secondary }}
        >
          <nav className={styles.previewNav}>
            <span
              className={`${styles.previewNavItem} ${styles.isActive}`}
              style={{
                background: `linear-gradient(to right, ${primary}, ${secondary})`,
              }}
            ></span>
            <span
              className={styles.previewNavItem}
              style={{
                background: `linear-gradient(to right, ${primary}, ${secondary})`,
              }}
            ></span>
            <span
              className={styles.previewNavItem}
              style={{
                background: `linear-gradient(to right, ${primary}, ${secondary})`,
              }}
            ></span>
          </nav>
        </aside>

        {/* MAIN */}
        <main className={styles.previewMain}>
          <div className={styles.previewCard}>
            <div className={styles.previewTitle}>Sample card</div>
            <div className={styles.previewText}>
              Body text using your theme. Tweak colors to see it change.
            </div>
            <button
              className={styles.previewButton}
              style={{ background: primary }}
            >
              Primary action
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
