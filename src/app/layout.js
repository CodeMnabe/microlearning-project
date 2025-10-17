import localFont from "next/font/local";
import "./globals.css";
import { cookies } from "next/headers";
import { AuthProvider } from "./AuthContext";
import { GlobalLoaderProvider } from "./LoadingScreen/GlobalLoaderContext";

const inter = localFont({
  src: [
    {
      path: "./fonts/InterVariable.woff2",
      style: "normal",
      weight: "100 900",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "MyDigitalBot",
  description:
    "Send any type of messages to your employees or let them have a chat on WhatsApp with a Virtual Assistant powered by AI",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "en";

  return (
    <html lang={locale} className={inter.variable}>
      <body>
        <GlobalLoaderProvider>
          <AuthProvider>{children}</AuthProvider>
        </GlobalLoaderProvider>
      </body>
    </html>
  );
}
