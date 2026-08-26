import styles from "./solutionPage.module.css";

const BUBBLE_PATH =
  "M384.9,188.75c20.55-29.6,32.69-65.47,32.69-104.16,0-2.42-.14-4.81-.3-7.19l-.14-2.05-54.48,2.9.17,2.85c.09,1.16.18,2.32.18,3.5,0,70.91-57.69,128.61-128.6,128.61S105.82,155.5,105.82,84.59c0-1.11.1-2.2.17-3.29l.19-3.16-54.5-2.67-.14,2.15c-.15,2.31-.29,4.62-.29,6.98,0,101,82.17,183.17,183.17,183.17,39.51,0,76.04-12.71,106-34.07l66.12,29.21-21.65-74.14Z";

const EYE_PATH =
  "M173.49,98.62c10.39,0,19.79,4.18,26.67,10.91,7.09-6.93,11.52-16.58,11.52-27.28,0-21.09-17.1-38.19-38.19-38.19s-38.19,17.1-38.19,38.19c0,10.7,4.43,20.35,11.52,27.28,6.89-6.73,16.28-10.91,26.67-10.91Z";

const PARTICLES = [
  [72, 118, 2.1],
  [137, 82, 1.2],
  [216, 154, 1.7],
  [303, 96, 1.1],
  [390, 184, 2.4],
  [468, 68, 1.4],
  [548, 126, 1.2],
  [648, 72, 1.9],
  [742, 176, 1.1],
  [828, 104, 2.2],
  [921, 62, 1.2],
  [1012, 154, 1.6],
  [1118, 92, 1.1],
  [1226, 184, 2.3],
  [1338, 76, 1.3],
  [1462, 128, 1.8],
  [1540, 54, 1.1],
  [94, 296, 1.1],
  [182, 246, 2.2],
  [284, 334, 1.3],
  [386, 262, 1.7],
  [504, 312, 1.1],
  [622, 238, 2.1],
  [748, 356, 1.3],
  [872, 268, 1.1],
  [984, 338, 1.8],
  [1092, 246, 1.2],
  [1212, 326, 2.1],
  [1372, 262, 1.1],
  [1510, 344, 1.5],
  [52, 488, 1.8],
  [162, 424, 1.1],
  [298, 518, 1.4],
  [442, 446, 1.1],
  [574, 542, 2],
  [712, 462, 1.2],
  [846, 526, 1.5],
  [996, 438, 1.1],
  [1136, 548, 1.9],
  [1284, 456, 1.3],
  [1438, 524, 1.8],
  [1552, 438, 1.1],
];

const WAVE_PATHS = [
  "M-80 288 C170 88 354 78 566 214 S984 390 1220 198 1462 52 1680 156",
  "M-90 306 C156 112 356 100 570 232 S976 404 1220 216 1468 72 1690 174",
  "M-80 326 C146 144 354 126 572 254 S974 420 1224 238 1472 96 1688 196",
  "M-62 346 C142 178 356 154 580 276 S982 430 1232 258 1470 126 1674 220",
  "M-34 364 C154 214 370 184 592 298 S994 438 1242 282 1478 158 1658 248",
  "M170 392 C286 230 454 190 638 280 S950 382 1130 252 1400 132 1618 228",
  "M382 410 C486 274 624 240 778 300 S1036 368 1194 270 1420 188 1594 246",
];

export default function SolutionHeroBackdrop() {
  return (
    <div className={styles.heroBackdrop} aria-hidden="true">
      <span className={`${styles.ambientGlow} ${styles.ambientGlowRight}`} />
      <span className={`${styles.ambientGlow} ${styles.ambientGlowBottom}`} />

      <svg
        className={styles.particleField}
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
        focusable="false"
      >
        <g className={styles.scatteredParticles}>
          {PARTICLES.map(([cx, cy, radius], index) => (
            <circle
              key={`${cx}-${cy}`}
              className={index % 5 === 0 ? styles.brightParticle : undefined}
              cx={cx}
              cy={cy}
              r={radius}
            />
          ))}
        </g>
      </svg>

      <svg
        className={styles.brandParticleMark}
        viewBox="34 28 405 264"
        focusable="false"
      >
        <defs>
          <pattern
            id="solution-mark-dots"
            width="15"
            height="15"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="3" r="1.15" fill="#9bc8ff" />
            <circle cx="11" cy="8" r="0.72" fill="#4e9cff" />
            <circle cx="6" cy="13" r="0.48" fill="#716cff" />
          </pattern>
          <linearGradient id="solution-mark-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9bcbff" />
            <stop offset="0.5" stopColor="#4f9dff" />
            <stop offset="1" stopColor="#6267f5" />
          </linearGradient>
          <filter
            id="solution-mark-glow"
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur stdDeviation="3.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className={styles.markAura} filter="url(#solution-mark-glow)">
          <path d={BUBBLE_PATH} />
          <path d={EYE_PATH} />
          <path d={EYE_PATH} transform="translate(122 0)" />
        </g>

        <g className={styles.markParticles}>
          <path d={BUBBLE_PATH} />
          <path d={EYE_PATH} />
          <path d={EYE_PATH} transform="translate(122 0)" />
        </g>

        <g className={styles.markContour}>
          <path d={BUBBLE_PATH} />
          <path d={EYE_PATH} />
          <path d={EYE_PATH} transform="translate(122 0)" />
        </g>
      </svg>

      <svg
        className={styles.waveField}
        viewBox="0 0 1600 420"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient
            id="solution-wave-gradient"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop offset="0" stopColor="#315cff" stopOpacity="0" />
            <stop offset="0.16" stopColor="#5d84ff" stopOpacity="0.65" />
            <stop offset="0.48" stopColor="#86b9ff" stopOpacity="0.34" />
            <stop offset="0.76" stopColor="#467fff" stopOpacity="0.62" />
            <stop offset="1" stopColor="#725eff" stopOpacity="0" />
          </linearGradient>
          <filter
            id="solution-wave-glow"
            x="-10%"
            y="-40%"
            width="120%"
            height="180%"
          >
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className={styles.meshThreads}>
          {WAVE_PATHS.map((path) => (
            <path key={path} d={path} />
          ))}
          <path d="M84 392 C236 248 340 164 480 132" />
          <path d="M266 412 C388 270 500 226 642 214" />
          <path d="M492 420 C584 322 714 288 848 284" />
          <path d="M774 420 C872 334 986 292 1118 246" />
          <path d="M1068 420 C1172 316 1294 224 1438 148" />
          <path d="M1322 420 C1406 328 1490 260 1608 226" />
        </g>

        <g className={styles.meshDots} filter="url(#solution-wave-glow)">
          {WAVE_PATHS.map((path) => (
            <path key={path} d={path} pathLength="240" />
          ))}
        </g>
      </svg>

      <span className={styles.heroReadabilityVeil} />
    </div>
  );
}
