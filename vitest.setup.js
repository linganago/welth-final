import { vi, afterEach, beforeAll } from "vitest";

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // CRITICAL: Use clearAllMocks, NOT restoreAllMocks.
  // restoreAllMocks() removes vi.mock() module-level mock implementations
  // entirely, causing auth() to return undefined in subsequent tests.
  // clearAllMocks() only resets call counts — keeps mock implementations intact.
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/welth_test";
process.env.DIRECT_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/welth_test";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.ARCJET_KEY = "test-arcjet-key";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
process.env.CLERK_SECRET_KEY = "sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
process.env.RESEND_API_KEY = "test-key";
process.env.INNGEST_EVENT_KEY = "test-key";
process.env.INNGEST_SIGNING_KEY = "test-key";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SENTRY_DSN = "";