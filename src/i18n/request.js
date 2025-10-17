// src/i18n/request.js
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing"; // to read defaultLocale & supported locales

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` is a Promise in v4
  let locale = (await requestLocale) ?? routing.defaultLocale;

  // Safety: fall back to default if something unexpected comes in
  if (!routing.locales.includes(locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale, // <-- IMPORTANT: must be returned
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
