import MarketingNavbar from "./Navbar";
import styles from "./persistentHeader.module.css";

/**
 * Persistent marketing header: the single wrapper every public marketing page
 * should use to mount <MarketingNavbar>. It renders exactly one navbar
 * instance and pins it to the top of the viewport for the whole scroll.
 *
 * `reserveSpace` keeps a placeholder in the normal flow with the same height
 * the header used to have, so pages that mounted the navbar in-flow keep their
 * geometry unchanged. Pages whose header was already out of flow (the landing
 * page, where it was absolutely positioned) leave it off.
 */
export default function PersistentHeader({ reserveSpace = false }) {
  return (
    <>
      {reserveSpace ? (
        <div className={styles.spacer} aria-hidden="true" />
      ) : null}
      <div className={styles.bar}>
        <MarketingNavbar />
      </div>
    </>
  );
}
