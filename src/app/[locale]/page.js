// Always run dynamically (so we can read the auth cookie)
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import styles from "./[locale].module.css";
import LanguageSwitch from "../components/TopBar/LanguageSwitch";
import Hero from "./components/Hero/Hero.jsx";
import SocialProof from "./components/SocialProof/SocialProof";

export default async function LocaleIndex({ params }) {
  const { locale } = await params;
  // READ ONLY: use cookie presence as the signal
  const c = await cookies();
  const isAuthed = !!(c.get("sb-access-token") || c.get("sb:token"));
  if (isAuthed) redirect(`/${locale}/users`);

  return (
    <main>
      <div className={styles.lang}>
        <LanguageSwitch />
      </div>
      <Hero />
      <SocialProof />
    </main>
  );
}
