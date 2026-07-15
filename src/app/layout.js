import localFont from "next/font/local";
import "./globals.css";
import { cookies, headers } from "next/headers";
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

export async function generateMetadata() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  const metadataBase = new URL(
    host ? `${protocol}://${host}` : "https://mydigitalbot.com",
  );

  const title = "MyDigitalBot | Microlearning no dia a dia";
  const description =
    "Microlearning e assistentes de IA nos canais onde as equipas já trabalham, com feedback imediato e impacto real.";

  return {
    metadataBase,
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: "/og.png", width: 1732, height: 909, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

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
