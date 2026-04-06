// src/app/components/TopBar/LanguageSwitch.jsx
"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

function Lang({ to, active, pathname, query }) {
  return (
    <Link
      href={{
        pathname,
        query,
      }}
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
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = Object.fromEntries(searchParams.entries());

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
      <Lang
        to="pt"
        active={locale === "pt"}
        pathname={pathname}
        query={query}
      />
      <Lang
        to="en"
        active={locale === "en"}
        pathname={pathname}
        query={query}
      />
    </div>
  );
}
