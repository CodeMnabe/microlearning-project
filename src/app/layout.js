import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "./AuthContext";
import Navbar from "./components/Navbar/Navbar";
import { GlobalLoaderProvider } from "./LoadingScreen/GlobalLoaderContext";
import GlobalLoadingOverlay from "./LoadingScreen/GlobalLoadingOverlay";
import RouteLoader from "./LoadingScreen/RouteLoader";
import TopBar from "./components/TopBar/TopBar";

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
  title: "MicroLearning App",
  description: "Created by the company Digik, by the dev Gaspar Alves",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <GlobalLoaderProvider>
          <AuthProvider>
            <RouteLoader />
            <TopBar />
            <div className="app-shell">
              <Navbar />
              <div className="main-col">
                {/* Only this area will be blocked by the loader */}
                <div className="page-content">
                  <GlobalLoadingOverlay />
                  <main className="app-main">{children}</main>
                </div>
              </div>
            </div>
          </AuthProvider>
        </GlobalLoaderProvider>
      </body>
    </html>
  );
}
