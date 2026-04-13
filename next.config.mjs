/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "randomuser.me",
      },
      {
        // Supabase Storage — for receipt images
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

// Only wrap with Sentry if DSN is configured.
// Avoids build failures in CI when SENTRY_DSN is not set.
async function buildConfig() {
  if (process.env.SENTRY_DSN) {
    const { withSentryConfig } = await import("@sentry/nextjs");
    return withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      autoInstrumentServerFunctions: true,
      disableLogger: true,
    });
  }
  return nextConfig;
}

export default await buildConfig();
