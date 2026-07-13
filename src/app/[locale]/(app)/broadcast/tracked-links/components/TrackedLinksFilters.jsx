import { Search } from "lucide-react";
import styles from "../tracked-links.module.css";

export default function TrackedLinksFilters({ translation, search, onSearchChange }) {
  return (
    <div className={styles.toolbarRow}>
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>
          <Search size={18} />
        </span>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={translation("TrackedLinks.search")}
          className={styles.searchInput}
        />
      </div>
    </div>
  );
}
