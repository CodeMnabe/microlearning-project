import localFont from "next/font/local";
import "./globals.css";
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
  description: "Created by the company Digik, by the dev Gaspar Alves",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <GlobalLoaderProvider>
          <AuthProvider>{children}</AuthProvider>
        </GlobalLoaderProvider>
      </body>
    </html>
  );
}
