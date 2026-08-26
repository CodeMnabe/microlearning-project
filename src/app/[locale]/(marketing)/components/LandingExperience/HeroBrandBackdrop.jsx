import styles from "./landingExperience.module.css";

const BUBBLE_PATH =
  "M384.9,188.75c20.55-29.6,32.69-65.47,32.69-104.16,0-2.42-.14-4.81-.3-7.19l-.14-2.05-54.48,2.9.17,2.85c.09,1.16.18,2.32.18,3.5,0,70.91-57.69,128.61-128.6,128.61S105.82,155.5,105.82,84.59c0-1.11.1-2.2.17-3.29l.19-3.16-54.5-2.67-.14,2.15c-.15,2.31-.29,4.62-.29,6.98,0,101,82.17,183.17,183.17,183.17,39.51,0,76.04-12.71,106-34.07l66.12,29.21-21.65-74.14Z";

const EYE_PATH =
  "M173.49,98.62c10.39,0,19.79,4.18,26.67,10.91,7.09-6.93,11.52-16.58,11.52-27.28,0-21.09-17.1-38.19-38.19-38.19s-38.19,17.1-38.19,38.19c0,10.7,4.43,20.35,11.52,27.28,6.89-6.73,16.28-10.91,26.67-10.91Z";

function BrandFragment({
  className,
  viewBox,
  symbolId,
  preserveAspectRatio = "xMidYMid meet",
}) {
  return (
    <svg
      className={`${styles.heroBrandShape} ${className}`}
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      focusable="false"
    >
      <use href={`#${symbolId}`} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function HeroBrandBackdrop() {
  return (
    <div
      className={styles.heroBrandBackdrop}
      aria-hidden="true"
      data-hero-brand-backdrop
    >
      <svg className={styles.heroBrandDefinitions} focusable="false">
        <defs>
          <path id="hero-mdb-bubble" d={BUBBLE_PATH} />
          <path id="hero-mdb-eye" d={EYE_PATH} />
        </defs>
      </svg>

      <div className={styles.heroBrandComposition}>
        <BrandFragment
          className={styles.heroBrandMain}
          viewBox="50 74 369 195"
          symbolId="hero-mdb-bubble"
          preserveAspectRatio="none"
        />
        <BrandFragment
          className={styles.heroBrandEyeOne}
          viewBox="134 43 79 68"
          symbolId="hero-mdb-eye"
        />
        <BrandFragment
          className={styles.heroBrandEyeTwo}
          viewBox="134 43 79 68"
          symbolId="hero-mdb-eye"
        />
      </div>
    </div>
  );
}
