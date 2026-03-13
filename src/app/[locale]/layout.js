import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ConfirmProvider } from "../components/Confirm/ConfirmProvider";
import NavCursor from "../components/NavCursor/NavCursor";
import TopLoader from "./components/TopLoader/TopLoader";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "pt" }];
}

export default async function LocaleLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <TopLoader />
      <NavCursor />
      <ConfirmProvider>{children}</ConfirmProvider>
    </NextIntlClientProvider>
  );
}
