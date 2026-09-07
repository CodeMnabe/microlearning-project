import styles from "./sharedHeroNeonBrand.module.css";

const SYMBOL_PATH =
  "M384.9,188.75c20.55-29.6,32.69-65.47,32.69-104.16,0-2.42-.14-4.81-.3-7.19l-.14-2.05-54.48,2.9.17,2.85c.09,1.16.18,2.32.18,3.5,0,70.91-57.69,128.61-128.6,128.61S105.82,155.5,105.82,84.59c0-1.11.1-2.2.17-3.29l.19-3.16-54.5-2.67-.14,2.15c-.15,2.31-.29,4.62-.29,6.98,0,101,82.17,183.17,183.17,183.17,39.51,0,76.04-12.71,106-34.07l66.12,29.21-21.65-74.14Z";

const EYE_PATH =
  "M173.49,98.62c10.39,0,19.79,4.18,26.67,10.91,7.09-6.93,11.52-16.58,11.52-27.28,0-21.09-17.1-38.19-38.19-38.19s-38.19,17.1-38.19,38.19c0,10.7,4.43,20.35,11.52,27.28,6.89-6.73,16.28-10.91,26.67-10.91Z";

const toCssLength = (value) =>
  typeof value === "number" ? `${value}px` : value;

function BrandPaths() {
  return (
    <>
      <path d={SYMBOL_PATH} />
      <path d={EYE_PATH} />
      <path d={EYE_PATH} transform="translate(118.05 0)" />
    </>
  );
}

/**
 * Shared, code-native hero backdrop for the marketing site.
 * Page presets only change composition; all rendering stays identical.
 */
export default function SharedHeroNeonBrand({
  variant = "home",
  position,
  scale,
  rotation,
  opacity,
  glowIntensity = 1,
  className = "",
}) {
  const customProperties = {
    ...(position?.bottom !== undefined &&
      position?.top === undefined && { "--neon-top": "auto" }),
    ...(position?.left !== undefined &&
      position?.right === undefined && { "--neon-right": "auto" }),
    ...(position?.top !== undefined && {
      "--neon-top": toCssLength(position.top),
    }),
    ...(position?.right !== undefined && {
      "--neon-right": toCssLength(position.right),
    }),
    ...(position?.bottom !== undefined && {
      "--neon-bottom": toCssLength(position.bottom),
    }),
    ...(position?.left !== undefined && {
      "--neon-left": toCssLength(position.left),
    }),
    ...(scale !== undefined && { "--neon-size": toCssLength(scale) }),
    ...(rotation !== undefined && { "--neon-rotation": `${rotation}deg` }),
    ...(opacity !== undefined && { "--neon-opacity": opacity }),
    "--neon-glow-opacity": Math.min(0.32, 0.22 * glowIntensity),
    "--neon-halo-opacity": Math.min(0.16, 0.09 * glowIntensity),
    "--neon-glow-blur": `${Math.max(3, 5 * glowIntensity)}px`,
  };

  return (
    <div
      className={`${styles.root} ${className}`}
      data-neon-hero={variant}
      style={customProperties}
      aria-hidden="true"
    >
      <span className={styles.atmosphere} />
      <div className={styles.motifPlacement}>
        <div className={styles.motifFloat}>
          <svg
            className={styles.motif}
            viewBox="34 26 405 267"
            focusable="false"
          >
            <g className={styles.halo}>
              <BrandPaths />
            </g>
            <g className={styles.glow}>
              <BrandPaths />
            </g>
            <g className={styles.core}>
              <BrandPaths />
            </g>
          </svg>
        </div>
      </div>
      <span className={styles.readabilityVeil} />
    </div>
  );
}
