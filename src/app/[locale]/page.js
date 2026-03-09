// Always run dynamically (so we can read the auth cookie)
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import styles from "./[locale].module.css";
import LanguageSwitch from "../components/TopBar/LanguageSwitch";

import Hero from "./components/Hero/Hero.jsx";
import SocialProof from "./components/SocialProof/SocialProof";
import FeatureGrid from "./components/FeatureGrid/FeatureGrid";
import Pricing from "./components/Pricing/Pricing";
import BeforeAfter from "./components/BeforeAfter/BeforeAfter";
import Footer from "./components/Footer/Footer";

export default async function LocaleIndex({ params }) {
  const { locale } = await params;
  const c = await cookies();
  const isAuthed = !!(c.get("sb-access-token") || c.get("sb:token"));
  if (isAuthed) redirect(`/${locale}/users`);

  return (
    <main>
      <div className={styles.lang}>
        <LanguageSwitch />
      </div>

      <Hero />
      {/* <SocialProof /> */}
      <FeatureGrid />
      <Pricing />
      <BeforeAfter />
      <Footer />
    </main>
  );
}
