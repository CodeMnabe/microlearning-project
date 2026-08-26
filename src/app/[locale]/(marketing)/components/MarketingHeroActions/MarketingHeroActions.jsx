import LoaderLink from "../TopLoader/LoaderLink";
import styles from "./marketingHeroActions.module.css";

export default function MarketingHeroActions({ primary, secondary, secondaryHref = "/product" }) {
  return (
    <div className={styles.actions}>
      <LoaderLink
        href="/contact"
        className={styles.primary}
        data-page-demo-cta
      >
        {primary}
      </LoaderLink>
      <LoaderLink href={secondaryHref} className={styles.secondary}>
        {secondary}
      </LoaderLink>
    </div>
  );
}
