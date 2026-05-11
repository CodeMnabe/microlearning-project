import LanguageSwitch from "@/app/components/TopBar/LanguageSwitch";

export default function RedirectLayout({ children }) {
  return <LanguageSwitch>{children}</LanguageSwitch>;
}
