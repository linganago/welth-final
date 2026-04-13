import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  enabled: process.env.NODE_ENV === "production",

  tracesSampleRate: 0.1,

  beforeSend(event) {
    // Strip PII before sending to Sentry — never log email addresses or names
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    return event;
  },
});
