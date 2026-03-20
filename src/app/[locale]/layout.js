import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ConfirmProvider } from "../components/Confirm/ConfirmProvider";
import NavCursor from "../components/NavCursor/NavCursor";
import TopLoader from "./components/TopLoader/TopLoader";
import SiteUnavailable from "../components/SiteUnavailable/SiteUnavailable";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "pt" }];
}

export default async function LocaleLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();

  const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";

  if (isMaintenanceMode) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <SiteUnavailable />
      </NextIntlClientProvider>
    );
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <TopLoader />
      <NavCursor />
      <ConfirmProvider>{children}</ConfirmProvider>
    </NextIntlClientProvider>
  );
}
