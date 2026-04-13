import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Only enable in production — keeps dev logs clean
  enabled: process.env.NODE_ENV === "production",

  // Capture 10% of transactions for performance monitoring.
  // Increase to 1.0 (100%) temporarily when debugging performance issues.
  tracesSampleRate: 0.1,

  // Replay 1% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media to protect user privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
