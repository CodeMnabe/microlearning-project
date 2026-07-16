"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import PublicDocument from "./PublicDocument";
import { buildDPA, buildPrivacy, buildTOS, buildSec } from "./documents";
import styles from "../public.module.css";

const DEFAULT_DOC = "terms-of-service";

export default function LegalDocumentClient() {
  const searchParams = useSearchParams();

  const tDpa = useTranslations("Public.Dpa");
  const tTos = useTranslations("Public.TermsOfService");
  const tP = useTranslations("Public.PrivacyPolicy");
  const tSp = useTranslations("Public.SecurityProviders");
  const tFooter = useTranslations("LandingPage.Footer");

  const docs = useMemo(
    () => ({
      "terms-of-service": {
        title: tTos("Title"),
        subtitle: tTos("LastUpdated"),
        lastUpdated: "24/03/2026",
        sections: buildTOS(tTos).sections,
      },
      "data-processing-agreement": {
        title: tDpa("Title"),
        subtitle: tDpa("LastUpdated"),
        lastUpdated: "24/03/2026",
        sections: buildDPA(tDpa).sections,
      },
      "privacy-policy": {
        title: tP("Title"),
        subtitle: tP("LastUpdated"),
        lastUpdated: "24/03/2026",
        sections: buildPrivacy(tP).sections,
      },
      "security-providers": {
        title: tSp("Title"),
        subtitle: tSp("LastUpdated"),
        lastUpdated: "24/03/2026",
        sections: buildSec(tSp).sections,
      },
    }),
    [tDpa, tTos, tP, tSp],
  );

  const rawDoc = searchParams.get("doc");
  const activeSlug = rawDoc && docs[rawDoc] ? rawDoc : DEFAULT_DOC;
  const activeDoc = docs[activeSlug];

  return (
    <div className={styles.legalShell}>
      <nav className={styles.docTabs} aria-label={tFooter("cols.legal")}>
        {Object.entries(docs).map(([slug, doc]) => (
          <Link
            key={slug}
            href={`/legal?doc=${slug}`}
            className={`${styles.docTab} ${
              activeSlug === slug ? styles.docTabActive : ""
            }`}
            aria-current={activeSlug === slug ? "page" : undefined}
          >
            {doc.title}
          </Link>
        ))}
      </nav>
      <PublicDocument
        title={activeDoc.title}
        subtitle={activeDoc.subtitle}
        lastUpdated={activeDoc.lastUpdated}
        sections={activeDoc.sections}
      />
    </div>
  );
}
