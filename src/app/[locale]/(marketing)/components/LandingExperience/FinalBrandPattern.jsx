import styles from "./landingExperience.module.css";

// Isolated symbol paths from the vector MyDigitalBot logo in /public/images/Logos/logo-24.svg.
const BRAND_SYMBOL_PATH =
  "M384.9,188.75c20.55-29.6,32.69-65.47,32.69-104.16,0-2.42-.14-4.81-.3-7.19l-.14-2.05-54.48,2.9.17,2.85c.09,1.16.18,2.32.18,3.5,0,70.91-57.69,128.61-128.6,128.61S105.82,155.5,105.82,84.59c0-1.11.1-2.2.17-3.29l.19-3.16-54.5-2.67-.14,2.15c-.15,2.31-.29,4.62-.29,6.98,0,101,82.17,183.17,183.17,183.17,39.51,0,76.04-12.71,106-34.07l66.12,29.21-21.65-74.14Z";

const BRAND_EYE_PATH =
  "M173.49,98.62c10.39,0,19.79,4.18,26.67,10.91,7.09-6.93,11.52-16.58,11.52-27.28,0-21.09-17.1-38.19-38.19-38.19s-38.19,17.1-38.19,38.19c0,10.7,4.43,20.35,11.52,27.28,6.89-6.73,16.28-10.91,26.67-10.91Z";

function BrandMark({ x, y, width, rotate = 0, tone = "outline", eyes = true }) {
  const eyeOffset = width * (35 / 380);
  const symbolY = y - eyeOffset;
  const height = width * (240 / 380);
  const centerX = x + width / 2;
  const centerY = symbolY + height / 2;
  const toneClass = tone === "soft" ? styles.finalBrandMarkSoft : "";

  return (
    <use
      className={`${styles.finalBrandMark}${toneClass ? ` ${toneClass}` : ""}`}
      href={eyes ? "#final-mdb-symbol-eyed" : "#final-mdb-symbol"}
      x={x}
      y={symbolY}
      width={width}
      height={height}
      transform={`rotate(${rotate} ${centerX} ${centerY})`}
    />
  );
}

export default function FinalBrandPattern() {
  return (
    <div
      className={styles.finalBrandPattern}
      aria-hidden="true"
      data-final-brand-pattern
    >
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
        aria-hidden="true"
      >
        <defs>
          <symbol id="final-mdb-symbol" viewBox="45 35 380 240">
            <path d={BRAND_SYMBOL_PATH} vectorEffect="non-scaling-stroke" />
          </symbol>
          <symbol id="final-mdb-symbol-eyed" viewBox="45 35 380 240">
            <path d={BRAND_SYMBOL_PATH} vectorEffect="non-scaling-stroke" />
            <path className={styles.finalBrandEye} d={BRAND_EYE_PATH} />
            <path
              className={styles.finalBrandEye}
              d={BRAND_EYE_PATH}
              transform="translate(118.05 0)"
            />
          </symbol>
        </defs>

        <g className={styles.finalBrandDesktop}>
          <BrandMark x={76} y={108} width={88} rotate={-10} eyes />
          <BrandMark x={255} y={245} width={58} rotate={8} tone="soft" />
          <BrandMark x={88} y={440} width={72} rotate={-4} eyes />
          <BrandMark x={238} y={700} width={84} rotate={11} />
          <BrandMark x={420} y={795} width={52} rotate={-8} tone="soft" />
          <BrandMark x={565} y={120} width={46} rotate={6} tone="soft" eyes />
          <BrandMark x={790} y={80} width={64} rotate={-7} />
          <BrandMark x={985} y={205} width={52} rotate={9} tone="soft" />
          <BrandMark x={1180} y={100} width={90} rotate={7} eyes />
          <BrandMark x={1288} y={370} width={74} rotate={-9} />
          <BrandMark x={1195} y={625} width={60} rotate={5} tone="soft" />
          <BrandMark x={1035} y={770} width={82} rotate={-6} eyes />
          <BrandMark x={835} y={810} width={48} rotate={8} tone="soft" />
          <BrandMark x={1310} y={760} width={46} rotate={-5} tone="soft" />
        </g>

        <g className={styles.finalBrandTablet}>
          <BrandMark x={245} y={130} width={68} rotate={-8} eyes />
          <BrandMark x={340} y={225} width={48} rotate={9} tone="soft" />
          <BrandMark x={270} y={625} width={76} rotate={6} />
          <BrandMark x={430} y={770} width={48} rotate={-7} tone="soft" />
          <BrandMark x={760} y={100} width={55} rotate={7} eyes />
          <BrandMark x={1030} y={220} width={65} rotate={-9} />
          <BrandMark x={1120} y={620} width={72} rotate={8} eyes />
          <BrandMark x={930} y={735} width={58} rotate={-5} tone="soft" />
        </g>

        <g className={styles.finalBrandMobile}>
          <BrandMark x={510} y={120} width={54} rotate={-8} eyes />
          <BrandMark x={860} y={100} width={52} rotate={9} tone="soft" />
          <BrandMark x={835} y={790} width={46} rotate={-7} />
          <BrandMark x={690} y={780} width={42} rotate={6} tone="soft" />
        </g>
      </svg>
    </div>
  );
}
