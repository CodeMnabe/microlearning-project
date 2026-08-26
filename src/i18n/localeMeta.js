// src/i18n/localeMeta.js
import { routing } from "./routing";

/**
 * Presentation metadata for the language switcher UI (see
 * src/app/components/Navbar/MarketingNavbar/LanguageMenu.jsx).
 *
 * `routing.locales` (./routing.js) stays the source of truth for which
 * locales are actually routable. This list only adds the native label and
 * short code shown in the dropdown, in display order.
 *
 * To add a language in the future:
 *   1. add its code to `routing.locales` in ./routing.js
 *   2. add an entry below with its native name and short code
 * The dropdown picks it up automatically — no header/component changes
 * required.
 */
const LOCALE_META = [
  { code: "pt", label: "Português", short: "PT" },
  { code: "en", label: "English", short: "EN" },
];

export const localeOptions = LOCALE_META.filter((locale) =>
  routing.locales.includes(locale.code),
);
