/** @type {import('next').NextConfig} */
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.js");

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ztxzlixcprexbhdmqpkj.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
