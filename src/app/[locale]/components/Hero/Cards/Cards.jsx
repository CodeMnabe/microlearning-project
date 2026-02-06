import styles from "./cards.module.css";

export default function Cards({ items }) {
  return (
    <div className={styles.showcaseWrap}>
      {/* <div className={`${styles.annotation} ${styles.annotationLeft}`}>
        <p>See what our customers are building</p>
        <svg
          className={styles.arrowSvg}
          viewBox="0 0 120 60"
          aria-hidden="true"
        >
          <path
            d="M5,10 C35,5 55,20 75,35 C90,45 105,50 115,55"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M108,48 L115,55 L106,58"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className={`${styles.annotation} ${styles.annotationRight}`}>
        <p>Hook in the first 48 hours with MyDigitalBot</p>
        <svg
          className={styles.arrowSvg}
          viewBox="0 0 120 60"
          aria-hidden="true"
        >
          <path
            d="M5,10 C35,5 55,20 75,35 C90,45 105,50 115,55"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M108,48 L115,55 L106,58"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div> */}
      <div className={styles.showcase}>
        {items.map((c) => (
          <div key={c.id} className={styles.card}>
            <div className={styles.cardMedia}>
              {c.screenshot ? (
                <img
                  src={c.screenshot}
                  alt={c.title}
                  className={styles.cardImg}
                />
              ) : (
                "Screenshot"
              )}
            </div>
            <div className={styles.cardFooter}>
              <div className={styles.cardTitle}>{c.title}</div>
              <div className={styles.cardMeta}>{c.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
