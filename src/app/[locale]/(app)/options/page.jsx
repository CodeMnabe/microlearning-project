"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/app/AuthContext";
import useOrganization from "@/app/hooks/useOrganization";
import { useGlobalLoader } from "@/app/LoadingScreen/GlobalLoaderContext";

import styles from "./options.module.css";
import ActivityLog from "./components/ActivityLog";

export default function OptionsPage() {
  const { user } = useAuth();
  const { org, loading: orgLoading } = useOrganization(user);
  const translation = useTranslations("Options");
  const activityTranslation = useTranslations("ActivityLog");
  const { stopLoading } = useGlobalLoader();

  useEffect(() => {
    if (!user || !orgLoading) {
      stopLoading();
    }
  }, [user, orgLoading, stopLoading]);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{translation("Title")}</h1>
          <p className={styles.subtitle}>
            {translation("Subtitle", { organization: org?.name ?? "-" })}
          </p>
        </div>
      </div>

      <section className={styles.section} aria-labelledby="activity-title">
        <div className={styles.sectionHeader}>
          <h2 id="activity-title" className={styles.sectionTitle}>
            {activityTranslation("Title")}
          </h2>
          <p className={styles.sectionText}>
            {activityTranslation("Subtitle")}
          </p>
        </div>

        {org?.id ? <ActivityLog orgId={org.id} /> : null}
      </section>
    </div>
  );
}
