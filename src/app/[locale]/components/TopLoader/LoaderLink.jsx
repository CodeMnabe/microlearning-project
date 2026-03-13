"use client";

import { Link } from "@/i18n/navigation";
import { startTopLoader } from "./TopLoader";

export default function LoaderLink({ onClick, href, ...props }) {
  function handleClick(event) {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    startTopLoader();
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
