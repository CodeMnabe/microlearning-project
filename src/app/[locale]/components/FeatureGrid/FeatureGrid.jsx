import Image from "next/image";
import { useTranslations } from "next-intl";
import styles from "./FeatureGrid.module.css";
import content from "./FeatureGrid.json";

function Tile({ tile }) {
  const t = useTranslations("LandingPage.FeatureGrid");

  const areas =
    tile.split === "cols"
      ? tile.mediaPosition === "right"
        ? `"content media"`
        : `"media content"`
      : tile.mediaPosition === "bottom"
        ? `"content" "media"`
        : `"media" "content"`;

  const defaultRatio = tile.split === "cols" ? "1 / 1" : "16 / 10";

  const bullets = (tile.bulletsKeys || []).map((k) => t(k));

  return (
    <article
      className={styles.tile}
      style={{
        "--col-span": tile.colSpan ?? 4,
        "--row-span": tile.rowSpan ?? 1,
        "--media-ratio": tile.mediaRatio || defaultRatio,
        "--media-max-width": tile.mediaMaxWidth || "100%",
        "--media-justify": tile.mediaJustify || "center",
        "--media-fit": tile.mediaFit || "cover",
      }}
    >
      <div
        className={`${styles.inner} ${tile.split === "cols" ? styles.cols : styles.rows}`}
        style={{ gridTemplateAreas: areas }}
      >
        <div className={styles.media} style={{ gridArea: "media" }}>
          {tile.image?.src ? (
            <div className={styles.mediaFrame}>
              <Image
                src={tile.image.src}
                alt={tile.image.altKey ? t(tile.image.altKey) : ""}
                fill
                sizes="(max-width: 768px) 100vw, 600px"
                className={styles.mediaImg}
              />
            </div>
          ) : (
            <div className={styles.mediaFrame} aria-hidden="true" />
          )}
        </div>

        <div className={styles.content} style={{ gridArea: "content" }}>
          <h3 className={styles.title}>{t(tile.titleKey)}</h3>
          <p className={styles.desc}>{t(tile.descriptionKey)}</p>

          {bullets.length > 0 && (
            <ul className={styles.bullets}>
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

export default function FeatureGrid() {
  const t = useTranslations("LandingPage.FeatureGrid");

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{t(content.eyebrowKey)}</p>
        <h2 className={styles.heading}>{t(content.headingKey)}</h2>
        <p className={styles.subheading}>{t(content.subheadingKey)}</p>
      </header>

      <div className={styles.grid}>
        {content.tiles.map((tile) => (
          <Tile key={tile.id} tile={tile} />
        ))}
      </div>
    </section>
  );
}
