import SiteUnavailable from "../../components/SiteUnavailable/SiteUnavailable";
import styles from "./marketingShell.module.css";

export default function MarketingLayout({ children }) {
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";

  if (isMaintenanceMode) {
    return <SiteUnavailable />;
  }

  return (
    <div className={styles.shell} data-marketing-shell>
      {children}
    </div>
  );
}
