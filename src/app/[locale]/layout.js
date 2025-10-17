import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ConfirmProvider } from "../components/Confirm/ConfirmProvider";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "pt" }];
}

export default async function LocaleLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ConfirmProvider>{children}</ConfirmProvider>
    </NextIntlClientProvider>
  );
}
