import SiteUnavailable from "../../components/SiteUnavailable/SiteUnavailable";

export default function MarketingLayout({ children }) {
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";

  if (isMaintenanceMode) {
    return <SiteUnavailable />;
  }

  return children;
}
