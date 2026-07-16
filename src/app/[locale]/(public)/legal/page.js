import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import LegalDocumentClient from "../components/LegalDocumentClient";

const DOCUMENT_TRANSLATIONS = {
  "data-processing-agreement": "Dpa",
  "privacy-policy": "PrivacyPolicy",
  "security-providers": "SecurityProviders",
  "terms-of-service": "TermsOfService",
};

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const namespace =
    DOCUMENT_TRANSLATIONS[params?.doc] || DOCUMENT_TRANSLATIONS["terms-of-service"];
  const t = await getTranslations(`Public.${namespace}`);

  return {
    title: `${t("Title")} | MyDigitalBot`,
  };
}

export default function LegalPage() {
  return (
    <Suspense fallback={null}>
      <LegalDocumentClient />
    </Suspense>
  );
}
