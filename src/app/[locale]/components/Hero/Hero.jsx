import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import styles from "./hero.module.css";
import MarketingNavbar from "./Navbar/Navbar";
import Chips from "./Chips/Chips";
import Cards from "./Cards/Cards";

const CHIPS = [
  "Membership sites",
  "SaaS products",
  "Clubs",
  "Associations",
  "Courses",
  "Communities",
];

const CARDS = [
  {
    id: 1,
    title: "Show Them",
    meta: "COURSE • BUILT ON WEBFLOW",
    screenshot: null,
  },

  {
    id: 2,
    title: "Making UX Decisions",
    meta: "COURSE • BUILT ON FRAMER",
    screenshot: null,
  },

  {
    id: 3,
    title: "Dev Toolkit",
    meta: "COURSE/BOOK • BUILT ON WEBFLOW",
    screenshot: null,
  },
];

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.background} aria-hidden="true" />
      <div className={styles.navRow}>
        <MarketingNavbar />
      </div>
      <div className={styles.container}>
        {/* Hero content later, style is only so on the website we can see the background */}
        <div className={styles.headline}>
          <h1 className={styles.title}>
            Launch and Scale <br />
            Your Membership
          </h1>
          <p className={styles.subhead}>
            Everything you need to grow, from <u>payments</u> and{" "}
            <u>protected content</u> to <u>CRM</u> and <u>email</u>.
          </p>

          <div className={styles.actions}>
            <Link href="/signup" className={styles.primaryBtn}>
              Sign up for free
            </Link>
            <Link href="/product" className={styles.secondaryBtn}>
              Is MyDigitalBot for me?
            </Link>
          </div>
          {/* CHIPS SECTION OF THE LANDING PAGE */}
          <Chips items={CHIPS} />
          {/* CARDS SECTION OF THE LANDING PAGE */}
          <Cards items={CARDS} />
        </div>
      </div>
    </section>
  );
}
