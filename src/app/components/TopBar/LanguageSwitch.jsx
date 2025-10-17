// src/app/components/TopBar/LanguageSwitch.jsx
"use client";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

function Lang({ to, active, pathname }) {
  return (
    <Link
      href={pathname}
      locale={to}
      prefetch={false}
      aria-current={active ? "true" : undefined}
      style={{
        padding: "6px 10px",
        fontWeight: 600,
        textDecoration: "none",
        opacity: active ? 1 : 0.7,
        background: active ? "#fff" : "transparent",
        lineHeight: 1,
      }}
    >
      {to.toUpperCase()}
    </Link>
  );
}

export default function LanguageSwitch() {
  const locale = useLocale(); // 'en' | 'pt'
  const pathname = usePathname(); // current path (with locale)

  return (
    <div
      style={{
        display: "inline-flex",
        border: "1px solid var(--topbar-border)",
        borderRadius: 9999,
        overflow: "hidden",
        background: "#f3f5f7",
      }}
    >
      <Lang to="pt" active={locale === "pt"} pathname={pathname} />
      <Lang to="en" active={locale === "en"} pathname={pathname} />
    </div>
  );
}
