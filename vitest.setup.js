import { vi, afterEach, beforeAll } from "vitest";

// Silence console.error in tests — the action-client logs expected errors
// which clutters test output. Tests assert on return values, not console.
beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  // Re-apply after restoreAllMocks resets it
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// Minimal env vars — real DB connection is NOT used in unit tests.
// Integration tests that need the DB must set TEST_DATABASE_URL themselves.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/welth_test";
process.env.DIRECT_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/welth_test";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.ARCJET_KEY = "test-arcjet-key";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_xxx";
process.env.CLERK_SECRET_KEY = "sk_test_xxx";
process.env.RESEND_API_KEY = "test-key";
process.env.INNGEST_EVENT_KEY = "test-key";
process.env.INNGEST_SIGNING_KEY = "test-key";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SENTRY_DSN = "";
