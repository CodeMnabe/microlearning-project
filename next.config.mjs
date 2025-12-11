/** @type {import('next').NextConfig} */
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.js");

const nextConfig = {
  images: {
    domains: ["ztxzlixcprexbhdmqpkj.supabase.co"],
  },
};

export default withNextIntl(nextConfig);
