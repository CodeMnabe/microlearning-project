"use client";

import { useTranslations } from "next-intl";
import { getOrganizationLogoUrl } from "@/lib/helpers/organizationLogo.helpers";
import { getSafeTheme } from "@/lib/helpers/theme.helpers";
import styles from "./settings.module.css";

export default function ThemePreview({ theme, logoUrl, orgName }) {
  const t = useTranslations("Settings.preview");
  const safeTheme = getSafeTheme(theme);

  return (
    <div className={styles.preview}>
      <aside
        className={styles.previewSidebar}
        style={{ backgroundColor: safeTheme.secondary }}
      >
        <img
          className={styles.previewLogo}
          src={getOrganizationLogoUrl(logoUrl)}
          alt=""
        />
        <span className={styles.previewOrgName}>{orgName || t("organization")}</span>
        <div className={styles.previewNav}>
          {[0, 1, 2].map((item) => (
            <span
              key={item}
              className={styles.previewNavItem}
              style={
                item === 0
                  ? {
                      background: `linear-gradient(90deg, ${safeTheme.primary}, ${safeTheme.secondary})`,
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </aside>

      <div className={styles.previewContent}>
        <div className={styles.previewTopbar}>
          <span className={styles.previewTopbarDot} />
        </div>
        <div className={styles.previewMain}>
          <div className={styles.previewCard}>
            <strong>{t("cardTitle")}</strong>
            <span>{t("cardText")}</span>
            <button type="button" style={{ backgroundColor: safeTheme.primary }}>
              {t("action")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
