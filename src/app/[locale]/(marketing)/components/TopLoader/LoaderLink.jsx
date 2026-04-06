"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { startTopLoader } from "./TopLoader";

export default function LoaderLink({ onClick, href, ...props }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function isModifiedEvent(event) {
    return (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    );
  }

  function isSameUrl(targetHref) {
    if (typeof window === "undefined") return false;
    if (typeof targetHref !== "string") return false;

    const current = new URL(window.location.href);
    const target = new URL(targetHref, window.location.origin);

    return (
      current.pathname === target.pathname &&
      current.search === target.search &&
      current.hash === target.hash
    );
  }

  function handleClick(event) {
    onClick?.(event);

    if (event.defaultPrevented || isModifiedEvent(event)) {
      return;
    }

    if (typeof href === "string" && isSameUrl(href)) {
      return;
    }

    startTopLoader();
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
