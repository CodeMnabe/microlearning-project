import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import styles from "./Footer.module.css";
import content from "./footer.json";

function SocialIcon({ href, label, children }) {
  return (
    <Link href={href} aria-label={label} className={styles.socialBtn}>
      {children}
    </Link>
  );
}

function Badge({ children }) {
  return <span className={styles.badge}>{children}</span>;
}

function renderSocialIcon(key) {
  switch (key) {
    case "x":
      return <span className={styles.iconText}>X</span>;
    case "linkedin":
      return <span className={styles.iconText}>in</span>;
    case "youtube":
      return <span className={styles.iconText}>▶</span>;
    default:
      return <span className={styles.iconText}>•</span>;
  }
}

export default function Footer() {
  const t = useTranslations("LandingPage.Footer");
  const year = new Date().getFullYear();

  return (
    <footer className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <div className={styles.brandRow}>
              <Image
                src="/images/Logos/Logo.png"
                alt="MyDigitalBot logo"
                width={45}
                height={28}
              />
              <span className={styles.brandName}>{content.brand}</span>
            </div>

            <div className={styles.socials}>
              {content.socials.map((s) => (
                <SocialIcon key={s.href} href={s.href} label={t(s.labelKey)}>
                  {renderSocialIcon(s.icon)}
                </SocialIcon>
              ))}
            </div>
          </div>

          <div className={styles.cols}>
            {content.columns.map((col) => (
              <div key={col.titleKey} className={styles.col}>
                <p className={styles.colTitle}>{t(col.titleKey)}</p>
                <ul className={styles.links}>
                  {col.links.map((l) => (
                    <li key={l.href + l.labelKey}>
                      <Link className={styles.link} href={l.href}>
                        {t(l.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.bottom}>
          <p className={styles.copy}>
            © {year} {content.brand}
          </p>
          <div className={styles.badges}>
            {(content.badgesKeys || []).map((k) => (
              <Badge key={k}>{t(k)}</Badge>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
