/** @type {import('next').NextConfig} */
import createNextIntlPlugin from "next-intl/plugin";
import { buildSecurityHeaders } from "./src/lib/security/headers.js";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.js");

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: buildSecurityHeaders({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        isProduction: process.env.NODE_ENV === "production",
        isVercelPreview: process.env.VERCEL_ENV === "preview",
      }),
    }];
  },
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
