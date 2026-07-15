import { redirect } from "next/navigation";
import RouteLoader from "../../LoadingScreen/RouteLoader";
import GlobalLoadingOverlay from "../../LoadingScreen/GlobalLoadingOverlay";
import Navbar from "../../components/Navbar/Navbar";
import TopBar from "../../components/TopBar/TopBar";
import { MobileNavProvider } from "@/app/components/MobileNav/MobileNavContext";
import createSupabaseServerClient from "@/utils/supabase/server";
import { routing } from "@/i18n/routing";
import "react-datepicker/dist/react-datepicker.css";

export default async function AppLayout({ children, params }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const { locale } = await params;
    redirect(locale === routing.defaultLocale ? "/login" : `/${locale}/login`);
  }

  return (
    <MobileNavProvider>
      <RouteLoader />
      <TopBar />
      <div className="app-shell">
        <Navbar />
        <div className="main-col">
          <div className="page-content">
            <GlobalLoadingOverlay />
            <main className="app-main">{children}</main>
          </div>
        </div>
      </div>
    </MobileNavProvider>
  );
}
