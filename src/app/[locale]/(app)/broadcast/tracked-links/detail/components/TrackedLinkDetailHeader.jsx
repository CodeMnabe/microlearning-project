import LoaderLink from "@/app/[locale]/(marketing)/components/TopLoader/LoaderLink";
import styles from "../detail.module.css";

export default function TrackedLinkDetailHeader({ translation }) {
  return (
    <div className={styles.topRow}>
      <LoaderLink href="/broadcast/tracked-links" className={styles.backBtn}>
        ← {translation("back")}
      </LoaderLink>
    </div>
  );
}
