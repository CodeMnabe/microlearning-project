import styles from "./howItWorksPage.module.css";

// Exact symbol geometry from the official vector asset:
// /public/images/Logos/logo-24.svg (the wordmark is intentionally omitted).
const SYMBOL_PATH =
  "M384.9,188.75c20.55-29.6,32.69-65.47,32.69-104.16,0-2.42-.14-4.81-.3-7.19l-.14-2.05-54.48,2.9.17,2.85c.09,1.16.18,2.32.18,3.5,0,70.91-57.69,128.61-128.6,128.61S105.82,155.5,105.82,84.59c0-1.11.1-2.2.17-3.29l.19-3.16-54.5-2.67-.14,2.15c-.15,2.31-.29,4.62-.29,6.98,0,101,82.17,183.17,183.17,183.17,39.51,0,76.04-12.71,106-34.07l66.12,29.21-21.65-74.14Z";

const LEFT_EYE_PATH =
  "M173.49,98.62c10.39,0,19.79,4.18,26.67,10.91,7.09-6.93,11.52-16.58,11.52-27.28,0-21.09-17.1-38.19-38.19-38.19s-38.19,17.1-38.19,38.19c0,10.7,4.43,20.35,11.52,27.28,6.89-6.73,16.28-10.91,26.67-10.91Z";

const RIGHT_EYE_PATH =
  "M291.54,98.62c10.39,0,19.79,4.18,26.67,10.91,7.09-6.93,11.52-16.58,11.52-27.28,0-21.09-17.1-38.19-38.19-38.19s-38.19,17.1-38.19,38.19c0,10.7,4.43,20.35,11.52,27.28,6.89-6.73,16.28-10.91,26.67-10.91Z";

export default function HowItWorksHeroLight() {
  return (
    <div className={styles.heroLightScene} aria-hidden="true">
      <span className={styles.ambientLight} />
      <span className={styles.diffuseBeam} />
      <span className={styles.coreLight} />

      <svg
        className={styles.lightSourceSymbol}
        viewBox="34 26 405 267"
        focusable="false"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="how-it-works-symbol-fill"
            x1="0"
            y1="0.16"
            x2="0.92"
            y2="0.86"
          >
            <stop offset="0" stopColor="#d8f0ff" />
            <stop offset="0.42" stopColor="#8ed0ff" />
            <stop offset="1" stopColor="#3b9de8" />
          </linearGradient>
        </defs>

        <g fill="url(#how-it-works-symbol-fill)">
          <path d={SYMBOL_PATH} />
          <path d={LEFT_EYE_PATH} />
          <path d={RIGHT_EYE_PATH} />
        </g>
      </svg>
    </div>
  );
}
