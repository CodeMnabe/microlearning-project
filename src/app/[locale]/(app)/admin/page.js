import { redirect } from "@/i18n/navigation";

export default async function AdminRedirect({ params }) {
  const { locale } = await params;
  redirect({ href: "/settings", locale });
}
