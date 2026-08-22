import type { NextConfig } from "next";

/**
 * The Supabase project's hostname, for the image allow-list below.
 *
 * Derived from the URL that is already required rather than added as a
 * second variable to keep in step: the two could not disagree without
 * the app failing to start anyway.
 *
 * `URL` throws on a malformed value, and this is config — a throw here
 * fails the build with the actual reason, which beats a home page whose
 * photographs silently 400 because a hostname was typed with a scheme
 * on the front.
 */
function supabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return new URL(url).hostname;
}

const host = supabaseHost();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    /**
     * next/image refuses any remote host not listed here, and that
     * refusal is the point — without an allow-list the optimiser is an
     * open proxy that will fetch and re-serve any URL on the internet
     * under this site's domain.
     *
     * Narrowed to the one bucket rather than the whole project: nothing
     * else in Supabase storage should ever be rendered as an image on
     * this site, and `/storage/v1/object/public/` is the only path that
     * serves without a signature.
     */
    remotePatterns: host
      ? [
          {
            protocol: "https" as const,
            hostname: host,
            pathname: "/storage/v1/object/public/site-images/**",
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
