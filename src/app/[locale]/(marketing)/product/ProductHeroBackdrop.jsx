import Image from "next/image";
import styles from "./productHeroBackdrop.module.css";

export default function ProductHeroBackdrop() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.scene}>
        <Image
          className={styles.image}
          src="/images/hero/product-glass-symbol.jpg"
          alt=""
          fill
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
          unoptimized
        />
      </div>
    </div>
  );
}
