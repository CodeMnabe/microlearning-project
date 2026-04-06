import { Suspense } from "react";
import LegalDocumentClient from "../components/LegalDocumentClient";

export default function LegalPage() {
  return (
    <Suspense fallback={null}>
      <LegalDocumentClient />
    </Suspense>
  );
}
