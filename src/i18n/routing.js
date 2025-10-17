// src/i18n/routing.js
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "pt"],
  defaultLocale: "en",
  // 'as-needed' = only prefix non-default locale
  // 'always'    = always prefix every locale
  localePrefix: "always",

  // Optional: map pathnames per-locale (keep simple for now)
  // pathnames: {
  //   '/users': {
  //     en: '/users',
  //     pt: '/users' // or '/utilizadores'
  //   }
  // }
});
