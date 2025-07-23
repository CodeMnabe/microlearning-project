import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./AuthContext";
import Navbar from "./components/Navbar/Navbar";
import { GlobalLoaderProvider } from "./LoadingScreen/GlobalLoaderContext";
import GlobalLoadingOverlay from "./LoadingScreen/GlobalLoadingOverlay";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "MicroLearning App",
  description: "Created by the company Digik, by the dev Gaspar Alves",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <GlobalLoaderProvider>
          <AuthProvider>
            <Navbar />
            {children}
          </AuthProvider>
          <GlobalLoadingOverlay />
        </GlobalLoaderProvider>
      </body>
    </html>
  );
}
